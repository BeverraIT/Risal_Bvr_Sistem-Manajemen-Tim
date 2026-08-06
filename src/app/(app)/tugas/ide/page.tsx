import { getCurrentUser } from "@/lib/auth";
import { TaskForm } from "../TaskForm";
import { TaskCard } from "../TaskCard";
import { EmptyState } from "@/components/EmptyState";
import { muatKonteks, muatTugas, muatStaffPelaksana } from "../data";
import { STATUS_IDE } from "@/lib/pm";
import { Lightbulb } from "lucide-react";

// Menu 1 dari 3: Ide.
// Tempat menampung usulan, improvement, dan request yang BELUM jadi tugas.
// Dari sini isinya bisa diajukan ke Menunggu Persetujuan lewat tombol Ajukan
// di tiap kartu.
export default async function IdePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const ctx = await muatKonteks(user);
  const tugas = await muatTugas(user, STATUS_IDE);
  const staffByTask = await muatStaffPelaksana(tugas.map((t) => t.id));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-violet-800 to-blue-700 bg-clip-text text-transparent">
            Ide
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Kumpulan usulan, ide perbaikan, dan permintaan yang belum menjadi
            tugas. Kalau sudah matang, ajukan agar ditinjau atasan.
          </p>
        </div>
        <TaskForm role={user.role} divisions={ctx.divisions} members={ctx.members} />
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-extrabold text-violet-700">
          {tugas.length}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          ide tersimpan
        </span>
      </div>

      {tugas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Belum ada ide"
          description="Punya usulan perbaikan atau permintaan? Tambahkan di sini dulu. Belum akan jadi tugas sampai kamu ajukan dan disetujui."
        />
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
              currentUserId={user.id}
              isManager={ctx.isManager}
              isLeaderOfDivision={ctx.isLeader && t.division_id === user.divisionId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
