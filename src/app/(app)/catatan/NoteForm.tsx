"use client";

import { useActionState, useRef } from "react";
import { createNote, type ActionState } from "./actions";
import { Plus } from "lucide-react";

const initialState: ActionState = { error: null };

// Baris tambah cepat, sama seperti JobForm. Kalau ada job yang belum
// selesai, muncul pemilih "Tempel ke job" opsional -- catatan yang ditempel
// nanti dirender nempel di bawah job-nya, bukan di daftar utama.
export function NoteForm({ jobs }: { jobs: { id: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState(createNote, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd);
          formRef.current?.reset();
        }}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-l-4 border-l-violet-400 border-slate-200 bg-white p-2.5 shadow-sm"
      >
        <input
          name="title"
          required
          placeholder="Tambah catatan khusus..."
          className="min-w-40 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {jobs.length > 0 && (
          <select
            name="related_job_id"
            defaultValue=""
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 outline-none"
          >
            <option value="">Tidak ditempel job</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                Tempel ke: {j.title}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Catatan
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-rose-600">{state.error}</p>}
    </div>
  );
}
