"use client";

import { useState, useActionState } from "react";
import { createMeeting, type ActionState } from "./actions";
import { DivisionMultiSelect } from "@/components/DivisionMultiSelect";

const initialState: ActionState = { error: null };
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10";
const labelCls = "mb-1 block text-xs font-semibold text-slate-500";

// Buat Rapat: judul, tanggal, lokasi/link, deskripsi, tipe rapat.
// Rapat Internal memunculkan pilihan divisi tujuan (default: divisi pembuat).
// Management/Owner boleh memilih lebih dari satu divisi.
export function NewMeetingForm({
  divisions,
  userDivisionId,
  isManager,
}: {
  divisions: { id: string; name: string }[];
  userDivisionId: string | null;
  isManager: boolean;
}) {
  const [state, formAction, pending] = useActionState(createMeeting, initialState);
  const [type, setType] = useState<"internal" | "global">("global");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelCls}>Judul Rapat *</label>
        <input name="title" required placeholder="mis. Sinkronisasi mingguan" className={inputCls} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Tanggal &amp; Waktu *</label>
          <input name="scheduled_at" type="datetime-local" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Lokasi / Link</label>
          <input name="location" placeholder="Ruang rapat atau link meet" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Deskripsi / Agenda</label>
        <textarea name="agenda" rows={2} className={inputCls} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Tipe Rapat</label>
          <select
            name="meeting_type"
            className={inputCls}
            value={type}
            onChange={(e) => setType(e.target.value as "internal" | "global")}
          >
            <option value="global">Global</option>
            <option value="internal">Internal Divisi</option>
          </select>
        </div>
        {type === "internal" && !isManager && (
          <div>
            <label className={labelCls}>Divisi *</label>
            <select name="division_id" className={inputCls} defaultValue={userDivisionId ?? ""}>
              <option value="">— Pilih divisi —</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {type === "internal" && isManager && (
        <div>
          <label className={labelCls}>Divisi * (boleh lebih dari satu)</label>
          <DivisionMultiSelect divisions={divisions} />
        </div>
      )}

      {type === "global" && (
        <div>
          <label className={labelCls}>
            Divisi yang Diajak Diskusi (pilih beberapa, atau "Semua Divisi" untuk publik ke semua orang)
          </label>
          <DivisionMultiSelect divisions={divisions} allowSelectAll />
        </div>
      )}

      {state.error && <p className="text-sm text-rose-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-gradient-to-r from-blue-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-600/15 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Menyimpan..." : "Jadwalkan Rapat"}
      </button>
    </form>
  );
}
