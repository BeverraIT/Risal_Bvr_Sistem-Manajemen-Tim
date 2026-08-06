"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";

type Person = { id: string; name: string; divisionId: string | null };
type Division = { id: string; name: string };

// Pemilih ORANG (bukan divisi), dikelompokkan di bawah nama divisinya --
// pola optgroup, tapi dibuat sendiri karena <select multiple> bawaan tidak
// bisa dicari, tidak punya checkbox, dan di HP hasilnya tidak terbaca.
// Chip divisi hanyalah PINTASAN untuk mencentang/melepas semua anggotanya
// sekaligus; yang dikirim ke server tetap daftar user id (`participant_ids`).
//
// `collapsible` membungkusnya jadi dropdown (dipakai di form Jadwalkan Rapat
// Baru, yang formnya panjang); tanpa itu daftarnya tampil terbuka.
export function PersonMultiSelect({
  people,
  divisions,
  name = "participant_ids",
  defaultSelected = [],
  excludeId,
  collapsible = false,
}: {
  people: Person[];
  divisions: Division[];
  name?: string;
  defaultSelected?: string[];
  excludeId?: string;
  collapsible?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!collapsible);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const visible = useMemo(() => people.filter((p) => p.id !== excludeId), [people, excludeId]);
  const personById = useMemo(() => new Map(visible.map((p) => [p.id, p])), [visible]);

  // Tutup dropdown saat klik di luar atau tekan Escape.
  useEffect(() => {
    if (!collapsible || !open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [collapsible, open]);

  useEffect(() => {
    if (collapsible && open) searchRef.current?.focus();
  }, [collapsible, open]);

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

  // Pencarian hanya menyaring daftar yang tampil -- pilihan yang sudah dibuat
  // tidak ikut hilang saat mengetik.
  const cocok = (p: Person) => {
    const q = query.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  };

  const grouped = useMemo(
    () =>
      divisions
        .map((d) => ({
          division: d,
          members: visible.filter((p) => p.divisionId === d.id && cocok(p)),
        }))
        .filter((g) => g.members.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cocok() hanya bergantung pada query
    [divisions, visible, query],
  );
  const divisionIds = useMemo(() => new Set(divisions.map((d) => d.id)), [divisions]);
  const noDivision = visible.filter(
    (p) => (!p.divisionId || !divisionIds.has(p.divisionId)) && cocok(p),
  );
  const adaHasil = grouped.length > 0 || noDivision.length > 0;

  const daftar = (
    <>
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
        {divisions.map((d) => {
          const ids = membersOf(d.id);
          if (ids.length === 0) return null;
          const allIn = ids.every((id) => selected.includes(id));
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDivision(d.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                allIn
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Pencarian nama */}
      <div className="flex items-center gap-2 border-b border-slate-100 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama pegawai…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian"
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Daftar orang, dikelompokkan per divisi */}
      <div className="max-h-56 space-y-2.5 overflow-y-auto pt-2.5">
        {grouped.map(({ division, members }) => (
          <div key={division.id}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {division.name}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((p) => (
                <PersonChip key={p.id} person={p} active={selected.includes(p.id)} onToggle={toggle} />
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
                <PersonChip key={p.id} person={p} active={selected.includes(p.id)} onToggle={toggle} />
              ))}
            </div>
          </div>
        )}

        {visible.length === 0 && (
          <p className="py-3 text-center text-xs italic text-slate-400">
            Belum ada karyawan yang bisa dipilih.
          </p>
        )}
        {visible.length > 0 && !adaHasil && (
          <p className="py-3 text-center text-xs italic text-slate-400">
            Tidak ada nama yang cocok dengan &quot;{query}&quot;.
          </p>
        )}
      </div>
    </>
  );

  const hiddenInputs = selected.map((id) => (
    <input key={id} type="hidden" name={name} value={id} />
  ));

  if (!collapsible) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        {daftar}
        {hiddenInputs}
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          {selected.length === 0 ? "Belum ada orang dipilih." : `${selected.length} orang dipilih.`}
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {hiddenInputs}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm outline-none transition-all hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-slate-400" />
          <span className={selected.length ? "font-semibold text-slate-700" : "text-slate-400"}>
            {selected.length ? `${selected.length} peserta dipilih` : "Pilih peserta rapat…"}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
            >
              {personById.get(id)?.name ?? "-"}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Hapus ${personById.get(id)?.name ?? "peserta"}`}
                className="rounded-full p-0.5 text-blue-400 transition-colors hover:bg-blue-100 hover:text-blue-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          {daftar}
        </div>
      )}
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
