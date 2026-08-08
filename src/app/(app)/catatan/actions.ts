"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type ActionState = { error: string | null };

function optionalString(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// Posisi item baru = jumlah item (catatan + job) milik user saat ini, jadi
// selalu nongol di bawah daftar prioritas pribadinya sendiri.
async function nextPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const [{ count: noteCount }, { count: jobCount }] = await Promise.all([
    supabase.from("special_notes").select("id", { count: "exact", head: true }).eq("created_by", userId),
    supabase.from("job_list").select("id", { count: "exact", head: true }).eq("created_by", userId),
  ]);
  return (noteCount ?? 0) + (jobCount ?? 0);
}

// ---------------------------------------------------------------------------
// Catatan Khusus
// ---------------------------------------------------------------------------
export async function createNote(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Judul catatan wajib diisi." };

  const supabase = await createClient();
  const position = await nextPosition(supabase, user.id);

  const { error } = await supabase.from("special_notes").insert({
    title,
    content: optionalString(formData.get("content")),
    related_job_id: optionalString(formData.get("related_job_id")),
    is_private: true,
    position,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/catatan");
  return { error: null };
}

export async function deleteNote(noteId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("special_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath("/catatan");
}

// ---------------------------------------------------------------------------
// Job List
// ---------------------------------------------------------------------------
export async function createJob(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Judul job wajib diisi." };

  const supabase = await createClient();
  const position = await nextPosition(supabase, user.id);

  const { error } = await supabase.from("job_list").insert({
    title,
    description: optionalString(formData.get("description")),
    position,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/catatan");
  return { error: null };
}

export async function toggleJobDone(jobId: string, done: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_list").update({ done }).eq("id", jobId);
  if (error) throw new Error(error.message);
  revalidatePath("/catatan");
}

export async function deleteJob(jobId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("job_list").delete().eq("id", jobId);
  if (error) throw new Error(error.message);
  revalidatePath("/catatan");
}

// ---------------------------------------------------------------------------
// Urutan prioritas (drag & drop) -- gabungan catatan + job dalam satu daftar
// per orang. RLS (special_notes_write_own / job_list_write) tetap yang
// menentukan siapa yang benar-benar boleh menggeser baris siapa.
// ---------------------------------------------------------------------------
export async function reorderItems(order: { id: string; kind: "note" | "job" }[]): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    order.map((item, index) =>
      supabase
        .from(item.kind === "note" ? "special_notes" : "job_list")
        .update({ position: index })
        .eq("id", item.id),
    ),
  );
  revalidatePath("/catatan");
}
