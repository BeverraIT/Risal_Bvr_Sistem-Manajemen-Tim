"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createFlow, type ActionState } from "./actions";

const initial: ActionState & { id?: string } = { error: null };

export function NewFlowForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createFlow, initial);
  const router = useRouter();

  useEffect(() => {
    if (state.id) router.push(`/alur-kerja/${state.id}/edit`);
  }, [state.id, router]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" /> Buat Alur Baru
      </button>
    );
  }

  return (
    <form
      action={action}
      className="w-full max-w-md space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">Alur Kerja Baru</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input
        name="name"
        required
        placeholder="Nama alur, mis. Proses Closing Penjualan"
        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-cyan-400"
      />
      <textarea
        name="description"
        rows={2}
        placeholder="Deskripsi singkat (opsional)"
        className="w-full resize-none rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-cyan-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-600 to-sky-500 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "Membuat..." : "Buat & Mulai Menggambar"}
      </button>
      {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}
