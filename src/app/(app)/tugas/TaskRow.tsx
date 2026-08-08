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
import { FolderKanban } from "lucide-react";

export type TaskRowData = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  level: string;
  status: string;
  division_id: string | null;
  assignee_id: string | null;
  end_date: string | null;
  points: number;
  project_id: string | null;
};

// Satu baris tugas -- dipakai bersama oleh halaman Daftar Tugas dan
// Persetujuan Idea, dulu berupa closure renderTaskRow di dalam satu halaman
// besar. Server component: hanya TaskStatusControl di dalamnya yang client.
export function TaskRow({
  task,
  divisionName,
  profileName,
  staffIds = [],
  showDivision,
  isAssignee,
  isReviewer,
}: {
  task: TaskRowData;
  divisionName: Map<string, string>;
  profileName: Map<string, string>;
  staffIds?: string[];
  showDivision: boolean;
  isAssignee: boolean;
  isReviewer: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 transition-colors hover:border-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">{task.title}</h3>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[task.status as TaskStatus]}`}
            >
              {STATUS_LABEL[task.status as TaskStatus]}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLOR[task.level as TaskLevel]}`}
            >
              {LEVEL_LABEL[task.level as TaskLevel]}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLOR[task.type as TaskType]}`}
            >
              {TYPE_LABEL[task.type as TaskType]}
            </span>
          </div>
          {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
          <p className="text-xs text-slate-400">
            {showDivision && (
              <>
                {divisionName.get(task.division_id ?? "") ?? "-"}
                {" · "}
              </>
            )}
            PIC:{" "}
            <span className="font-medium text-slate-600">
              {task.assignee_id ? profileName.get(task.assignee_id) ?? "-" : "Belum ditugaskan"}
            </span>
            {staffIds.length > 0 && (
              <>
                {" · "}
                Staff:{" "}
                <span className="font-medium text-slate-600">
                  {staffIds.map((uid) => profileName.get(uid) ?? "-").join(", ")}
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
          isReviewer={isReviewer}
        />
      </div>
    </div>
  );
}
