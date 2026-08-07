"use client";

import { useActionState, useTransition } from "react";
import { addTaskComment, deleteTaskComment, type ActionState } from "../actions";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const initialState: ActionState = { error: null };

export type Komentar = {
  id: string;
  content: string;
  created_at: string;
  author_id: string | null;
  authorName: string;
  bisaHapus: boolean;
};

export function TaskComments({
  taskId,
  komentar,
}: {
  taskId: string;
  komentar: Komentar[];
}) {
  const [state, formAction, pending] = useActionState(addTaskComment, initialState);
  const [hapusPending, startHapus] = useTransition();

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
        <MessageSquare className="h-4.5 w-4.5 text-blue-600" />
        <span>Komentar</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">
          {komentar.length}
        </span>
      </h2>

      {komentar.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Belum ada komentar"
          description="Gunakan komentar untuk mencatat kendala, keputusan, atau pertanyaan seputar tugas ini."
        />
      ) : (
        <ul className="space-y-3">
          {komentar.map((k) => (
            <li key={k.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700">{k.authorName}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                    {k.content}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <time className="text-[11px] text-slate-400">
                    {new Date(k.created_at).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  {k.bisaHapus && (
                    <button
                      type="button"
                      disabled={hapusPending}
                      onClick={() => startHapus(async () => void (await deleteTaskComment(taskId, k.id)))}
                      aria-label="Hapus komentar"
                      className="text-slate-300 transition-colors hover:text-rose-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="space-y-2 border-t border-slate-100 pt-4">
        <input type="hidden" name="task_id" value={taskId} />
        <textarea
          name="content"
          rows={3}
          required
          placeholder="Tulis komentar…"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
        />
        {state.error && <p className="text-xs font-semibold text-rose-600">{state.error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {pending ? "Mengirim…" : "Kirim Komentar"}
          </button>
        </div>
      </form>
    </section>
  );
}
