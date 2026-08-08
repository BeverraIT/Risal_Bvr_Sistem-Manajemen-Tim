import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

// Data dasar yang dibutuhkan hampir semua sub-halaman Tugas & Poin
// (divisi, profil, peran user). Dipisah ke sini supaya kelima sub-halaman
// tidak menyalin query & turunan map yang sama.
//
// getCurrentUser sendiri sudah di-cache per request (lihat lib/auth.ts),
// jadi memanggil helper ini dari page mana pun tidak menambah round-trip
// untuk identitas user.
export async function loadTugasContext() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user) return null;

  const isManager = user.role === "superadmin" || user.role === "admin";
  const isLeader = user.role === "leader";

  const [{ data: divisions }, { data: profiles }] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, division_id"),
  ]);

  const divisionList = divisions ?? [];

  return {
    user,
    supabase,
    isManager,
    isLeader,
    isReviewer: isManager || isLeader,
    divisionList,
    profiles: profiles ?? [],
    divisionName: new Map(divisionList.map((d) => [d.id, d.name])),
    profileName: new Map((profiles ?? []).map((p) => [p.id, p.full_name])),
    // Anggota yang boleh dipilih/disaring: Lead dibatasi divisinya sendiri.
    members: (profiles ?? [])
      .filter((p) => (isLeader ? p.division_id === user.divisionId : true))
      .map((p) => ({ id: p.id, name: p.full_name, divisionId: p.division_id })),
  };
}

// Kolom pm_tasks yang dipakai TaskRow -- disatukan supaya tidak gampang
// meleset antar halaman.
export const TASK_COLUMNS =
  "id, title, description, type, level, status, division_id, assignee_id, start_date, end_date, points, project_id";
