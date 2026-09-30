import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { type MeetingAiResults, errorMessage, parseAiResults, saveMeetingAiResults } from "@/lib/meeting-ai";

// Isi notulen/keputusan/action items dari teks catatan rapat yang ditempel
// (untuk rapat lama tanpa rekaman audio). Sinkron, bukan background job:
// ekstraksi teks oleh Gemini Flash cukup cepat, beri ruang sampai 60 detik.
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  const { meetingId } = await params;

  const user = await getCurrentUser();
  if (!user || !["superadmin", "admin", "leader"].includes(user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  // RLS: pastikan user memang boleh melihat rapat ini (rapat privat -> 404).
  const supabase = await createClient();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .select("title, agenda")
    .eq("id", meetingId)
    .maybeSingle();
  if (meetingError) {
    return NextResponse.json({ error: meetingError.message }, { status: 500 });
  }
  if (!meeting) {
    return NextResponse.json({ error: "Rapat tidak ditemukan" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const rawText = typeof body?.text === "string" ? body.text.trim() : "";
  if (rawText.length < 20) {
    return NextResponse.json(
      { error: "Teks catatan terlalu pendek. Tempel isi catatan rapatnya dulu." },
      { status: 400 }
    );
  }
  if (rawText.length > 60000) {
    return NextResponse.json(
      { error: "Teks terlalu panjang (maks 60.000 karakter)." },
      { status: 400 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY belum dikonfigurasi." },
      { status: 500 }
    );
  }

  let aiResults: MeetingAiResults;
  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Rapat ini berjudul: "${meeting.title}" dengan agenda: "${
                  meeting.agenda || "Koordinasi rutin"
                }". Hari ini tanggal ${new Date().toISOString().split("T")[0]}.

Berikut catatan mentah rapat yang ditulis manusia (bisa berantakan, campur singkatan):
"""
${rawText}
"""

Susun catatan tersebut menjadi notulensi yang rapi.

Format keluaran Anda harus berupa JSON valid dengan struktur berikut:
{
  "notulen": "isi notulen ringkasan rapat berformat Markdown",
  "decisions": ["keputusan penting 1", "keputusan penting 2"],
  "action_items": [
    {
      "title": "judul tugas tindak lanjut",
      "assignee_name": "nama penanggung jawab jika disebutkan, atau kosongkan",
      "due_date": "YYYY-MM-DD atau kosongkan jika tidak disebut"
    }
  ]
}

Pastikan respons Anda HANYA berupa JSON valid tersebut tanpa teks pembuka atau penutup.`,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API gagal: ${errText.slice(0, 500)}` },
        { status: 502 }
      );
    }

    const resJson = await response.json();
    const textResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResponse) {
      return NextResponse.json({ error: "Gemini tidak mengembalikan hasil." }, { status: 502 });
    }
    aiResults = parseAiResults(textResponse);
  } catch (e) {
    // Gagal jaringan ke Gemini atau hasil AI tidak bisa di-parse.
    return NextResponse.json({ error: errorMessage(e, "Gagal menghubungi Gemini.") }, { status: 502 });
  }

  // Simpan hasil -- pakai admin client mengikuti pola pipeline rekaman, tapi
  // akses sudah digerbang role + RLS view check di atas.
  try {
    await saveMeetingAiResults(createAdminClient(), meetingId, aiResults);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    counts: { decisions: aiResults.decisions.length, actionItems: aiResults.action_items.length },
  });
}
