"use client";

import { useActionState, useState } from "react";
import { createNote, type ActionState } from "./actions";
import { Plus, X, Check } from "lucide-react";

const initialState: ActionState = { error: null };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-500/10";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

export function NoteForm({ divisions }: { divisions: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createNote, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-600/15 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" /> Catatan Baru
      </button>
    );
  }

  return (
    <form
      action={(fd) => {
        formAction(fd);
        setOpen(false);
      }}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Catatan Khusus Baru</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className={labelCls}>Judul *</label>
        <input name="title" required placeholder="mis. Poin penting klien A" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Isi Catatan</label>
        <textarea name="content" rows={4} className={inputCls} placeholder="Tulis catatan..." />
      </div>

      <div>
        <label className={labelCls}>Divisi Terkait (opsional)</label>
        <select name="division_id" className={inputCls} defaultValue="">
          <option value="">— Tidak terkait divisi —</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-700">
        <input type="checkbox" name="is_private" value="0" className="mt-0.5" />
        <span>
          <b>Bagikan ke semua orang.</b> Kalau tidak dicentang, catatan ini hanya bisa dilihat oleh Anda
          sendiri (dan Management/Owner).
        </span>
      </label>

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {pending ? "Menyimpan..." : "Simpan Catatan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
