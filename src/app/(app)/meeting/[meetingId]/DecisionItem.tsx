"use client";

import { useActionState, useState, useTransition } from "react";
import { updateDecision, deleteDecision, type ActionState } from "../actions";
import { Pencil, Trash2, Check, X } from "lucide-react";

const initialState: ActionState = { error: null };

// Satu baris keputusan dengan tombol Edit & Hapus yang jelas (ikon + label,
// bukan ikon telanjang) supaya tidak ambigu seperti versi sebelumnya.
export function DecisionItem({
  meetingId,
  decisionId,
  content,
  badge,
  canEdit,
}: {
  meetingId: string;
  decisionId: string;
  content: string;
  badge?: React.ReactNode;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateDecision, initialState);
  const [deleting, startDelete] = useTransition();

  if (editing) {
    return (
      <li className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 shadow-sm">
        <form
          action={(fd) => {
            formAction(fd);
            setEditing(false);
          }}
          className="space-y-2"
        >
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="decision_id" value={decisionId} />
          <textarea
            name="content"
            defaultValue={content}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
          />
          {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Simpan
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Batal
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-700 shadow-sm hover:border-slate-200">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
        <span className="leading-relaxed">{content}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {badge}
        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (!window.confirm("Hapus keputusan ini?")) return;
                startDelete(() => {
                  void deleteDecision(meetingId, decisionId);
                });
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> {deleting ? "..." : "Hapus"}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
