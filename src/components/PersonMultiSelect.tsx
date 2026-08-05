"use client";

import { useState } from "react";
import { Check, Users } from "lucide-react";

type Person = { id: string; name: string; divisionId: string | null };
type Division = { id: string; name: string };

// Pemilih ORANG (bukan divisi). Chip divisi di atas hanyalah PINTASAN untuk
// mencentang/melepas semua anggota divisi itu sekaligus -- yang benar-benar
// dikirim ke server tetap daftar user id (`name`, default participant_ids).
export function PersonMultiSelect({
  people,
  divisions,
  name = "participant_ids",
  defaultSelected = [],
  excludeId,
}: {
  people: Person[];
  divisions: Division[];
  name?: string;
  defaultSelected?: string[];
  excludeId?: string;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const visible = people.filter((p) => p.id !== excludeId);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const membersOf = (divId: string) =>
    visible.filter((p) => p.divisionId === divId).map((p) => p.id);

  const toggleDivision = (divId: string) => {
    const ids = membersOf(divId);
    if (ids.length === 0) return;
    const allIn = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allIn ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])],
    );
  };

  const allSelected = visible.length > 0 && visible.every((p) => selected.includes(p.id));
  const toggleAll = () => setSelected(allSelected ? [] : visible.map((p) => p.id));

  // Kelompokkan orang per divisi supaya daftarnya mudah dipindai.
  const grouped = divisions
    .map((d) => ({ division: d, members: visible.filter((p) => p.divisionId === d.id) }))
    .filter((g) => g.members.length > 0);
  const noDivision = visible.filter((p) => !p.divisionId);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      {/* Pintasan: semua orang + per divisi */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-2.5">
        <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
          <Users className="h-3 w-3" /> Pintasan:
        </span>
        <button
          type="button"
          onClick={toggleAll}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
            allSelected
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }`}
        >
          Semua Orang
        </button>
        {grouped.map(({ division, members }) => {
          const allIn = members.every((m) => selected.includes(m.id));
          return (
            <button
              key={division.id}
              type="button"
              onClick={() => toggleDivision(division.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                allIn
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {division.name}
            </button>
          );
        })}
      </div>

      {/* Daftar orang */}
      <div className="max-h-56 space-y-2.5 overflow-y-auto pt-2.5">
        {grouped.map(({ division, members }) => (
          <div key={division.id}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {division.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((p) => (
                <PersonChip
                  key={p.id}
                  person={p}
                  active={selected.includes(p.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          </div>
        ))}

        {noDivision.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Tanpa Divisi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {noDivision.map((p) => (
                <PersonChip
                  key={p.id}
                  person={p}
                  active={selected.includes(p.id)}
                  onToggle={toggle}
                />
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 && (
          <p className="py-3 text-center text-xs italic text-slate-400">
            Belum ada karyawan yang bisa dipilih.
          </p>
        )}
      </div>

      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
        {selected.length === 0
          ? "Belum ada orang dipilih."
          : `${selected.length} orang dipilih.`}
      </p>
    </div>
  );
}

function PersonChip({
  person,
  active,
  onToggle,
}: {
  person: Person;
  active: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(person.id)}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {person.name}
    </button>
  );
}
