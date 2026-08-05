"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  read_at: string | null;
  created_at: string;
};

// Ambil notifikasi terbaru milik user yang sedang login. RLS sudah membatasi
// ke user_id = auth.uid(), tapi filter eksplisit tetap dipasang supaya
// maksudnya jelas dibaca.
export async function getMyNotifications(): Promise<{
  items: NotificationRow[];
  unread: number;
}> {
  const user = await getCurrentUser();
  if (!user) return { items: [], unread: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, link, kind, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Tabel notifications baru ada sejak migrasi 0026 -- kalau migrasi belum
  // dijalankan, jangan sampai seluruh layout ikut error.
  if (error) return { items: [], unread: 0 };

  const items = (data ?? []) as NotificationRow[];
  return { items, unread: items.filter((n) => !n.read_at).length };
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  revalidatePath("/");
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  revalidatePath("/");
}

// Helper dipakai modul lain (rapat, tugas, forum) untuk mengirim notifikasi
// ke banyak orang sekaligus. Diam-diam mengabaikan penerima = pengirim.
export async function notifyUsers(
  userIds: string[],
  payload: { title: string; body?: string; link?: string; kind?: string },
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const targets = [...new Set(userIds)].filter((id) => id && id !== user.id);
  if (targets.length === 0) return;

  const supabase = await createClient();
  await supabase.from("notifications").insert(
    targets.map((uid) => ({
      user_id: uid,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
      kind: payload.kind ?? "info",
      created_by: user.id,
    })),
  );
}
