"use client";

import { useTransition } from "react";
import { toggleJobDone, deleteJob } from "./actions";
import { Trash2, Circle, CheckCircle2 } from "lucide-react";

export function JobRow({
  job,
  assigneeName,
  divisionName,
  canDelete,
}: {
  job: {
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
    done: boolean;
  };
  assigneeName: string | null;
  divisionName: string | null;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();

  const overdue =
    !job.done && job.due_date && new Date(job.due_date) < new Date(new Date().toDateString());

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 shadow-sm transition-colors ${
        job.done ? "border-slate-100 bg-slate-50/60" : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(() => {
              void toggleJobDone(job.id, !job.done);
            })
          }
          className="mt-0.5 shrink-0 text-slate-300 transition-colors hover:text-emerald-600 disabled:opacity-50"
          title={job.done ? "Tandai belum selesai" : "Tandai selesai"}
        >
          {job.done ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold leading-tight ${
              job.done ? "text-slate-400 line-through" : "text-slate-800"
            }`}
          >
            {job.title}
          </p>
          {job.description && (
            <p className="mt-0.5 text-xs text-slate-500">{job.description}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            {assigneeName ?? "Belum ditugaskan"}
            {divisionName ? ` · ${divisionName}` : ""}
            {job.due_date && (
              <span className={overdue ? "font-bold text-rose-600" : ""}>
                {" · "}
                {overdue ? "Lewat tenggat " : "Tenggat "}
                {new Date(job.due_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}
              </span>
            )}
          </p>
        </div>
      </div>

      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Hapus job "${job.title}"?`)) return;
            start(() => {
              void deleteJob(job.id);
            });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" /> Hapus
        </button>
      )}
    </li>
  );
}
