import Link from "next/link";
import { TaskForm } from "./TaskForm";
import { TaskFilters } from "./TaskFilters";
import { TaskRow } from "./TaskRow";
import { ActionItemRow } from "./ActionItemRow";
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

// Sub-menu "Daftar Tugas" -- SATU daftar berisi tugas dari modul Tugas dan
// action item hasil rapat. Keduanya sama-sama "tugas yang ada PIC-nya",
// bedanya cuma asal: action item lahir dari rapat (diberi badge "Rapat" +
// tautan ke rapatnya) dan dibaca langsung dari tabel action_items supaya
// statusnya sinkron dua arah dengan halaman rapat.
export default async function TugasPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadTugasContext();
  if (!ctx) return null;
  const {
    user,
    supabase,
    isManager,
    isLeader,
    isReviewer,
    divisionList,
    divisionName,
    profiles,
    profileName,
    members,
  } = ctx;

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

  // Action item tidak punya level/tipe/divisi, jadi begitu salah satu filter
  // khusus-tugas itu dipakai, action item disembunyikan -- kalau tetap
  // ditampilkan hasilnya menyesatkan (seolah lolos filter yang tidak pernah
  // dievaluasi untuknya).
  const taskOnlyFilterActive = Boolean(sp.level || sp.type || sp.status || sp.division);

  let actionItemQuery = supabase
    .from("action_items")
    .select("id, title, due_date, status, assignee_id, meeting_id, meetings(title)")
    .not("meeting_id", "is", null)
    .not("assignee_id", "is", null)
    .neq("status", "done");

  // Cakupan sama seperti daftar tugas: Management/Owner semua, Lead anggota
  // divisinya, Staff miliknya sendiri.
  if (sp.assignee) {
    actionItemQuery = actionItemQuery.eq("assignee_id", sp.assignee);
  } else if (isLeader) {
    const divisionMemberIds = profiles
      .filter((p) => p.division_id === user.divisionId)
      .map((p) => p.id);
    actionItemQuery = actionItemQuery.in("assignee_id", divisionMemberIds);
  } else if (!isManager) {
    actionItemQuery = actionItemQuery.eq("assignee_id", user.id);
  }

  const [{ data: tasksRaw }, { data: actionItemsRaw }] = await Promise.all([
    query,
    taskOnlyFilterActive
      ? Promise.resolve({ data: [] as never[] })
      : actionItemQuery.order("due_date", { nullsFirst: false }),
  ]);

  const tasks = tasksRaw ?? [];
  const actionItems = actionItemsRaw ?? [];

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

  // Satu daftar gabungan. Urutannya tetap seperti sebelumnya -- level
  // (urgent dulu) lalu tenggat terdekat; action item tidak punya level jadi
  // diperlakukan setara "medium".
  const MEDIUM_RANK = LEVEL_RANK.medium;
  const rows = [
    ...tasks.map((t) => ({
      kind: "task" as const,
      id: t.id,
      rank: LEVEL_RANK[t.level as TaskLevel] ?? MEDIUM_RANK,
      due: t.end_date ?? "9999",
      task: t,
    })),
    ...actionItems.map((a) => ({
      kind: "action" as const,
      id: a.id,
      rank: MEDIUM_RANK,
      due: a.due_date ?? "9999",
      item: a,
    })),
  ].sort((a, b) => a.rank - b.rank || a.due.localeCompare(b.due));

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
            Daftar Tugas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Semua tugas tim &mdash; termasuk action item hasil rapat &mdash; beserta status,
            prioritas, dan penanggung jawabnya.
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
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-extrabold text-blue-700">
              {rows.length}
            </span>
          </h2>
          <TaskFilters
            showDivision={isManager}
            divisions={divisionList}
            people={isReviewer ? members : []}
          />
        </div>

        {taskOnlyFilterActive && (
          <p className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
            Action item rapat disembunyikan karena filter status/level/tipe/divisi sedang aktif &mdash;
            action item tidak punya atribut tersebut.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Belum ada tugas yang cocok dengan filter.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) =>
              row.kind === "task" ? (
                <TaskRow
                  key={`task-${row.id}`}
                  task={row.task}
                  divisionName={divisionName}
                  profileName={profileName}
                  staffIds={staffByTask.get(row.id) ?? []}
                  showDivision={isManager}
                  isAssignee={row.task.assignee_id === user.id}
                  isReviewer={isManager || (isLeader && row.task.division_id === user.divisionId)}
                />
              ) : (
                <ActionItemRow key={`action-${row.id}`} item={row.item} profileName={profileName} />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
