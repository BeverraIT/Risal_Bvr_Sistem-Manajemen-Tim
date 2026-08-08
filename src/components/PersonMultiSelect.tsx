"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";

type Person = { id: string; name: string };

// Pemilih ORANG, flat & bisa dicari -- tanpa pengelompokan/pintasan per
// divisi (dulu ada, dibuang karena bikin box-nya penuh sesak begitu jumlah
// divisi & orangnya banyak). `collapsible` membungkusnya jadi dropdown
// (dipakai di form Jadwalkan Rapat Baru); tanpa itu daftarnya tampil terbuka.
export function PersonMultiSelect({
  people,
  name = "participant_ids",
  defaultSelected = [],
  excludeId,
  collapsible = false,
}: {
  people: Person[];
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

  const allSelected = visible.length > 0 && visible.every((p) => selected.includes(p.id));
  const toggleAll = () => setSelected(allSelected ? [] : visible.map((p) => p.id));

  const q = query.trim().toLowerCase();
  const filtered = visible.filter((p) => !q || p.name.toLowerCase().includes(q));

  const daftar = (
    <>
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
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

      <button
        type="button"
        onClick={toggleAll}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
      >
        <Users className="h-3 w-3" /> {allSelected ? "Kosongkan semua" : "Pilih semua orang"}
      </button>

      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
        {filtered.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                active ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"
                }`}
              >
                {active && <Check className="h-3 w-3" />}
              </span>
              {p.name}
            </button>
          );
        })}

        {visible.length === 0 && (
          <p className="py-3 text-center text-xs italic text-slate-400">
            Belum ada karyawan yang bisa dipilih.
          </p>
        )}
        {visible.length > 0 && filtered.length === 0 && (
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
