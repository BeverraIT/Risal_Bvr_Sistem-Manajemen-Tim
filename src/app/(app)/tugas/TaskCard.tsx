import Link from "next/link";
import { TaskStatusControl } from "./TaskStatusControl";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  TYPE_LABEL,
  TYPE_COLOR,
  LEVEL_LABEL,
  LEVEL_COLOR,
  type TaskLevel,
  type TaskStatus,
  type TaskType,
} from "@/lib/pm";
import { FolderKanban, CalendarClock, User2, Users } from "lucide-react";
import type { Tugas } from "./data";

// Satu kartu tugas, dipakai sama persis di ketiga halaman menu Tugas supaya
// tampilan dan informasinya tidak berbeda-beda antar halaman.
export function TaskCard({
  task,
  divisionName,
  profileName,
  staffIds,
  showDivision,
  showProgress = false,
  currentUserId,
  isManager,
  isLeaderOfDivision,
}: {
  task: Tugas;
  divisionName: Map<string, string>;
  profileName: Map<string, string>;
  staffIds: string[];
  showDivision: boolean;
  showProgress?: boolean;
  currentUserId: string;
  isManager: boolean;
  isLeaderOfDivision: boolean;
}) {
  const isAssignee = task.assignee_id === currentUserId;
  const isReviewer = isManager || isLeaderOfDivision;
  const status = task.status as TaskStatus;

  const tenggat = task.end_date ? new Date(task.end_date) : null;
  const lewatTenggat =
    tenggat !== null && status !== "done" && tenggat < new Date(new Date().toDateString());

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-sm font-bold text-slate-800">{task.title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[status]}`}>
              {STATUS_LABEL[status]}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLOR[task.level as TaskLevel]}`}>
              {LEVEL_LABEL[task.level as TaskLevel]}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLOR[task.type as TaskType]}`}>
              {TYPE_LABEL[task.type as TaskType]}
            </span>
          </div>

          {task.description && (
            <p className="text-xs leading-relaxed text-slate-500">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            {showDivision && (
              <span className="font-medium text-slate-500">
                {divisionName.get(task.division_id ?? "") ?? "Tanpa Divisi"}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <User2 className="h-3 w-3" />
              {task.assignee_id ? profileName.get(task.assignee_id) ?? "-" : "Belum ditugaskan"}
            </span>
            {staffIds.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {staffIds.map((uid) => profileName.get(uid) ?? "-").join(", ")}
              </span>
            )}
            {tenggat && (
              <span
                className={`inline-flex items-center gap-1 ${
                  lewatTenggat ? "font-semibold text-rose-600" : ""
                }`}
              >
                <CalendarClock className="h-3 w-3" />
                {tenggat.toLocaleDateString("id-ID", { dateStyle: "medium" })}
                {lewatTenggat && " (lewat)"}
              </span>
            )}
            <span>{task.points} poin</span>
          </div>

          {showProgress && (
            <div className="flex items-center gap-2 pt-0.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    task.progress >= 100 ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-[11px] font-bold text-slate-500">
                {task.progress}%
              </span>
            </div>
          )}

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
          status={status}
          isAssignee={isAssignee}
          isReviewer={isReviewer}
        />
      </div>
    </div>
  );
}
