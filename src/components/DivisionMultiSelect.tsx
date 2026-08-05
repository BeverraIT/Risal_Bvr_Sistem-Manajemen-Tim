"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type Option = { id: string; name: string };

// Multi-pilih divisi berbentuk chip (untuk Management/Owner). Nilai terpilih
// dikirim sebagai beberapa input hidden bernama `division_ids` sehingga server
// action bisa membacanya dengan formData.getAll("division_ids").
export function DivisionMultiSelect({
  divisions,
  defaultSelected = [],
  onChange,
  name = "division_ids",
  allowSelectAll = false,
  allName = "select_all",
}: {
  divisions: Option[];
  defaultSelected?: string[];
  onChange?: (ids: string[], selectAll: boolean) => void;
  name?: string;
  allowSelectAll?: boolean;
  allName?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [selectAll, setSelectAll] = useState(false);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    setSelected(next);
    onChange?.(next, selectAll);
  };

  const toggleAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    onChange?.(selected, next);
  };

  return (
    <div>
      {allowSelectAll && (
        <button
          type="button"
          onClick={toggleAll}
          className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
            selectAll
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          {selectAll && <Check className="h-3 w-3" />}
          Semua Divisi
        </button>
      )}
      <div className={`flex flex-wrap gap-1.5 ${selectAll ? "pointer-events-none opacity-40" : ""}`}>
        {divisions.map((d) => {
          const active = selected.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              disabled={selectAll}
              onClick={() => toggle(d.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {active && <Check className="h-3 w-3" />}
              {d.name}
            </button>
          );
        })}
      </div>
      {selectAll ? (
        <input type="hidden" name={allName} value="1" />
      ) : (
        selected.map((id) => <input key={id} type="hidden" name={name} value={id} />)
      )}
      <p className="mt-1.5 text-[11px] text-slate-400">
        {selectAll
          ? "Semua divisi dipilih."
          : selected.length === 0
            ? "Belum ada divisi dipilih — klik untuk memilih (boleh lebih dari satu)."
            : `${selected.length} divisi dipilih.`}
      </p>
    </div>
  );
}
