"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  TASK_LEVELS,
  TASK_STATUSES,
  TASK_TYPES,
  LEVEL_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
} from "@/lib/pm";
import { SearchableSelect } from "@/components/SearchableSelect";

type Option = { id: string; name: string };

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm outline-none focus:border-blue-400";

// Filter list tugas via URL search params (level, status, type, division, assignee).
export function TaskFilters({
  showDivision,
  divisions,
  people = [],
}: {
  showDivision: boolean;
  divisions: Option[];
  // Filter per orang -- daftarnya panjang (~90 nama), jadi pakai dropdown
  // yang bisa dicari, bukan <select> biasa.
  people?: Option[];
}) {
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
      <select
        className={selectCls}
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">Semua Status</option>
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={params.get("level") ?? ""}
        onChange={(e) => setParam("level", e.target.value)}
      >
        <option value="">Semua Level</option>
        {TASK_LEVELS.map((l) => (
          <option key={l} value={l}>
            {LEVEL_LABEL[l]}
          </option>
        ))}
      </select>

      <select
        className={selectCls}
        value={params.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value)}
      >
        <option value="">Semua Tipe</option>
        {TASK_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      {showDivision && (
        <select
          className={selectCls}
          value={params.get("division") ?? ""}
          onChange={(e) => setParam("division", e.target.value)}
        >
          <option value="">Semua Divisi</option>
          {divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      )}

      {people.length > 0 && (
        // key: SearchableSelect memegang pilihannya di state internal, jadi
        // tanpa ini tombol "Reset" / navigasi balik tidak ikut membersihkan
        // label yang tampil.
        <SearchableSelect
          key={params.get("assignee") ?? "all"}
          options={people.map((p) => ({ value: p.id, label: p.name }))}
          defaultValue={params.get("assignee") ?? ""}
          emptyLabel="Semua Orang"
          className="w-40"
          onValueChange={(v) => setParam("assignee", v)}
        />
      )}
    </div>
  );
}
