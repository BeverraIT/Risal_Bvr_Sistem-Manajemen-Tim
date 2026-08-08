import { redirect } from "next/navigation";
import { TaskRow } from "../TaskRow";
import { loadTugasContext, TASK_COLUMNS } from "../shared";
import { Clock } from "lucide-react";

// Sub-menu "Persetujuan Idea" -- tugas berstatus 'idea' yang diajukan Staff
// dan menunggu disetujui reviewer (Lead/Management/Owner). Staff tidak punya
// akses ke halaman ini.
export default async function ApprovalPage() {
  const ctx = await loadTugasContext();
  if (!ctx) return null;
  const { user, supabase, isManager, isLeader, isReviewer, divisionName, profileName } = ctx;

  if (!isReviewer) redirect("/tugas");

  let query = supabase.from("pm_tasks").select(TASK_COLUMNS).eq("status", "idea");
  if (isLeader && user.divisionId) query = query.eq("division_id", user.divisionId);
  const { data: pendingIdeas } = await query;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-violet-800 to-purple-700 bg-clip-text text-transparent">
          Persetujuan Idea
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tugas yang diajukan Staff dan menunggu persetujuan sebelum masuk daftar tugas berjalan.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Clock className="h-4.5 w-4.5 text-violet-600" />
            <span>Menunggu Persetujuan</span>
          </h2>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-extrabold text-violet-700">
            {(pendingIdeas ?? []).length}
          </span>
        </div>

        {(pendingIdeas ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Tidak ada idea menunggu persetujuan.
          </p>
        ) : (
          <div className="space-y-3">
            {(pendingIdeas ?? []).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                divisionName={divisionName}
                profileName={profileName}
                showDivision={isManager}
                isAssignee={task.assignee_id === user.id}
                isReviewer={isManager || (isLeader && task.division_id === user.divisionId)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
