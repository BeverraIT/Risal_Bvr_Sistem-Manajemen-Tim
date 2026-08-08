import Link from "next/link";
import { TaskForm } from "./TaskForm";
import { TaskFilters } from "./TaskFilters";
import { TaskRow } from "./TaskRow";
import { loadTugasContext, TASK_COLUMNS } from "./shared";
import { LEVEL_RANK, type TaskLevel } from "@/lib/pm";
import { Target, FolderKanban } from "lucide-react";

type SearchParams = Promise<{
  status?: string;
  level?: string;
  type?: string;
  division?: string;
  assignee?: string;
}>;

// Sub-menu "Daftar Tugas" -- khusus daftar tugas + filternya. Poin Saya,
// Persetujuan Idea, dan Action Item Rapat masing-masing punya halaman
// sendiri supaya satu halaman tidak menumpuk beda fungsi.
export default async function TugasPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadTugasContext();
  if (!ctx) return null;
  const { user, supabase, isManager, isLeader, isReviewer, divisionList, divisionName, profileName, members } = ctx;

  const sp = await searchParams;

  let query = supabase.from("pm_tasks").select(TASK_COLUMNS);

  // Scope per peran: Staff & Lead dibatasi divisinya; Management/Owner semua.
  if (!isManager && user.divisionId) query = query.eq("division_id", user.divisionId);
  else if (!isManager && !user.divisionId) query = query.eq("assignee_id", user.id);
  if (isManager && sp.division) query = query.eq("division_id", sp.division);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.level) query = query.eq("level", sp.level);
  if (sp.type) query = query.eq("type", sp.type);
  if (sp.assignee) query = query.eq("assignee_id", sp.assignee);

  const { data: tasksRaw } = await query;
  const tasks = (tasksRaw ?? []).sort((a, b) => {
    // Urut: level (urgent dulu), lalu end_date terdekat.
    const lr = LEVEL_RANK[a.level as TaskLevel] - LEVEL_RANK[b.level as TaskLevel];
    if (lr !== 0) return lr;
    return (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999");
  });

  // Staff pelaksana per tugas (di luar PIC).
  const taskIds = tasks.map((t) => t.id);
  const { data: taskStaffRaw } = taskIds.length
    ? await supabase.from("pm_task_staff").select("task_id, user_id").in("task_id", taskIds)
    : { data: [] as { task_id: string; user_id: string }[] };
  const staffByTask = new Map<string, string[]>();
  for (const row of taskStaffRaw ?? []) {
    const list = staffByTask.get(row.task_id) ?? [];
    list.push(row.user_id);
    staffByTask.set(row.task_id, list);
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
            Daftar Tugas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Semua tugas tim beserta status, prioritas, dan penanggung jawabnya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Link
              href="/tugas/proyek"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
            >
              <FolderKanban className="h-4 w-4" /> Proyek
            </Link>
          )}
          <TaskForm role={user.role} divisions={divisionList} members={members} />
        </div>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Target className="h-4.5 w-4.5 text-blue-600" />
            <span>Daftar Tugas</span>
          </h2>
          <TaskFilters
            showDivision={isManager}
            divisions={divisionList}
            people={isReviewer ? members : []}
          />
        </div>

        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Belum ada tugas yang cocok dengan filter.
          </p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                divisionName={divisionName}
                profileName={profileName}
                staffIds={staffByTask.get(task.id) ?? []}
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
