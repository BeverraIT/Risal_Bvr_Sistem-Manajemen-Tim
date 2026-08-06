import { getCurrentUser } from "@/lib/auth";
import { TaskCard } from "../TaskCard";
import { EmptyState } from "@/components/EmptyState";
import { muatKonteks, muatTugas, muatStaffPelaksana } from "../data";
import { STATUS_MENUNGGU } from "@/lib/pm";
import { ClipboardCheck, Hourglass } from "lucide-react";

// Menu 2 dari 3: Menunggu Persetujuan.
// Berisi ide yang sudah diajukan dan menunggu keputusan. Tombol Approve
// memindahkannya ke Daftar Tugas; Reject membatalkannya.
export default async function PersetujuanPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const ctx = await muatKonteks(user);
  const tugas = await muatTugas(user, STATUS_MENUNGGU);
  const staffByTask = await muatStaffPelaksana(tugas.map((t) => t.id));

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-amber-700 to-rose-700 bg-clip-text text-transparent">
          Menunggu Persetujuan
        </h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          {ctx.isReviewer
            ? "Ide yang sudah diajukan dan menunggu keputusan Anda. Approve akan memindahkannya ke Daftar Tugas."
            : "Ide yang sudah Anda ajukan dan sedang menunggu keputusan atasan."}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-extrabold text-amber-700">
          {tugas.length}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          menunggu keputusan
        </span>
      </div>

      {tugas.length === 0 ? (
        <EmptyState
          icon={ctx.isReviewer ? ClipboardCheck : Hourglass}
          title="Tidak ada yang menunggu persetujuan"
          description={
            ctx.isReviewer
              ? "Semua ide yang diajukan sudah Anda putuskan. Ide baru akan muncul di sini begitu diajukan."
              : "Ide yang Anda ajukan akan muncul di sini sampai atasan memberi keputusan."
          }
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
