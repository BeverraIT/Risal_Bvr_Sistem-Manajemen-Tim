"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { notifyUsers } from "../notifications-actions";

export type ActionState = { error: string | null };

export async function createMeeting(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Judul rapat wajib diisi." };

  const scheduledAt = String(formData.get("scheduled_at") ?? "").trim();
  if (!scheduledAt) return { error: "Tanggal & waktu mulai wajib diisi." };

  const endsAt = String(formData.get("ends_at") ?? "").trim() || null;
  if (endsAt && new Date(endsAt) <= new Date(scheduledAt)) {
    return { error: "Waktu selesai harus setelah waktu mulai." };
  }

  // Peserta dipilih per-orang lintas divisi; divisi bukan lagi field
  // tersendiri di form (chip divisi di pemilih cuma pintasan memilih semua
  // anggotanya). Daftar ini sekaligus menentukan siapa yang boleh membuka
  // rapatnya -- lihat can_view_meeting di migrasi 0026 -- jadi rapat selalu
  // dibuat privat.
  const participantIds = formData
    .getAll("participant_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (participantIds.length === 0) return { error: "Pilih minimal satu peserta rapat." };

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      title,
      visibility: "private",
      scheduled_at: scheduledAt,
      ends_at: endsAt,
      location: String(formData.get("location") ?? "") || null,
      agenda: String(formData.get("agenda") ?? "") || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Penyelenggara selalu ikut jadi peserta, kalau tidak dia sendiri tidak
  // masuk hitungan peserta rapat yang dia buat.
  const semuaPeserta = [...new Set([...participantIds, user.id])];
  const { error: participantError } = await supabase
    .from("meeting_participants")
    .insert(semuaPeserta.map((uid) => ({ meeting_id: meeting.id, user_id: uid })));
  if (participantError) {
    return {
      error: `Rapat tersimpan, tetapi peserta gagal ditambahkan: ${participantError.message}`,
    };
  }

  // Notifikasi ke peserta yang diundang (penyelenggara tidak perlu diberi
  // tahu soal rapat yang baru saja dia buat sendiri).
  await notifyUsers(participantIds, {
    title: "Anda diundang ke rapat",
    body: title,
    link: `/meeting/${meeting.id}`,
    kind: "meeting",
  });

  revalidatePath("/meeting");
  redirect(`/meeting/${meeting.id}`);
}

// Hapus rapat (Owner/Management/Lead) -- mis. rapat yang sudah selesai atau
// dibatalkan. Attendee, notulen, keputusan, action item, dan rekaman ikut
// terhapus (cascade).
export async function deleteMeeting(meetingId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  if (user.role !== "superadmin" && user.role !== "admin" && user.role !== "leader") {
    throw new Error("Hanya Owner, Management, atau Lead yang dapat menghapus rapat.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("meetings").delete().eq("id", meetingId);
  if (error) throw new Error(error.message);

  revalidatePath("/meeting");
  redirect("/meeting");
}

export async function saveNotulen(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const meetingId = String(formData.get("meeting_id"));

  const { error } = await supabase.from("notulen").upsert(
    {
      meeting_id: meetingId,
      content: String(formData.get("content") ?? ""),
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" },
  );

  if (error) return { error: error.message };
  revalidatePath(`/meeting/${meetingId}`);
  return { error: null };
}

export async function addDecision(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const meetingId = String(formData.get("meeting_id"));

  const { error } = await supabase.from("decisions").insert({
    meeting_id: meetingId,
    content: String(formData.get("content")),
  });

  if (error) return { error: error.message };
  revalidatePath(`/meeting/${meetingId}`);
  return { error: null };
}

// Edit keputusan. Menandai source 'ai_edited' kalau aslinya dari AI supaya
// jejak "ini hasil AI yang sudah dikoreksi manusia" tidak hilang.
export async function updateDecision(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const meetingId = String(formData.get("meeting_id"));
  const decisionId = String(formData.get("decision_id"));
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Isi keputusan tidak boleh kosong." };

  const { data: existing } = await supabase
    .from("decisions")
    .select("source")
    .eq("id", decisionId)
    .maybeSingle();

  const { error } = await supabase
    .from("decisions")
    .update({
      content,
      source: existing?.source === "ai_generated" ? "ai_edited" : existing?.source ?? "manual",
      updated_at: new Date().toISOString(),
    })
    .eq("id", decisionId);

  if (error) return { error: error.message };
  revalidatePath(`/meeting/${meetingId}`);
  return { error: null };
}

export async function deleteDecision(meetingId: string, decisionId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("decisions").delete().eq("id", decisionId);
  if (error) throw new Error(error.message);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function addActionItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const meetingId = String(formData.get("meeting_id"));

  // parent_id terisi = action item ini adalah sub-item dari item lain.
  const parentId = String(formData.get("parent_id") ?? "") || null;

  const { data: item, error } = await supabase
    .from("action_items")
    .insert({
      meeting_id: meetingId,
      title: String(formData.get("title")),
      assignee_id: String(formData.get("assignee_id") ?? "") || null,
      due_date: String(formData.get("due_date") ?? "") || null,
      parent_id: parentId,
    })
    .select("id, title, assignee_id")
    .single();

  if (error) return { error: error.message };

  await notifyAssignee(item.assignee_id, item.title, meetingId);

  revalidatePath(`/meeting/${meetingId}`);
  return { error: null };
}

export async function updateActionItem(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createClient();
  const meetingId = String(formData.get("meeting_id"));
  const itemId = String(formData.get("item_id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Judul action item tidak boleh kosong." };

  const { error } = await supabase
    .from("action_items")
    .update({
      title,
      assignee_id: String(formData.get("assignee_id") ?? "") || null,
      due_date: String(formData.get("due_date") ?? "") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath(`/meeting/${meetingId}`);
  return { error: null };
}

// Hapus action item. Sub-item ikut terhapus lewat cascade parent_id.
export async function deleteActionItem(meetingId: string, itemId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("action_items").delete().eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidatePath(`/meeting/${meetingId}`);
}

// Notifikasi in-app untuk orang yang ditugaskan.
async function notifyAssignee(assigneeId: string | null, title: string, meetingId: string) {
  if (!assigneeId) return;
  const user = await getCurrentUser();
  if (!user || assigneeId === user.id) return; // tidak perlu notif ke diri sendiri

  const supabase = await createClient();
  await supabase.from("notifications").insert({
    user_id: assigneeId,
    title: "Action item baru untuk Anda",
    body: title,
    link: `/meeting/${meetingId}`,
    kind: "action_item",
    created_by: user.id,
  });
}

export async function updateActionItemStatus(
  meetingId: string,
  actionItemId: string,
  status: string,
) {
  const supabase = await createClient();
  await supabase
    .from("action_items")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", actionItemId);

  revalidatePath(`/meeting/${meetingId}`);
}
