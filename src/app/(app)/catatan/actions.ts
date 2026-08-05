"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { notifyUsers } from "../notifications-actions";

export type ActionState = { error: string | null };

function optionalString(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
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
  const { error } = await supabase.from("special_notes").insert({
    title,
    content: optionalString(formData.get("content")),
    division_id: optionalString(formData.get("division_id")),
    // Default privat: catatan khusus biasanya untuk diri sendiri.
    is_private: formData.get("is_private") !== "0",
    created_by: user.id,
  });

  if (error) return { error: error.message };
  revalidatePath("/catatan");
  return { error: null };
}

export async function updateNote(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Judul catatan wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("special_notes")
    .update({
      title,
      content: optionalString(formData.get("content")),
      is_private: formData.get("is_private") !== "0",
    })
    .eq("id", String(formData.get("note_id")));

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

  const assigneeId = optionalString(formData.get("assignee_id"));
  const supabase = await createClient();

  const { data: job, error } = await supabase
    .from("job_list")
    .insert({
      title,
      description: optionalString(formData.get("description")),
      assignee_id: assigneeId,
      division_id: optionalString(formData.get("division_id")),
      due_date: optionalString(formData.get("due_date")),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (assigneeId) {
    await notifyUsers([assigneeId], {
      title: "Job baru untuk Anda",
      body: title,
      link: "/catatan?tab=job",
      kind: "task",
    });
  }

  void job;
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
