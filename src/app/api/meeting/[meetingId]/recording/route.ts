import { after, type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Pipeline AI berjalan setelah respons finalize dikirim (via after()); beri
// waktu cukup untuk transkripsi+ringkasan rekaman panjang oleh Gemini.
// Rekaman sampai 2 jam / 500MB butuh waktu upload+proses yang jauh lebih lama
// dari rekaman singkat -- 800s adalah batas maksimum Vercel Pro/Enterprise
// untuk serverless function. Di paket Hobby, Vercel memaksa maxDuration ke
// 60s tanpa peduli nilai di sini, jadi rekaman panjang butuh paket Pro ke atas.
export const maxDuration = 800;

// Helper to check/create private bucket "meeting-recordings".
// Migration 0021 already creates this bucket directly via SQL, so this is
// just a safety net -- but errors here used to be swallowed silently, which
// made every chunk upload fail with an opaque 500 when the bucket was
// missing. Surface the failure instead so it's visible in server logs.
async function ensureBucketExists(supabase: any) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`Gagal memeriksa bucket storage: ${error.message}`);
  }
  const exists = buckets?.some((b: any) => b.id === "meeting-recordings");
  if (!exists) {
    // No explicit fileSizeLimit: an explicit 100MB limit here previously
    // exceeded this Supabase project's global upload limit, which made
    // createBucket() fail every time (silently, before this fix).
    const { error: createError } = await supabase.storage.createBucket("meeting-recordings", {
      public: false,
    });
    if (createError) {
      throw new Error(`Gagal membuat bucket storage: ${createError.message}`);
    }
  }
}

// GET handler: checks recording and transcription status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const supabase = createAdminClient();
  
  // Extract action
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "status") {
    const { data: rec, error } = await supabase
      .from("meeting_recordings")
      .select("status, error_message")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: rec?.status || "idle",
      errorMessage: rec?.error_message || null,
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// POST handler: chunk upload and finalize pipeline
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;
  const supabase = createAdminClient();
  try {
    await ensureBucketExists(supabase);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // A. UPLOAD CHUNK ACTION
  if (action === "chunk") {
    try {
      const formData = await request.formData();
      const chunk = formData.get("chunk") as Blob;
      const index = formData.get("index");

      if (!chunk || index === null) {
        return NextResponse.json({ error: "Missing chunk file or index" }, { status: 400 });
      }

      const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
      const filePath = `${meetingId}/chunk_${index}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("meeting-recordings")
        .upload(filePath, chunkBuffer, {
          contentType: "audio/webm",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // B. FINALIZE ACTION (Merge chunks & start AI/Simulation background pipeline)
  if (action === "finalize") {
    try {
      const body = await request.json();
      const totalChunks = Number(body.totalChunks);

      if (isNaN(totalChunks) || totalChunks <= 0) {
        return NextResponse.json({ error: "Invalid totalChunks" }, { status: 400 });
      }

      // Rekaman live selalu webm, tapi upload file rekaman lama bisa mp3/wav/
      // dll -- mime diteruskan ke Gemini supaya audionya dikenali dengan benar.
      const mimeType =
        typeof body.mimeType === "string" && /^audio\/[\w.+-]+$/.test(body.mimeType)
          ? body.mimeType
          : "audio/webm";

      // 1. Initial insert/update record state to 'transcribing'
      const { data: existingRec } = await supabase
        .from("meeting_recordings")
        .select("id")
        .eq("meeting_id", meetingId)
        .maybeSingle();

      const finalPath = `${meetingId}/final.webm`;

      if (existingRec) {
        await supabase
          .from("meeting_recordings")
          .update({ status: "transcribing", storage_path: finalPath, error_message: null })
          .eq("meeting_id", meetingId);
      } else {
        await supabase
          .from("meeting_recordings")
          .insert({ meeting_id: meetingId, status: "transcribing", storage_path: finalPath });
      }

      // 2. Jalankan pipeline AI setelah respons terkirim. WAJIB lewat after():
      // panggilan fire-and-forget biasa dibekukan Vercel begitu respons keluar,
      // membuat status macet di "transcribing" tanpa error sama sekali.
      after(() => runBackgroundPipeline(meetingId, totalChunks, mimeType));

      return NextResponse.json({ success: true, status: "transcribing" });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Gemini File API: upload resumable + poll sampai ACTIVE.
// Dipakai untuk rekaman besar (>~15MB) yang tidak muat di inline base64.
// Docs: https://ai.google.dev/gemini-api/docs/files
// ---------------------------------------------------------------------------
async function uploadToGeminiFile(buffer: Buffer, mimeType: string, apiKey: string): Promise<string> {
  // 1. Start resumable upload session.
  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(buffer.length),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "meeting-recording" } }),
    },
  );
  if (!startRes.ok) {
    throw new Error(`Gemini File API (start) gagal: ${await startRes.text()}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Gemini File API tidak mengembalikan upload URL.");
  }

  // 2. Upload the actual bytes and finalize.
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(buffer.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: buffer,
  });
  if (!uploadRes.ok) {
    throw new Error(`Gemini File API (upload) gagal: ${await uploadRes.text()}`);
  }
  const uploadJson = await uploadRes.json();
  const file = uploadJson.file;
  if (!file?.uri || !file?.name) {
    throw new Error("Gemini File API tidak mengembalikan file URI.");
  }

  // 3. Poll until state = ACTIVE (rekaman panjang butuh waktu diproses Google).
  let state = file.state;
  let attempts = 0;
  while (state === "PROCESSING" && attempts < 60) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const checkRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${file.name}?key=${apiKey}`,
    );
    if (!checkRes.ok) {
      throw new Error(`Gemini File API (poll status) gagal: ${await checkRes.text()}`);
    }
    const checkJson = await checkRes.json();
    state = checkJson.state;
    attempts++;
  }
  if (state !== "ACTIVE") {
    throw new Error(`Gemini gagal memproses file audio (status akhir: ${state}).`);
  }

  return file.uri;
}

async function deleteGeminiFile(fileUri: string, apiKey: string): Promise<void> {
  // fileUri berbentuk https://generativelanguage.googleapis.com/v1beta/files/xxx
  const match = fileUri.match(/\/(files\/[^/?]+)/);
  if (!match) return;
  await fetch(`https://generativelanguage.googleapis.com/v1beta/${match[1]}?key=${apiKey}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// BACKGROUND WORKER PIPELINE (Whisper -> Claude -> Fonnte)
// ---------------------------------------------------------------------------
async function runBackgroundPipeline(
  meetingId: string,
  totalChunks: number,
  mimeType: string = "audio/webm"
) {
  const supabase = createAdminClient();
  let recordingId = "";

  try {
    // Get recording row ID
    const { data: rec } = await supabase
      .from("meeting_recordings")
      .select("id")
      .eq("meeting_id", meetingId)
      .single();
    
    if (!rec) return;
    recordingId = rec.id;

    // A. MERGE AUDIO CHUNKS IN STORAGE
    const buffers: Buffer[] = [];
    const deletePaths: string[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = `${meetingId}/chunk_${i}.webm`;
      deletePaths.push(chunkPath);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("meeting-recordings")
        .download(chunkPath);

      if (downloadError) {
        throw new Error(`Gagal mendownload chunk ${i}: ${downloadError.message}`);
      }

      const arrBuffer = await fileData.arrayBuffer();
      buffers.push(Buffer.from(arrBuffer));
    }

    // Concatenate chunks
    const finalBuffer = Buffer.concat(buffers);
    const finalPath = `${meetingId}/final.webm`;

    // Upload final consolidated recording
    const { error: finalUploadError } = await supabase.storage
        .from("meeting-recordings")
        .upload(finalPath, finalBuffer, {
          contentType: mimeType,
          upsert: true,
        });

    if (finalUploadError) {
      throw new Error(`Gagal menyimpan rekaman final: ${finalUploadError.message}`);
    }

    // Clean up temporary chunks
    await supabase.storage.from("meeting-recordings").remove(deletePaths);

    // B. AI PIPELINE / SIMULATION
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    let transcriptText = "";
    let aiResults: {
      notulen: string;
      decisions: string[];
      action_items: { title: string; assignee_name: string; due_date: string }[];
    };

    // Query meeting info for context
    const { data: meeting } = await supabase
      .from("meetings")
      .select("title, agenda")
      .eq("id", meetingId)
      .single();

    const meetingTitle = meeting?.title || "Rapat Operasional";
    const meetingAgenda = meeting?.agenda || "Koordinasi rutin divisi.";

    const hasGemini = !!process.env.GEMINI_API_KEY;

    if (hasGemini) {
      // --- GOOGLE GEMINI FLASH FREE PIPELINE ---
      // gemini-1.5-flash sudah deprecated & ditolak untuk API key baru;
      // gemini-2.5-flash adalah pengganti GA-nya di free tier.
      //
      // Audio dikirim lewat Gemini File API (upload terpisah + referensi
      // fileUri), BUKAN inline base64 di body generateContent -- inline data
      // punya batas request ~20MB yang jauh di bawah rekaman rapat panjang
      // (2 jam bisa >100MB, ditambah overhead base64 +33%). File API
      // mendukung sampai 2GB per file / 20GB per project.
      const apiKey = process.env.GEMINI_API_KEY;
      const fileUri = await uploadToGeminiFile(finalBuffer, mimeType, apiKey!);

      // Update status to 'summarizing'
      await supabase
        .from("meeting_recordings")
        .update({ status: "summarizing" })
        .eq("meeting_id", meetingId);

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    file_data: {
                      mime_type: mimeType,
                      file_uri: fileUri
                    }
                  },
                  {
                    text: `Rapat ini berjudul: "${meetingTitle}" dengan agenda: "${meetingAgenda}". Hari ini tanggal ${new Date().toISOString().split("T")[0]}.

Tolong transkripsikan audio rekaman rapat ini secara lengkap ke dalam Bahasa Indonesia, kemudian buat notulensi ringkasnya.

Format keluaran Anda harus berupa JSON valid dengan struktur berikut:
{
  "transcript": "isi transkrip teks lengkap rapat secara detail",
  "notulen": "isi notulen ringkasan rapat berformat Markdown",
  "decisions": ["keputusan penting 1", "keputusan penting 2"],
  "action_items": [
    {
      "title": "judul tugas tindak lanjut",
      "assignee_name": "nama penanggung jawab jika disebutkan, atau kosongkan",
      "due_date": "YYYY-MM-DD"
    }
  ]
}

Pastikan respons Anda HANYA berupa JSON valid tersebut tanpa teks pembuka atau penutup.`
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json"
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API gagal: ${errText}`);
        }

        const resJson = await response.json();
        const textResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
          throw new Error("Gemini API tidak mengembalikan text.");
        }

        const parsedResults = JSON.parse(textResponse);
        transcriptText = parsedResults.transcript || "";
        aiResults = {
          notulen: parsedResults.notulen || "",
          decisions: parsedResults.decisions || [],
          action_items: parsedResults.action_items || []
        };

        // Save transcript
        await supabase.from("transcripts").upsert({
          recording_id: recordingId,
          raw_text: transcriptText,
          provider: "gemini-2.5-flash",
        }, { onConflict: "recording_id" });
      } finally {
        // Bersihkan file di Gemini (kuota project terbatas; auto-expire 48
        // jam juga ada tapi jangan tunggu itu).
        await deleteGeminiFile(fileUri, apiKey!).catch(() => {});
      }

    } else if (hasOpenAI && hasAnthropic) {
      // --- REAL INTEGRATION ---
      // 1. Whisper transcription
      const whisperFormData = new FormData();
      const file = new File([finalBuffer], "audio", { type: mimeType });
      whisperFormData.append("file", file);
      whisperFormData.append("model", "whisper-1");
      whisperFormData.append("language", "id");

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperFormData,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        throw new Error(`Whisper API gagal: ${errText}`);
      }

      const whisperData = await whisperRes.json();
      transcriptText = whisperData.text || "";

      // Save transcript
      await supabase.from("transcripts").upsert({
        recording_id: recordingId,
        raw_text: transcriptText,
        provider: "whisper",
      }, { onConflict: "recording_id" });

      // Update status to 'summarizing'
      await supabase
        .from("meeting_recordings")
        .update({ status: "summarizing" })
        .eq("meeting_id", meetingId);

      // 2. Claude AI structured summary
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: `Berikut adalah transkrip mentah rapat:
"${transcriptText}"

Meeting ini berjudul: "${meetingTitle}" dengan agenda: "${meetingAgenda}".

Tolong buatkan:
1. Ringkasan rapat berformat Markdown (notulen).
2. Daftar keputusan penting (format JSON array of strings).
3. Daftar action items penting (format JSON array of objects dengan kunci: title, assignee_name, due_date berformat YYYY-MM-DD).

Format keluaran Anda harus berupa JSON valid dengan struktur berikut:
{
  "notulen": "isi notulen markdown",
  "decisions": ["keputusan 1", "keputusan 2"],
  "action_items": [{"title": "tugas 1", "assignee_name": "Nama Karyawan", "due_date": "2026-07-15"}]
}
Kembalikan HANYA objek JSON tersebut tanpa teks penjelasan lain. Jika nama karyawan tidak ada di transkrip, kosongkan assignee_name atau pakai 'Belum ditugaskan'.`
            }
          ],
        }),
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        throw new Error(`Claude API gagal: ${errText}`);
      }

      const claudeData = await claudeRes.json();
      const contentText = claudeData.content[0].text;
      aiResults = JSON.parse(contentText);

    } else {
      // --- SIMULATION MODE ---
      // Simulate transcribing (delay 4s)
      await new Promise((resolve) => setTimeout(resolve, 4000));
      
      transcriptText = `[MOCK TRANSCRIPT] Halo semuanya, selamat siang. Terima kasih rekan-rekan dari tim telah hadir di rapat mengenai "${meetingTitle}". Hari ini kita berkumpul untuk membahas agenda kita yaitu "${meetingAgenda}". Terkait bahasan ini, saya harap kita bisa membagi tugas dengan jelas agar proses operasional berjalan lancar. Untuk keputusan rapat hari ini, kita menyepakati dua hal utama. Pertama, semua target disepakati naik 10%. Kedua, jadwal koordinasi mingguan akan digeser ke hari Senin pukul 09.00 pagi. Untuk tindak lanjut, saya minta dicarikan solusi untuk optimasi alur kerja dalam 3 hari ke depan, lalu perwakilan divisi tolong siapkan materi KPI sebelum minggu depan. Sekian rapat hari ini, terima kasih.`;
      
      // Save mock transcript
      await supabase.from("transcripts").upsert({
        recording_id: recordingId,
        raw_text: transcriptText,
        provider: "whisper_simulated",
      }, { onConflict: "recording_id" });

      // Update status to 'summarizing'
      await supabase
        .from("meeting_recordings")
        .update({ status: "summarizing" })
        .eq("meeting_id", meetingId);

      // Simulate summarizing (delay 4s)
      await new Promise((resolve) => setTimeout(resolve, 4500));

      aiResults = {
        notulen: `### Notulen Rapat: ${meetingTitle}\n\n**Agenda:** ${meetingAgenda}\n\n#### Pembahasan Utama:\n1. **Pembukaan**: Rapat dibuka oleh pimpinan dengan menyapa perwakilan divisi.\n2. **Kajian Operasional**: Peninjauan alur kerja divisi dan pemaparan evaluasi berkala.\n3. **Optimalisasi Sistem**: Pembagian tanggung jawab baru untuk meningkatkan efisiensi kerja.\n\n#### Rekomendasi:\n* Karyawan diharapkan berkoordinasi secara proaktif lintas departemen.\n* Laporan bulanan harus divalidasi sebelum diunggah ke dashboard utama.`,
        decisions: [
          "Menyetujui kenaikan target indikator utama sebesar 10% untuk periode berikutnya.",
          "Menggeser jadwal rapat koordinasi mingguan ke hari Senin pukul 09.00 WIB."
        ],
        action_items: [
          {
            title: "Optimasi alur kerja operasional dan mitigasi kendala sistem internal",
            assignee_name: "", // Will be assigned dynamically
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // today + 3 days
          },
          {
            title: "Penyusunan dan validasi metrik target KPI bulanan divisi",
            assignee_name: "", // Will be assigned dynamically
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // today + 7 days
          }
        ]
      };
    }

    // C. SAVE EXTRACTED DATA TO DATABASE (Notulen, Decisions, Action Items)
    // 1. Notulen
    const { data: existingNot } = await supabase
      .from("notulen")
      .select("id")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (existingNot) {
      await supabase
        .from("notulen")
        .update({
          content: aiResults.notulen,
          source: "ai_generated",
          updated_at: new Date().toISOString()
        })
        .eq("meeting_id", meetingId);
    } else {
      await supabase
        .from("notulen")
        .insert({
          meeting_id: meetingId,
          content: aiResults.notulen,
          source: "ai_generated",
        });
    }

    // 2. Decisions
    // Clear old decisions first (overwrite)
    await supabase.from("decisions").delete().eq("meeting_id", meetingId);
    if (aiResults.decisions.length > 0) {
      const decisionRows = aiResults.decisions.map((d) => ({
        meeting_id: meetingId,
        content: d,
        source: "ai_generated",
      }));
      await supabase.from("decisions").insert(decisionRows);
    }

    // 3. Action Items
    // Fetch a staff profile to dynamically assign in simulation if assignee is empty
    const { data: randomProfiles } = await supabase.from("profiles").select("id, full_name").limit(3);
    
    // Clear old action items first
    await supabase.from("action_items").delete().eq("meeting_id", meetingId);
    if (aiResults.action_items.length > 0) {
      const actionItemRows = aiResults.action_items.map((item, idx) => {
        let assigneeId: string | null = null;
        if (item.assignee_name) {
          const matched = randomProfiles?.find(p => p.full_name.toLowerCase().includes(item.assignee_name.toLowerCase()));
          if (matched) assigneeId = matched.id;
        }
        
        // Dynamic fallback assignment in simulation
        if (!assigneeId && randomProfiles && randomProfiles.length > 0) {
          assigneeId = randomProfiles[idx % randomProfiles.length].id;
        }

        return {
          meeting_id: meetingId,
          title: item.title,
          assignee_id: assigneeId,
          due_date: item.due_date || null,
          status: "open",
          source: "ai_generated",
        };
      });
      await supabase.from("action_items").insert(actionItemRows);
    }

    // D. WHATSAPP NOTIFICATION VIA FONNTE
    if (process.env.FONNTE_TOKEN) {
      try {
        const msgText = `🔔 Notulen Rapat Siap!\n\nNotulen untuk rapat "${meetingTitle}" telah selesai diproses oleh AI dan siap untuk direview.\n\nDetail:\n- Keputusan: ${aiResults.decisions.length} butir disepakati\n- Action Items: ${aiResults.action_items.length} tugas dibuat\n\nSilakan buka platform internal untuk melihat dan melakukan edit jika diperlukan.`;
        
        // Fetch leader phone or division staff (Fonnte target)
        // For demonstration, we target a general workspace channel/number or log it.
        // We call Fonnte API POST
        await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: {
            Authorization: process.env.FONNTE_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target: "081234567890", // Placeholder or fetch real number from user profiles
            message: msgText,
          }),
        });
      } catch (err) {
        console.error("Fonnte notification failed:", err);
      }
    }

    // E. UPDATE STATUS TO READY
    await supabase
      .from("meeting_recordings")
      .update({ status: "ready", duration_seconds: totalChunks * 10 }) // estimate duration
      .eq("meeting_id", meetingId);

  } catch (error: any) {
    console.error("AI pipeline background processing error:", error);
    await supabase
      .from("meeting_recordings")
      .update({ status: "failed", error_message: error?.message || "Kesalahan tidak dikenal saat memproses AI" })
      .eq("meeting_id", meetingId);
  }
}
