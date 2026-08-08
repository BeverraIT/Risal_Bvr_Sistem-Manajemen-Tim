"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createMeeting, type ActionState } from "./actions";
import { PersonMultiSelect } from "@/components/PersonMultiSelect";

const initialState: ActionState = { error: null };
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

// Form Jadwalkan Rapat Baru: judul, waktu mulai & selesai, peserta (per
// orang, dicari lewat search flat -- lihat PersonMultiSelect).
//
// Rapat selalu privat: yang boleh membuka hanya peserta terpilih (plus
// pembuat & Management), lewat meeting_participants.
export function NewMeetingForm({
  people,
}: {
  people: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createMeeting, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className={labelCls}>Judul / Topik Rapat *</label>
        <input name="title" required placeholder="mis. Sinkronisasi mingguan" className={inputCls} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Mulai *</label>
          <input name="scheduled_at" type="datetime-local" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Selesai</label>
          <input name="ends_at" type="datetime-local" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Peserta Rapat *</label>
        <PersonMultiSelect people={people} collapsible />
        <p className="mt-1.5 text-[11px] text-slate-400">
          Boleh memilih lebih dari satu orang, lintas divisi. Anda sebagai
          penyelenggara otomatis ikut jadi peserta.
        </p>
      </div>

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-600/15 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Menyimpan..." : "Simpan & Jadwalkan"}
        </button>
        <Link
          href="/meeting"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}
