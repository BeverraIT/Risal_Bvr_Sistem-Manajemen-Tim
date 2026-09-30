import { after, type NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  type MeetingAiResults,
  errorMessage,
  parseAiResults,
  saveMeetingAiResults,
} from "@/lib/meeting-ai";

// Pipeline AI berjalan setelah respons finalize dikirim (via after()); beri
// waktu cukup untuk transkripsi+ringkasan rekaman panjang oleh Gemini.
// 300 adalah batas MAKSIMUM Vercel untuk paket Hobby (project ini saat ini
// di Hobby -- deploy GAGAL kalau nilai ini di atas 300, "invalid_max_duration").
// Paket Pro/Enterprise bisa sampai 800/900s -- kalau rekaman 2 jam+ ternyata
// masih timeout di produksi, upgrade paket Vercel dulu baru naikkan nilai ini.
export const maxDuration = 300;

// Chunk dikirim tiap ~10 detik; 2000 chunk ~ 5,5 jam -- jauh di atas rapat
// normal, sekadar pagar supaya index/totalChunks tidak bisa sembarangan.
const MAX_CHUNKS = 2000;

// Route ini memakai admin client (bypass RLS) untuk storage & pipeline, jadi
// gerbang ini WAJIB: user harus login dan bisa melihat rapatnya (dicek lewat
// RLS sesi login). Merekam/finalize dibatasi ke role yang boleh mengedit
// notulen -- sama seperti tombol rekam di halaman rapat.
async function authorize(
  meetingId: string,
  { requireEditor }: { requireEditor: boolean },
): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }
  if (requireEditor && !["superadmin", "admin", "leader"].includes(user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("id")
    .eq("id", meetingId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!meeting) {
    return NextResponse.json({ error: "Rapat tidak ditemukan" }, { status: 404 });
  }
  return null;
}

// Helper to check/create private bucket "meeting-recordings".
// Migration 0021 already creates this bucket directly via SQL, so this is
// just a safety net -- but errors here used to be swallowed silently, which
// made every chunk upload fail with an opaque 500 when the bucket was
// missing. Surface the failure instead so it's visible in server logs.
async function ensureBucketExists(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    throw new Error(`Gagal memeriksa bucket storage: ${error.message}`);
  }
  const exists = buckets?.some((b) => b.id === "meeting-recordings");
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
  const denied = await authorize(meetingId, { requireEditor: false });
  if (denied) return denied;
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
  const denied = await authorize(meetingId, { requireEditor: true });
  if (denied) return denied;
  const supabase = createAdminClient();
  try {
    await ensureBucketExists(supabase);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // A. UPLOAD CHUNK ACTION
  if (action === "chunk") {
    try {
      const formData = await request.formData();
      const chunk = formData.get("chunk");
      // index masuk ke path storage -- wajib bilangan bulat supaya tidak bisa
      // dipakai menulis ke path lain (mis. "../rapat-lain/final").
      const index = Number(formData.get("index"));

      if (!(chunk instanceof Blob) || !Number.isInteger(index) || index < 0 || index >= MAX_CHUNKS) {
        return NextResponse.json({ error: "Chunk atau index tidak valid" }, { status: 400 });
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
    } catch (e) {
      return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
  }

  // B. FINALIZE ACTION (Merge chunks & start AI/Simulation background pipeline)
  if (action === "finalize") {
    try {
      const body = await request.json().catch(() => null);
      const totalChunks = Number(body?.totalChunks);

      if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_CHUNKS) {
        return NextResponse.json({ error: "totalChunks tidak valid" }, { status: 400 });
      }

      // Rekaman live selalu webm, tapi upload file rekaman lama bisa mp3/wav/
      // dll -- mime diteruskan ke Gemini supaya audionya dikenali dengan benar.
      const mimeType =
        typeof body.mimeType === "string" && /^audio\/[\w.+-]+$/.test(body.mimeType)
          ? body.mimeType
          : "audio/webm";

      // 1. Initial insert/update record state to 'transcribing'
      const { data: existingRec, error: recError } = await supabase
        .from("meeting_recordings")
        .select("id")
        .eq("meeting_id", meetingId)
        .maybeSingle();
      if (recError) {
        return NextResponse.json({ error: recError.message }, { status: 500 });
      }

      const finalPath = `${meetingId}/final.webm`;

      const { error: writeError } = existingRec
        ? await supabase
            .from("meeting_recordings")
            .update({ status: "transcribing", storage_path: finalPath, error_message: null })
            .eq("meeting_id", meetingId)
        : await supabase
            .from("meeting_recordings")
            .insert({ meeting_id: meetingId, status: "transcribing", storage_path: finalPath });
      if (writeError) {
        return NextResponse.json({ error: writeError.message }, { status: 500 });
      }

      // 2. Jalankan pipeline AI setelah respons terkirim. WAJIB lewat after():
      // panggilan fire-and-forget biasa dibekukan Vercel begitu respons keluar,
      // membuat status macet di "transcribing" tanpa error sama sekali.
      after(() => runBackgroundPipeline(meetingId, totalChunks, mimeType));

      return NextResponse.json({ success: true, status: "transcribing" });
    } catch (e) {
      return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
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
    body: new Uint8Array(buffer),
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
// BACKGROUND WORKER PIPELINE (Gemini | Whisper+Claude | simulasi -> Fonnte)
// ---------------------------------------------------------------------------
async function runBackgroundPipeline(
  meetingId: string,
  totalChunks: number,
  mimeType: string = "audio/webm"
) {
  const supabase = createAdminClient();

  try {
    // Get recording row ID
    const { data: rec, error: recError } = await supabase
      .from("meeting_recordings")
      .select("id")
      .eq("meeting_id", meetingId)
      .single();

    if (recError || !rec) {
      throw new Error(`Data rekaman tidak ditemukan: ${recError?.message ?? "kosong"}`);
    }
    const recordingId: string = rec.id;

    const setStatus = async (status: string) => {
      const { error } = await supabase
        .from("meeting_recordings")
        .update({ status })
        .eq("meeting_id", meetingId);
      if (error) throw new Error(`Gagal memperbarui status rekaman: ${error.message}`);
    };

    const saveTranscript = async (rawText: string, provider: string) => {
      const { error } = await supabase
        .from("transcripts")
        .upsert({ recording_id: recordingId, raw_text: rawText, provider }, { onConflict: "recording_id" });
      if (error) throw new Error(`Gagal menyimpan transkrip: ${error.message}`);
    };

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

    // Clean up temporary chunks (best-effort -- rekaman final sudah aman).
    const { error: cleanupError } = await supabase.storage
      .from("meeting-recordings")
      .remove(deletePaths);
    if (cleanupError) console.error("Gagal menghapus chunk sementara:", cleanupError.message);

    // B. AI PIPELINE / SIMULATION
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

    let transcriptText = "";
    let aiResults: MeetingAiResults;
    // Hanya mode simulasi yang membagi action item ke profil sembarang; hasil
    // AI sungguhan dibiarkan "Belum ditugaskan" kalau nama PIC tidak cocok.
    let fallbackAssigneeIds: string[] = [];

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
      const apiKey = process.env.GEMINI_API_KEY!;
      const fileUri = await uploadToGeminiFile(finalBuffer, mimeType, apiKey);

      await setStatus("summarizing");

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
          throw new Error(`Gemini API gagal: ${errText.slice(0, 500)}`);
        }

        const resJson = await response.json();
        const textResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
          throw new Error("Gemini API tidak mengembalikan text.");
        }

        const parsed = parseAiResults(textResponse);
        transcriptText = parsed.transcript;
        aiResults = parsed;

        await saveTranscript(transcriptText, "gemini-2.5-flash");
      } finally {
        // Bersihkan file di Gemini (kuota project terbatas; auto-expire 48
        // jam juga ada tapi jangan tunggu itu).
        await deleteGeminiFile(fileUri, apiKey).catch(() => {});
      }

    } else if (hasOpenAI && hasAnthropic) {
      // --- REAL INTEGRATION ---
      // 1. Whisper transcription
      const whisperFormData = new FormData();
      const file = new File([new Uint8Array(finalBuffer)], "audio", { type: mimeType });
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
        throw new Error(`Whisper API gagal: ${errText.slice(0, 500)}`);
      }

      const whisperData = await whisperRes.json();
      transcriptText = whisperData.text || "";

      await saveTranscript(transcriptText, "whisper");
      await setStatus("summarizing");

      // 2. Claude AI structured summary
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
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
        throw new Error(`Claude API gagal: ${errText.slice(0, 500)}`);
      }

      const claudeData = await claudeRes.json();
      const contentText = claudeData.content?.find(
        (block: { type?: string }) => block.type === "text",
      )?.text;
      if (!contentText) {
        throw new Error("Claude API tidak mengembalikan text.");
      }
      aiResults = parseAiResults(contentText);

    } else {
      // --- SIMULATION MODE ---
      // Simulate transcribing (delay 4s)
      await new Promise((resolve) => setTimeout(resolve, 4000));

      transcriptText = `[MOCK TRANSCRIPT] Halo semuanya, selamat siang. Terima kasih rekan-rekan dari tim telah hadir di rapat mengenai "${meetingTitle}". Hari ini kita berkumpul untuk membahas agenda kita yaitu "${meetingAgenda}". Terkait bahasan ini, saya harap kita bisa membagi tugas dengan jelas agar proses operasional berjalan lancar. Untuk keputusan rapat hari ini, kita menyepakati dua hal utama. Pertama, semua target disepakati naik 10%. Kedua, jadwal koordinasi mingguan akan digeser ke hari Senin pukul 09.00 pagi. Untuk tindak lanjut, saya minta dicarikan solusi untuk optimasi alur kerja dalam 3 hari ke depan, lalu perwakilan divisi tolong siapkan materi KPI sebelum minggu depan. Sekian rapat hari ini, terima kasih.`;

      await saveTranscript(transcriptText, "whisper_simulated");
      await setStatus("summarizing");

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
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // today + 3 days
          },
          {
            title: "Penyusunan dan validasi metrik target KPI bulanan divisi",
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] // today + 7 days
          }
        ]
      };

      const { data: sampleProfiles } = await supabase.from("profiles").select("id").limit(3);
      fallbackAssigneeIds = (sampleProfiles ?? []).map((p) => p.id);
    }

    // C. SAVE EXTRACTED DATA TO DATABASE (Notulen, Decisions, Action Items)
    await saveMeetingAiResults(supabase, meetingId, aiResults, { fallbackAssigneeIds });

    // D. WHATSAPP NOTIFICATION VIA FONNTE
    // Nomor tujuan WAJIB dari env FONNTE_TARGET (nomor/grup WA internal).
    // Dulu ada nomor placeholder hardcoded -- ringkasan rapat internal
    // terkirim ke nomor asing. Tanpa FONNTE_TARGET, notifikasi dilewati.
    const fonnteTarget = process.env.FONNTE_TARGET;
    if (process.env.FONNTE_TOKEN && fonnteTarget) {
      try {
        const msgText = `🔔 Notulen Rapat Siap!\n\nNotulen untuk rapat "${meetingTitle}" telah selesai diproses oleh AI dan siap untuk direview.\n\nDetail:\n- Keputusan: ${aiResults.decisions.length} butir disepakati\n- Action Items: ${aiResults.action_items.length} tugas dibuat\n\nSilakan buka platform internal untuk melihat dan melakukan edit jika diperlukan.`;

        const fonnteRes = await fetch("https://api.fonnte.com/send", {
          method: "POST",
          headers: {
            Authorization: process.env.FONNTE_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ target: fonnteTarget, message: msgText }),
        });
        if (!fonnteRes.ok) {
          console.error("Fonnte notification failed:", fonnteRes.status, await fonnteRes.text());
        }
      } catch (err) {
        console.error("Fonnte notification failed:", err);
      }
    }

    // E. UPDATE STATUS TO READY
    const { error: readyError } = await supabase
      .from("meeting_recordings")
      .update({ status: "ready", duration_seconds: totalChunks * 10 }) // estimate duration
      .eq("meeting_id", meetingId);
    if (readyError) throw new Error(`Gagal menandai rekaman selesai: ${readyError.message}`);
  } catch (error) {
    console.error("AI pipeline background processing error:", error);
    const { error: failError } = await supabase
      .from("meeting_recordings")
      .update({
        status: "failed",
        error_message: errorMessage(error, "Kesalahan tidak dikenal saat memproses AI"),
      })
      .eq("meeting_id", meetingId);
    if (failError) console.error("Gagal menandai rekaman gagal:", failError.message);
  }
}
