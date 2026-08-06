"use client";

import { useTransition } from "react";
import {
  ASSIGNEE_NEXT_STATUS,
  REVIEWER_NEXT_STATUS,
  STATUS_LABEL,
  type TaskStatus,
} from "@/lib/pm";
import { updateTaskStatus } from "./actions";
import { Check, X, Send } from "lucide-react";

// Kontrol transisi status untuk satu task. Menampilkan hanya transisi yang
// diizinkan sesuai peran (assignee dan/atau reviewer).
export function TaskStatusControl({
  taskId,
  status,
  isAssignee,
  isReviewer,
}: {
  taskId: string;
  status: TaskStatus;
  isAssignee: boolean;
  isReviewer: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const allowed = new Set<TaskStatus>();
  if (isAssignee) ASSIGNEE_NEXT_STATUS[status].forEach((s) => allowed.add(s));
  if (isReviewer) REVIEWER_NEXT_STATUS[status].forEach((s) => allowed.add(s));

  const move = (next: TaskStatus) =>
    startTransition(async () => {
      await updateTaskStatus(taskId, next);
    });

  // Sudah diajukan dan menunggu keputusan: tombol Approve / Reject yang tegas.
  if (status === "waiting_approval" && isReviewer) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          disabled={pending}
          onClick={() => move("todo")}
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" /> Approve
        </button>
        <button
          disabled={pending}
          onClick={() => move("cancelled")}
          className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Reject
        </button>
      </div>
    );
  }

  // Masih berupa ide: satu tombol jelas untuk mengajukannya.
  if (status === "idea" && allowed.has("waiting_approval")) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          disabled={pending}
          onClick={() => move("waiting_approval")}
          className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" /> Ajukan
        </button>
        {isReviewer && (
          <button
            disabled={pending}
            onClick={() => move("cancelled")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" /> Buang
          </button>
        )}
      </div>
    );
  }

  const options = [...allowed];
  if (options.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {options.map((next) => {
        const isDone = next === "done";
        const isCancel = next === "cancelled";
        return (
          <button
            key={next}
            disabled={pending}
            onClick={() => move(next)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
              isDone
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : isCancel
                  ? "border border-rose-200 text-rose-600 hover:bg-rose-50"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            → {STATUS_LABEL[next]}
          </button>
        );
      })}
    </div>
  );
}
