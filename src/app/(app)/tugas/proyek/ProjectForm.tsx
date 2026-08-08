"use client";

import { useActionState, useState } from "react";
import { createProject, type ActionState } from "../actions";
import { TASK_LEVELS, TASK_TYPES, LEVEL_LABEL, TYPE_LABEL, STATUS_LABEL } from "@/lib/pm";
import { FolderPlus, X } from "lucide-react";
import type { AppRole } from "@/lib/roles";
import { DivisionMultiSelect } from "@/components/DivisionMultiSelect";
import { SearchableSelect } from "@/components/SearchableSelect";

type Option = { id: string; name: string };

const initialState: ActionState = { error: null };
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

// Buat Proyek (Management/Owner): nama, deskripsi, tanggal, divisi (boleh
// lebih dari satu — tiap divisi mendapat proyeknya sendiri), tipe, status,
// level, PIC.
export function ProjectForm({
  role,
  divisions,
  members,
}: {
  role: AppRole;
  divisions: Option[];
  members: { id: string; name: string; divisionId: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const [divisionIds, setDivisionIds] = useState<string[]>([]);
  const [projectType, setProjectType] = useState<string>("pengembangan");

  // Management (admin) yang membuat proyek tipe "Fitur (Tugas Baru)" boleh
  // memilih minta ACC Owner dulu — opsional.
  const showAccOption = role === "admin" && projectType === "fitur";

  const assigneeOptions = members.filter(
    (m) => divisionIds.length === 0 || (m.divisionId && divisionIds.includes(m.divisionId)),
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-600/15 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
      >
        <FolderPlus className="h-4 w-4" /> Buat Proyek
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Buat Proyek Baru</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div>
        <label className={labelCls}>Nama Proyek *</label>
        <input name="name" required className={inputCls} placeholder="mis. Revamp aplikasi internal" />
      </div>
      <div>
        <label className={labelCls}>Deskripsi</label>
        <textarea name="description" rows={2} className={inputCls} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Tanggal Mulai</label>
          <input type="date" name="start_date" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Tanggal Selesai</label>
          <input type="date" name="end_date" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Divisi * (boleh lebih dari satu — tiap divisi dapat proyeknya sendiri)</label>
        <DivisionMultiSelect divisions={divisions} onChange={setDivisionIds} />
      </div>

      <div>
        <label className={labelCls}>Penanggung Jawab (PIC)</label>
        <SearchableSelect
          name="assignee_id"
          options={assigneeOptions.map((m) => ({ value: m.id, label: m.name }))}
          emptyLabel="— Belum ditugaskan —"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>Tipe</label>
          <select
            name="type"
            className={inputCls}
            value={projectType}
            onChange={(e) => setProjectType(e.target.value)}
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select name="status" className={inputCls} defaultValue="todo">
            {(["todo", "in_progress", "in_review", "done"] as const).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Level</label>
          <select name="level" className={inputCls} defaultValue="medium">
            {TASK_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showAccOption && (
        <label className="flex items-start gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          <input type="checkbox" name="need_acc" value="1" className="mt-0.5" />
          <span>
            <b>Ajukan ACC ke Owner terlebih dahulu</b> (opsional). Jika dicentang, proyek masuk
            sebagai <b>Ide</b> menunggu persetujuan Owner. Jika tidak, proyek langsung berjalan.
          </span>
        </label>
      )}

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan Proyek"}
        </button>
      </div>
    </form>
  );
}
