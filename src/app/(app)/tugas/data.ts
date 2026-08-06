import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import { LEVEL_RANK, type TaskLevel, type TaskStatus } from "@/lib/pm";

// Pemuat data bersama untuk ketiga halaman menu Tugas (Ide, Menunggu
// Persetujuan, Daftar Tugas). Aturan siapa boleh melihat apa ditulis sekali
// di sini supaya ketiga halaman tidak bisa berbeda-beda tanpa sengaja.

export const KOLOM_TUGAS =
  "id, title, description, type, level, status, division_id, assignee_id, created_by, start_date, end_date, points, progress, project_id";

export type Tugas = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  level: string;
  status: string;
  division_id: string | null;
  assignee_id: string | null;
  created_by: string | null;
  start_date: string | null;
  end_date: string | null;
  points: number;
  progress: number;
  project_id: string | null;
};

export type KonteksTugas = {
  isManager: boolean;
  isLeader: boolean;
  isReviewer: boolean;
  divisions: { id: string; name: string }[];
  divisionName: Map<string, string>;
  profileName: Map<string, string>;
  members: { id: string; name: string; divisionId: string | null }[];
};

export async function muatKonteks(user: CurrentUser): Promise<KonteksTugas> {
  const supabase = await createClient();
  const isManager = user.role === "superadmin" || user.role === "admin";
  const isLeader = user.role === "leader";

  const [{ data: divisions }, { data: profiles }] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, division_id").order("full_name"),
  ]);

  return {
    isManager,
    isLeader,
    isReviewer: isManager || isLeader,
    divisions: divisions ?? [],
    divisionName: new Map((divisions ?? []).map((d) => [d.id, d.name])),
    profileName: new Map((profiles ?? []).map((p) => [p.id, p.full_name])),
    // Leader hanya boleh menugaskan orang di divisinya sendiri.
    members: (profiles ?? [])
      .filter((p) => (isLeader ? p.division_id === user.divisionId : true))
      .map((p) => ({ id: p.id, name: p.full_name, divisionId: p.division_id })),
  };
}

// Ambil tugas pada sekumpulan status tertentu, sudah disaring sesuai peran:
// Staff & Leader dibatasi divisinya, Management/Owner melihat semua.
export async function muatTugas(
  user: CurrentUser,
  statuses: TaskStatus[],
  opsi: { divisionId?: string; level?: string; type?: string; cari?: string } = {},
): Promise<Tugas[]> {
  const supabase = await createClient();
  const isManager = user.role === "superadmin" || user.role === "admin";

  let query = supabase.from("pm_tasks").select(KOLOM_TUGAS).in("status", statuses);

  if (!isManager && user.divisionId) query = query.eq("division_id", user.divisionId);
  else if (!isManager && !user.divisionId) query = query.eq("assignee_id", user.id);
  if (isManager && opsi.divisionId) query = query.eq("division_id", opsi.divisionId);

  if (opsi.level) query = query.eq("level", opsi.level);
  if (opsi.type) query = query.eq("type", opsi.type);
  if (opsi.cari) query = query.ilike("title", `%${opsi.cari}%`);

  const { data } = await query;
  // Urut: prioritas tertinggi dulu, lalu tenggat terdekat.
  return ((data ?? []) as Tugas[]).sort((a, b) => {
    const lr = LEVEL_RANK[a.level as TaskLevel] - LEVEL_RANK[b.level as TaskLevel];
    if (lr !== 0) return lr;
    return (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999");
  });
}

// Staff pelaksana tambahan di luar PIC, dikelompokkan per tugas.
export async function muatStaffPelaksana(taskIds: string[]): Promise<Map<string, string[]>> {
  const hasil = new Map<string, string[]>();
  if (taskIds.length === 0) return hasil;

  const supabase = await createClient();
  const { data } = await supabase
    .from("pm_task_staff")
    .select("task_id, user_id")
    .in("task_id", taskIds);

  for (const row of data ?? []) {
    const list = hasil.get(row.task_id) ?? [];
    list.push(row.user_id);
    hasil.set(row.task_id, list);
  }
  return hasil;
}
