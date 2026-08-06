import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { TaskForm } from "./TaskForm";
import { TaskFilters } from "./TaskFilters";
import { TaskCard } from "./TaskCard";
import { EmptyState } from "@/components/EmptyState";
import { muatKonteks, muatTugas, muatStaffPelaksana } from "./data";
import { STATUS_KERJA, STATUS_LABEL, type TaskStatus } from "@/lib/pm";
import { Award, FolderKanban, Target, SearchX } from "lucide-react";

type SearchParams = Promise<{
  status?: string;
  level?: string;
  type?: string;
  division?: string;
}>;

// Menu 3 dari 3: Daftar Tugas.
// Berisi pekerjaan yang sudah disetujui dan sedang berjalan -- Ide dan
// Menunggu Persetujuan punya halamannya sendiri.
export default async function TugasPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) return null;

  const sp = await searchParams;
  const supabase = await createClient();
  const ctx = await muatKonteks(user);

  // Filter status dibatasi ke status kerja saja; kalau isian filternya di luar
  // itu (mis. dari URL lama), abaikan supaya halaman tidak pernah kosong
  // karena alasan yang membingungkan.
  const statusTerpilih =
    sp.status && STATUS_KERJA.includes(sp.status as TaskStatus) ? (sp.status as TaskStatus) : null;

  const [{ data: myPoints }, tugas] = await Promise.all([
    supabase
      .from("pm_user_points")
      .select("total_points, done_count")
      .eq("assignee_id", user.id)
      .maybeSingle(),
    muatTugas(user, statusTerpilih ? [statusTerpilih] : STATUS_KERJA, {
      divisionId: sp.division,
      level: sp.level,
      type: sp.type,
    }),
  ]);
  const staffByTask = await muatStaffPelaksana(tugas.map((t) => t.id));

  const adaFilter = Boolean(sp.status || sp.level || sp.type || sp.division);

  // Ringkasan jumlah per status kerja, biar kondisi tim terbaca sekilas.
  const jumlahPerStatus = STATUS_KERJA.map((s) => ({
    status: s,
    jumlah: tugas.filter((t) => t.status === s).length,
  }));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
            Daftar Tugas
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Pekerjaan yang sudah disetujui dan sedang berjalan. Poin bertambah
            otomatis saat tugas selesai.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {ctx.isManager && (
            <Link
              href="/tugas/proyek"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <FolderKanban className="h-4 w-4" /> Proyek
            </Link>
          )}
          <TaskForm role={user.role} divisions={ctx.divisions} members={ctx.members} />
        </div>
      </div>

      {/* Poin saya */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25">
            <Award className="h-5.5 w-5.5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Poin Saya</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {Math.round((myPoints?.total_points as number) ?? 0)}{" "}
              <span className="text-sm font-medium text-slate-400">poin</span>
            </p>
          </div>
        </div>
        <p className="max-w-xs text-right text-xs text-slate-500">
          {myPoints?.done_count ?? 0} tugas selesai. Poin dibagi rata dengan staff
          pelaksana lain jika ada.
        </p>
      </div>

      {/* Ringkasan per status */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {jumlahPerStatus.map(({ status, jumlah }) => (
          <div
            key={status}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold text-slate-400">{STATUS_LABEL[status]}</p>
            <p className="mt-0.5 text-2xl font-extrabold text-slate-800">{jumlah}</p>
          </div>
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Target className="h-4.5 w-4.5 text-blue-600" />
            <span>Semua Tugas</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">
              {tugas.length}
            </span>
          </h2>
          <TaskFilters
            showDivision={ctx.isManager}
            divisions={ctx.divisions}
            statusOptions={STATUS_KERJA}
          />
        </div>

        {tugas.length === 0 ? (
          adaFilter ? (
            <EmptyState
              icon={SearchX}
              title="Tidak ada tugas yang cocok"
              description="Coba longgarkan filternya, atau kosongkan salah satu pilihan."
              action={
                <Link
                  href="/tugas"
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Hapus semua filter
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={Target}
              title="Belum ada tugas berjalan"
              description="Tugas muncul di sini setelah ide disetujui, atau setelah dibuat langsung oleh Leader/Management."
              action={
                <Link
                  href="/tugas/ide"
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Lihat daftar Ide
                </Link>
              }
            />
          )
        ) : (
          <div className="space-y-3">
            {tugas.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                divisionName={ctx.divisionName}
                profileName={ctx.profileName}
                staffIds={staffByTask.get(t.id) ?? []}
                showDivision={ctx.isManager}
                showProgress
                currentUserId={user.id}
                isManager={ctx.isManager}
                isLeaderOfDivision={ctx.isLeader && t.division_id === user.divisionId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
