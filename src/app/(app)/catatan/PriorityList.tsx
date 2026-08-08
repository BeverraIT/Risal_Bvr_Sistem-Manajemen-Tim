"use client";

import { useState, useTransition } from "react";
import { reorderItems, toggleJobDone, deleteJob, deleteNote } from "./actions";
import { GripVertical, Trash2, Circle, CheckCircle2, NotebookPen, ListChecks } from "lucide-react";

type NoteItem = {
  kind: "note";
  id: string;
  title: string;
  content: string | null;
  relatedJobId: string | null;
};
type JobItem = {
  kind: "job";
  id: string;
  title: string;
  description: string | null;
  done: boolean;
};
export type PriorityItem = NoteItem | JobItem;

// Satu daftar prioritas gabungan Catatan Khusus + Job List milik satu orang.
// Job & catatan lepas (tanpa relatedJobId) tampil sejajar, digeser urutannya
// (drag & drop native, posisi = prioritas). Catatan yang "ditempel" ke job
// (relatedJobId cocok dengan salah satu job di daftar ini) dirender nempel
// langsung di bawah job-nya, bukan ikut baris sejajar -- tidak ikut digeser
// sendiri, ikut posisi job induknya. Kalau `editable` false (Management/
// Owner sedang melihat milik orang lain), semuanya read-only.
export function PriorityList({
  items: initialItems,
  editable,
}: {
  items: PriorityItem[];
  editable: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const jobIds = new Set(items.filter((it): it is JobItem => it.kind === "job").map((it) => it.id));
  const attachedByJob = new Map<string, NoteItem[]>();
  const topLevel: PriorityItem[] = [];
  for (const it of items) {
    if (it.kind === "note" && it.relatedJobId && jobIds.has(it.relatedJobId)) {
      const list = attachedByJob.get(it.relatedJobId) ?? [];
      list.push(it);
      attachedByJob.set(it.relatedJobId, list);
    } else {
      topLevel.push(it);
    }
  }

  const persistOrder = (next: PriorityItem[]) => {
    setItems(next);
    startTransition(() => {
      void reorderItems(next.map((it) => ({ id: it.id, kind: it.kind })));
    });
  };

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const from = items.findIndex((it) => it.id === dragId);
    const to = items.findIndex((it) => it.id === targetId);
    setDragId(null);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  };

  const toggleDone = (job: JobItem) => {
    setItems((prev) =>
      prev.map((it) => (it.kind === "job" && it.id === job.id ? { ...it, done: !job.done } : it)),
    );
    startTransition(() => {
      void toggleJobDone(job.id, !job.done);
    });
  };

  const remove = (item: PriorityItem) => {
    const label = item.kind === "note" ? "catatan" : "job";
    if (!window.confirm(`Hapus ${label} "${item.title}"?`)) return;
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    startTransition(() => {
      void (item.kind === "note" ? deleteNote(item.id) : deleteJob(item.id));
    });
  };

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm italic text-slate-400 shadow-sm">
        Belum ada catatan atau job.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {topLevel.map((item) => {
        const isNote = item.kind === "note";
        const attached = item.kind === "job" ? attachedByJob.get(item.id) ?? [] : [];
        return (
          <li key={item.id} className="space-y-1.5">
            <div
              draggable={editable}
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(item.id)}
              className={`flex items-start gap-2.5 rounded-xl border bg-white p-3.5 shadow-sm transition-colors ${
                isNote ? "border-l-4 border-l-violet-400 border-slate-100" : "border-l-4 border-l-emerald-400 border-slate-100"
              } ${item.kind === "job" && item.done ? "bg-slate-50/60" : ""} ${dragId === item.id ? "opacity-50" : ""}`}
            >
              {editable && (
                <span className="mt-0.5 shrink-0 cursor-grab text-slate-300" title="Geser untuk urutkan">
                  <GripVertical className="h-4 w-4" />
                </span>
              )}

              {item.kind === "job" ? (
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => toggleDone(item)}
                  className="mt-0.5 shrink-0 text-slate-300 transition-colors hover:text-emerald-600 disabled:hover:text-slate-300"
                  title={item.done ? "Tandai belum selesai" : "Tandai selesai"}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
              ) : (
                <NotebookPen className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" />
              )}

              <div className="min-w-0 flex-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    isNote ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {isNote ? <NotebookPen className="h-2.5 w-2.5" /> : <ListChecks className="h-2.5 w-2.5" />}
                  {isNote ? "Catatan" : "Job"}
                </span>
                <p
                  className={`mt-1 text-sm font-semibold leading-tight ${
                    item.kind === "job" && item.done ? "text-slate-400 line-through" : "text-slate-800"
                  }`}
                >
                  {item.title}
                </p>
                {isNote && item.content && (
                  <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                    {item.content}
                  </p>
                )}
                {!isNote && item.description && (
                  <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                )}
              </div>

              {editable && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="h-3 w-3" /> Hapus
                </button>
              )}
            </div>

            {/* Catatan yang ditempel ke job ini */}
            {attached.length > 0 && (
              <ul className="ml-6 space-y-1.5 border-l-2 border-dashed border-violet-200 pl-3">
                {attached.map((note) => (
                  <li
                    key={note.id}
                    className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2"
                  >
                    <NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-violet-800">{note.title}</p>
                      {note.content && (
                        <p className="text-[11px] leading-relaxed text-violet-600/80">{note.content}</p>
                      )}
                    </div>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => remove(note)}
                        className="shrink-0 text-violet-300 hover:text-rose-600"
                        title="Hapus catatan"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
