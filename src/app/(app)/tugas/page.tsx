import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { TaskForm } from "./TaskForm";
import { TaskFilters } from "./TaskFilters";
import { TaskStatusControl } from "./TaskStatusControl";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  TYPE_LABEL,
  TYPE_COLOR,
  LEVEL_LABEL,
  LEVEL_COLOR,
  LEVEL_RANK,
  type TaskLevel,
  type TaskStatus,
  type TaskType,
} from "@/lib/pm";
import { Award, FolderKanban, Target, Clock } from "lucide-react";

type SearchParams = Promise<{
  status?: string;
  level?: string;
  type?: string;
  division?: string;
}>;

export default async function TugasPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user) return null;

  const sp = await searchParams;
  const isManager = user.role === "superadmin" || user.role === "admin";
  const isLeader = user.role === "leader";
  const isReviewer = isManager || isLeader;

  // --- Data dasar (divisi, profil) ---
  const [{ data: divisions }, { data: profiles }, { data: myPoints }] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, division_id"),
    supabase.from("pm_user_points").select("total_points, done_count").eq("assignee_id", user.id).maybeSingle(),
  ]);
  const divisionList = divisions ?? [];
  const divisionName = new Map(divisionList.map((d) => [d.id, d.name]));
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Anggota untuk form assignee.
  const members = (profiles ?? [])
    .filter((p) => (isLeader ? p.division_id === user.divisionId : true))
    .map((p) => ({ id: p.id, name: p.full_name, divisionId: p.division_id }));

  // --- Query list tugas dengan filter ---
  let query = supabase
    .from("pm_tasks")
    .select(
      "id, title, description, type, level, status, division_id, assignee_id, start_date, end_date, points, project_id",
    );

  // Scope per peran: Staff & Lead dibatasi divisinya; Management/Owner semua.
  if (!isManager && user.divisionId) query = query.eq("division_id", user.divisionId);
  else if (!isManager && !user.divisionId) query = query.eq("assignee_id", user.id);
  if (isManager && sp.division) query = query.eq("division_id", sp.division);

  if (sp.status) query = query.eq("status", sp.status);
  if (sp.level) query = query.eq("level", sp.level);
  if (sp.type) query = query.eq("type", sp.type);

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

  // Idea menunggu persetujuan (khusus reviewer, di luar filter).
  let pendingIdeas: typeof tasks = [];
  if (isReviewer) {
    let iq = supabase
      .from("pm_tasks")
      .select(
        "id, title, description, type, level, status, division_id, assignee_id, start_date, end_date, points, project_id",
      )
      .eq("status", "idea");
    if (isLeader && user.divisionId) iq = iq.eq("division_id", user.divisionId);
    const { data } = await iq;
    pendingIdeas = data ?? [];
  }

  const renderTaskRow = (task: (typeof tasks)[number]) => {
    const isAssignee = task.assignee_id === user.id;
    const reviewerForThis = isManager || (isLeader && task.division_id === user.divisionId);
    return (
      <div
        key={task.id}
        className="rounded-xl border border-slate-100 p-4 transition-colors hover:border-slate-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">{task.title}</h3>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[task.status as TaskStatus]}`}>
                {STATUS_LABEL[task.status as TaskStatus]}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLOR[task.level as TaskLevel]}`}>
                {LEVEL_LABEL[task.level as TaskLevel]}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLOR[task.type as TaskType]}`}>
                {TYPE_LABEL[task.type as TaskType]}
              </span>
            </div>
            {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
            <p className="text-xs text-slate-400">
              {isManager && (
                <>
                  {divisionName.get(task.division_id ?? "") ?? "-"}
                  {" · "}
                </>
              )}
              PIC: <span className="font-medium text-slate-600">{task.assignee_id ? profileName.get(task.assignee_id) ?? "-" : "Belum ditugaskan"}</span>
              {(staffByTask.get(task.id)?.length ?? 0) > 0 && (
                <>
                  {" · "}
                  Staff: <span className="font-medium text-slate-600">
                    {staffByTask.get(task.id)!.map((uid) => profileName.get(uid) ?? "-").join(", ")}
                  </span>
                </>
              )}
              {" · "}
              {task.points} poin
              {task.end_date && (
                <>
                  {" · "}
                  Due {new Date(task.end_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </>
              )}
            </p>
            {task.project_id && (
              <Link
                href={`/tugas/proyek/${task.project_id}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
              >
                <FolderKanban className="h-3 w-3" /> Lihat proyek
              </Link>
            )}
          </div>
          <TaskStatusControl
            taskId={task.id}
            status={task.status as TaskStatus}
            isAssignee={isAssignee}
            isReviewer={reviewerForThis}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
            Tugas &amp; Poin
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola tugas tim, pantau progres, dan kumpulkan poin dari tugas yang selesai.
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
          {myPoints?.done_count ?? 0} tugas selesai. Poin bertambah otomatis saat tugas berstatus Done, dibagi rata
          dengan staff pelaksana lain jika ada.
        </p>
      </div>

      {/* Perlu persetujuan (reviewer) */}
      {isReviewer && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Clock className="h-4.5 w-4.5 text-violet-600" />
              <span>Idea Menunggu Persetujuan</span>
            </h2>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-extrabold text-violet-700">
              {pendingIdeas.length}
            </span>
          </div>
          {pendingIdeas.length === 0 ? (
            <p className="py-4 text-center text-sm italic text-slate-400">Tidak ada idea menunggu persetujuan.</p>
          ) : (
            <div className="space-y-3">{pendingIdeas.map(renderTaskRow)}</div>
          )}
        </section>
      )}

      {/* List tugas + filter */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <Target className="h-4.5 w-4.5 text-blue-600" />
            <span>Daftar Tugas</span>
          </h2>
          <TaskFilters showDivision={isManager} divisions={divisionList} />
        </div>

        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Belum ada tugas yang cocok dengan filter.
          </p>
        ) : (
          <div className="space-y-3">{tasks.map(renderTaskRow)}</div>
        )}
      </section>
    </div>
  );
}
