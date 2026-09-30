"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { THREAD_CATEGORIES, type ThreadCategory } from "@/lib/pm";

export type ActionState = { error: string | null };

export async function createCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const divisionId = String(formData.get("division_id") ?? "") || null;

  const { error } = await supabase.from("forum_categories").insert({
    name: String(formData.get("name")),
    division_id: divisionId,
  });

  if (error) return { error: error.message };
  revalidatePath("/forum");
  return { error: null };
}

export async function createThread(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Judul thread wajib diisi." };

  const catRaw = String(formData.get("topic_category") ?? "idea");
  const topicCategory: ThreadCategory = (THREAD_CATEGORIES as string[]).includes(catRaw)
    ? (catRaw as ThreadCategory)
    : "idea";
  const content = String(formData.get("content") ?? "");

  // Type Thread: Internal = privat ke divisi yang dipilih (default divisi
  // pembuat); Global = publik.
  const threadType = String(formData.get("thread_type") ?? "global");
  const isInternal = threadType === "internal";
  const visibility = isInternal ? "private" : "public";

  // Divisi tujuan: Management/Owner boleh lebih dari satu (division_ids);
  // role lain memakai satu pilihan (division_id) atau divisinya sendiri.
  const multi = formData
    .getAll("division_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const single = String(formData.get("division_id") ?? "") || null;
  const internalDivisions =
    multi.length > 0 ? multi : single ? [single] : user.divisionId ? [user.divisionId] : [];

  if (isInternal && internalDivisions.length === 0) {
    return { error: "Pilih minimal satu divisi untuk thread Internal." };
  }

  const { data: thread, error } = await supabase
    .from("forum_threads")
    .insert({ title, topic_category: topicCategory, created_by: user.id, visibility })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Thread internal hanya terlihat divisi-divisi yang dipilih.
  if (isInternal && internalDivisions.length > 0) {
    const { error: divisionError } = await supabase
      .from("forum_thread_divisions")
      .insert(internalDivisions.map((divId) => ({ thread_id: thread.id, division_id: divId })));
    if (divisionError) return { error: divisionError.message };
  }

  if (content.trim()) {
    const { error: postError } = await supabase
      .from("forum_posts")
      .insert({ thread_id: thread.id, author_id: user.id, content });
    if (postError) {
      return { error: `Thread dibuat, tetapi isi pesan pertama gagal disimpan: ${postError.message}` };
    }
  }

  revalidatePath("/forum");
  redirect(`/forum/${thread.id}`);
}

// Hapus thread (Owner/Management/Lead). Post & mapping divisi ikut terhapus
// (cascade); keputusan yang lahir dari thread tetap ada (thread_id di-null-kan).
export async function deleteThread(threadId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "superadmin" && user.role !== "admin" && user.role !== "leader") {
    throw new Error("Hanya Owner, Management, atau Lead yang dapat menghapus thread.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("forum_threads").delete().eq("id", threadId);
  if (error) throw new Error(error.message);

  revalidatePath("/forum");
  redirect("/forum");
}

export async function createPost(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const threadId = String(formData.get("thread_id"));
  const content = String(formData.get("content"));

  const { error } = await supabase
    .from("forum_posts")
    .insert({ thread_id: threadId, author_id: user.id, content });

  if (error) return { error: error.message };
  revalidatePath(`/forum/${threadId}`);
  return { error: null };
}
