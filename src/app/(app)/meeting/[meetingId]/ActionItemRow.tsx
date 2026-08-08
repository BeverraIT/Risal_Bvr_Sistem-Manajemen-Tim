"use client";

import { useActionState, useState, useTransition } from "react";
import {
  updateActionItem,
  deleteActionItem,
  addActionItem,
  type ActionState,
} from "../actions";
import { ActionItemStatusSelect } from "./ActionItemStatusSelect";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Pencil, Trash2, Check, X, CornerDownRight, Plus } from "lucide-react";

const initialState: ActionState = { error: null };

export type ActionItemData = {
  id: string;
  title: string;
  assignee_id: string | null;
  due_date: string | null;
  status: string;
  source?: string | null;
  parent_id?: string | null;
};

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10";

// Satu action item + sub-item di bawahnya. Tombol Edit/Hapus/Sub-item pakai
// ikon BESERTA label supaya maksudnya jelas, tidak menebak-nebak ikon.
export function ActionItemRow({
  meetingId,
  item,
  subItems,
  profiles,
  nameById,
  canEdit,
  badge,
}: {
  meetingId: string;
  item: ActionItemData;
  subItems: ActionItemData[];
  profiles: { id: string; full_name: string }[];
  nameById: Record<string, string>;
  canEdit: boolean;
  badge?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [state, formAction, pending] = useActionState(updateActionItem, initialState);
  const [subState, subFormAction, subPending] = useActionState(addActionItem, initialState);
  const [deleting, startDelete] = useTransition();

  const assigneeLabel = item.assignee_id ? nameById[item.assignee_id] ?? "-" : "Belum ditugaskan";

  return (
    <li className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
      {editing ? (
        <form
          action={(fd) => {
            formAction(fd);
            setEditing(false);
          }}
          className="space-y-2"
        >
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="item_id" value={item.id} />
          <input name="title" defaultValue={item.title} className={inputCls} />
          <div className="grid gap-2 sm:grid-cols-2">
            <SearchableSelect
              name="assignee_id"
              options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
              defaultValue={item.assignee_id ?? ""}
              emptyLabel="— Belum ditugaskan —"
            />
            <input type="date" name="due_date" defaultValue={item.due_date ?? ""} className={inputCls} />
          </div>
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
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{item.title}</p>
              {badge}
            </div>
            <p className="text-xs text-slate-500">
              PIC: <span className="font-semibold text-slate-700">{assigneeLabel}</span>
              {item.due_date
                ? ` · Tenggat: ${new Date(item.due_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ActionItemStatusSelect meetingId={meetingId} itemId={item.id} status={item.status} />
          </div>
        </div>
      )}

      {/* Sub-item */}
      {subItems.length > 0 && (
        <ul className="mt-3 space-y-2 border-l-2 border-slate-100 pl-3">
          {subItems.map((sub) => (
            <li key={sub.id} className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">{sub.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {sub.assignee_id ? nameById[sub.assignee_id] ?? "-" : "Belum ditugaskan"}
                    {sub.due_date
                      ? ` · ${new Date(sub.due_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <ActionItemStatusSelect meetingId={meetingId} itemId={sub.id} status={sub.status} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("Hapus sub-item ini?")) return;
                      startDelete(() => {
                        void deleteActionItem(meetingId, sub.id);
                      });
                    }}
                    className="rounded-lg border border-slate-200 bg-white p-1 text-slate-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                    title="Hapus sub-item"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Form tambah sub-item */}
      {addingSub && (
        <form
          action={(fd) => {
            subFormAction(fd);
            setAddingSub(false);
          }}
          className="mt-3 space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5"
        >
          <input type="hidden" name="meeting_id" value={meetingId} />
          <input type="hidden" name="parent_id" value={item.id} />
          <input name="title" required placeholder="Judul sub-item..." className={inputCls} />
          <div className="grid gap-2 sm:grid-cols-2">
            <SearchableSelect
              name="assignee_id"
              options={profiles.map((p) => ({ value: p.id, label: p.full_name }))}
              emptyLabel="— Belum ditugaskan —"
            />
            <input type="date" name="due_date" className={inputCls} />
          </div>
          {subState.error && <p className="text-xs text-rose-600">{subState.error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={subPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Tambah
            </button>
            <button
              type="button"
              onClick={() => setAddingSub(false)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <X className="h-3.5 w-3.5" /> Batal
            </button>
          </div>
        </form>
      )}

      {/* Tombol aksi */}
      {canEdit && !editing && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
          {!item.parent_id && (
            <button
              type="button"
              onClick={() => setAddingSub(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Plus className="h-3 w-3" /> Sub-item
            </button>
          )}
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              if (
                !window.confirm(
                  subItems.length > 0
                    ? "Hapus action item ini beserta semua sub-item di bawahnya?"
                    : "Hapus action item ini?",
                )
              )
                return;
              startDelete(() => {
                void deleteActionItem(meetingId, item.id);
              });
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" /> {deleting ? "Menghapus..." : "Hapus"}
          </button>
        </div>
      )}
    </li>
  );
}
