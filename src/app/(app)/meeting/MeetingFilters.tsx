"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MEETING_STATUS_LABEL } from "@/lib/pm";

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm outline-none focus:border-blue-400";

const STATUS_OPTIONS = ["due_soon", "in_progress", "done", "cancelled"] as const;

// Filter daftar rapat. Jenis & divisi sudah tidak relevan sejak peserta
// dipilih per-orang -- yang tersisa cuma status.
export function MeetingFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select className={selectCls} value={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)}>
        <option value="">Semua Status</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{MEETING_STATUS_LABEL[s]}</option>
        ))}
      </select>
    </div>
  );
}
