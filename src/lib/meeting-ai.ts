import type { SupabaseClient } from "@supabase/supabase-js";

// Dipakai bersama oleh pipeline rekaman & "tempel catatan": parsing hasil AI
// dan penyimpanan notulen/keputusan/action items ke database. Server-only.

export type MeetingAiResults = {
  notulen: string;
  decisions: string[];
  action_items: { title: string; assignee_name?: string; due_date?: string }[];
};

// Model kadang membungkus JSON dengan ```json ... ``` walau diminta JSON murni.
function stripCodeFence(text: string): string {
  const match = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : text;
}

// Parse + normalisasi keluaran AI. Lempar Error berbahasa Indonesia kalau
// bentuknya tidak bisa dipakai sama sekali.
export function parseAiResults(text: string): MeetingAiResults & { transcript: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(stripCodeFence(text));
  } catch {
    throw new Error("Hasil AI bukan JSON valid.");
  }
  if (!raw || typeof raw !== "object") throw new Error("Hasil AI tidak berbentuk objek.");
  const obj = raw as Record<string, unknown>;

  const decisions = Array.isArray(obj.decisions)
    ? obj.decisions.filter((d): d is string => typeof d === "string" && d.trim() !== "")
    : [];

  const actionItems = Array.isArray(obj.action_items)
    ? obj.action_items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const it = item as Record<string, unknown>;
        const title = typeof it.title === "string" ? it.title.trim() : "";
        if (!title) return [];
        const dueDate =
          typeof it.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.due_date)
            ? it.due_date
            : undefined;
        return [
          {
            title,
            assignee_name: typeof it.assignee_name === "string" ? it.assignee_name.trim() : undefined,
            due_date: dueDate,
          },
        ];
      })
    : [];

  return {
    transcript: typeof obj.transcript === "string" ? obj.transcript : "",
    notulen: typeof obj.notulen === "string" ? obj.notulen : "",
    decisions,
    action_items: actionItems,
  };
}

// Simpan hasil AI. Hanya keputusan & action item bersumber "ai_generated" yang
// ditimpa -- entri manual atau yang sudah diedit orang tetap aman. Setiap
// error DB dilempar supaya pemanggil bisa menandai proses gagal, bukan
// melapor "sukses" dengan data setengah jadi.
export async function saveMeetingAiResults(
  admin: SupabaseClient,
  meetingId: string,
  results: MeetingAiResults,
  opts: { fallbackAssigneeIds?: string[] } = {},
): Promise<void> {
  const { error: notulenError } = await admin.from("notulen").upsert(
    {
      meeting_id: meetingId,
      content: results.notulen,
      source: "ai_generated",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" },
  );
  if (notulenError) throw new Error(`Gagal menyimpan notulen: ${notulenError.message}`);

  const { error: delDecError } = await admin
    .from("decisions")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("source", "ai_generated");
  if (delDecError) throw new Error(`Gagal menghapus keputusan lama: ${delDecError.message}`);
  if (results.decisions.length > 0) {
    const { error } = await admin.from("decisions").insert(
      results.decisions.map((d) => ({ meeting_id: meetingId, content: d, source: "ai_generated" })),
    );
    if (error) throw new Error(`Gagal menyimpan keputusan: ${error.message}`);
  }

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name");
  if (profilesError) throw new Error(`Gagal membaca profil: ${profilesError.message}`);

  const { error: delAiError } = await admin
    .from("action_items")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("source", "ai_generated");
  if (delAiError) throw new Error(`Gagal menghapus action item lama: ${delAiError.message}`);

  if (results.action_items.length > 0) {
    const fallback = opts.fallbackAssigneeIds ?? [];
    const rows = results.action_items.map((item, idx) => {
      const name = item.assignee_name?.toLowerCase();
      const matched = name
        ? profiles?.find((p) => (p.full_name ?? "").toLowerCase().includes(name))
        : undefined;
      const assigneeId = matched?.id ?? (fallback.length > 0 ? fallback[idx % fallback.length] : null);
      return {
        meeting_id: meetingId,
        title: item.title,
        assignee_id: assigneeId,
        due_date: item.due_date || null,
        status: "open",
        source: "ai_generated",
      };
    });
    const { error } = await admin.from("action_items").insert(rows);
    if (error) throw new Error(`Gagal menyimpan action item: ${error.message}`);
  }
}

export function errorMessage(e: unknown, fallback = "Terjadi kesalahan tidak dikenal."): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
