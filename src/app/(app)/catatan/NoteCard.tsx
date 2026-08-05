"use client";

import { useTransition } from "react";
import { deleteNote } from "./actions";
import { Trash2, Lock, Globe } from "lucide-react";

export function NoteCard({
  note,
  divisionName,
  canDelete,
}: {
  note: {
    id: string;
    title: string;
    content: string | null;
    is_private: boolean;
    updated_at: string | null;
    created_at: string;
  };
  divisionName: string | null;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-tight text-slate-800">{note.title}</h3>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
            note.is_private
              ? "border-amber-100 bg-amber-50 text-amber-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {note.is_private ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
          {note.is_private ? "Privat" : "Publik"}
        </span>
      </div>

      {note.content && (
        <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
          {note.content}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <p className="text-[10px] text-slate-400">
          {divisionName ? `${divisionName} · ` : ""}
          {new Date(note.updated_at ?? note.created_at).toLocaleDateString("id-ID", {
            dateStyle: "medium",
          })}
        </p>
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Hapus catatan "${note.title}"?`)) return;
              start(() => {
                void deleteNote(note.id);
              });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> Hapus
          </button>
        )}
      </div>
    </div>
  );
}
