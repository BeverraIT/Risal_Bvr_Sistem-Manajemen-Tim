"use client";

import { useActionState, useState } from "react";
import { createJob, type ActionState } from "./actions";
import { Plus, X, Check } from "lucide-react";

const initialState: ActionState = { error: null };

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

// `terkunci` dipakai di halaman Job List milik satu karyawan: di sana orang
// dan divisinya sudah pasti dari konteks halaman, jadi tidak perlu -- dan
// tidak boleh -- dipilih ulang.
export function JobForm({
  divisions,
  people,
  terkunci,
}: {
  divisions: { id: string; name: string }[];
  people: { id: string; name: string }[];
  terkunci?: { assigneeId: string; assigneeName: string; divisionId: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createJob, initialState);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-600/15 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" /> Job Baru
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
        <h3 className="text-sm font-bold text-slate-800">Job Baru</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className={labelCls}>Judul Job *</label>
        <input name="title" required placeholder="mis. Siapkan materi presentasi" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Deskripsi</label>
        <textarea name="description" rows={2} className={inputCls} />
      </div>

      {terkunci ? (
        <>
          <input type="hidden" name="assignee_id" value={terkunci.assigneeId} />
          <input type="hidden" name="division_id" value={terkunci.divisionId ?? ""} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Ditugaskan ke</label>
              <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {terkunci.assigneeName}
              </div>
            </div>
            <div>
              <label className={labelCls}>Tenggat</label>
              <input type="date" name="due_date" className={inputCls} />
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Ditugaskan ke</label>
              <select name="assignee_id" className={inputCls} defaultValue="">
                <option value="">— Belum ditugaskan —</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tenggat</label>
              <input type="date" name="due_date" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Divisi (opsional)</label>
            <select name="division_id" className={inputCls} defaultValue="">
              <option value="">— Tidak terkait divisi —</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {pending ? "Menyimpan..." : "Simpan Job"}
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
