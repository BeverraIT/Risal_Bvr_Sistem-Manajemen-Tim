import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Building2, ListChecks, NotebookPen, Users2, ChevronRight } from "lucide-react";

// Tingkat 1 dari 3: Divisi.
// Struktur menu Catatan & Job List: Divisi -> Karyawan -> Job List & Notes.
// Sebelumnya semuanya ditumpuk dalam dua tab panjang tanpa pengelompokan,
// jadi sulit melihat siapa mengerjakan apa.
export default async function CatatanPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: divisions }, { data: profiles }, { data: jobs }, { data: notes }] =
    await Promise.all([
      supabase.from("divisions").select("id, name, category").order("name"),
      supabase.from("profiles").select("id, division_id"),
      supabase.from("job_list").select("id, division_id, assignee_id, done"),
      supabase.from("special_notes").select("id, division_id"),
    ]);

  // RLS profiles hanya mengembalikan anggota divisi sendiri untuk Staff dan
  // Leader. Kalau semua divisi tetap ditampilkan, divisi lain akan tampak
  // "0 orang" padahal berisi -- menyesatkan. Jadi non-Management hanya
  // melihat divisinya sendiri, yang memang satu-satunya yang datanya utuh.
  const isManager = user.role === "superadmin" || user.role === "admin";
  const divisiTampil = isManager
    ? (divisions ?? [])
    : (divisions ?? []).filter((d) => d.id === user.divisionId);

  // Anggota dihitung dari profil, bukan dari job -- divisi tanpa job pun
  // tetap muncul supaya tidak ada yang "hilang" dari daftar.
  const perDivisi = divisiTampil.map((d) => {
    const anggota = (profiles ?? []).filter((p) => p.division_id === d.id);
    const anggotaIds = new Set(anggota.map((a) => a.id));
    const jobDivisi = (jobs ?? []).filter(
      (j) => j.division_id === d.id || (j.assignee_id && anggotaIds.has(j.assignee_id)),
    );
    return {
      ...d,
      jumlahAnggota: anggota.length,
      jobAktif: jobDivisi.filter((j) => !j.done).length,
      jumlahNote: (notes ?? []).filter((n) => n.division_id === d.id).length,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-violet-800 to-emerald-700 bg-clip-text text-transparent">
          Catatan &amp; Job List
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Pilih divisi untuk melihat daftar karyawannya, lalu buka satu orang
          untuk melihat job list dan catatan pekerjaannya.
        </p>
      </div>

      {perDivisi.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={isManager ? "Belum ada divisi" : "Anda belum terdaftar di divisi mana pun"}
          description={
            isManager
              ? "Tambahkan divisi lebih dulu di menu Pengaturan."
              : "Hubungi Management agar akun Anda dimasukkan ke divisi, supaya job list dan catatan tim bisa terlihat."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perDivisi.map((d) => (
            <Link
              key={d.id}
              href={`/catatan/${d.id}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-800 transition-colors group-hover:text-violet-700">
                    {d.name}
                  </p>
                  {d.category && (
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {d.category}
                    </p>
                  )}
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Building2 className="h-4.5 w-4.5" />
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Users2 className="h-3.5 w-3.5 text-slate-400" />
                  {d.jumlahAnggota} orang
                </span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5 text-slate-400" />
                  {d.jobAktif} job aktif
                </span>
                <span className="inline-flex items-center gap-1">
                  <NotebookPen className="h-3.5 w-3.5 text-slate-400" />
                  {d.jumlahNote} catatan
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
