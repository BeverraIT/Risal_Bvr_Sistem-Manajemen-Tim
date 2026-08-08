"use client";

import { useActionState, useRef } from "react";
import { createJob, type ActionState } from "./actions";
import { Plus } from "lucide-react";

const initialState: ActionState = { error: null };

// Baris tambah cepat -- ketik judul, Enter/klik +, langsung masuk list.
// Tidak ada panel form terpisah supaya benar-benar terasa seperti list biasa.
export function JobForm() {
  const [state, formAction, pending] = useActionState(createJob, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <form
        ref={formRef}
        action={(fd) => {
          formAction(fd);
          formRef.current?.reset();
        }}
        className="flex items-center gap-2 rounded-xl border border-l-4 border-l-emerald-400 border-slate-200 bg-white p-2.5 shadow-sm"
      >
        <input
          name="title"
          required
          placeholder="Tambah job baru..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Job
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-rose-600">{state.error}</p>}
    </div>
  );
}
