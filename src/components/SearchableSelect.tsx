"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type SearchableOption = { value: string; label: string };

// Dropdown pilih-satu yang bisa dicari -- pengganti <select> bawaan untuk
// daftar panjang (mis. ~90 nama pegawai), yang di <select> native tidak bisa
// diketik cari dan di HP hasilnya panjang tak terbaca.
//
// Nilainya dikirim lewat <input type="hidden">, jadi tetap kompatibel dengan
// form action / FormData persis seperti <select name="..."> sebelumnya.
// Dropdown pendek (status/level/tipe) sengaja TIDAK memakai ini -- pencarian
// di daftar 3-6 pilihan cuma menambah langkah.
export function SearchableSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Pilih…",
  emptyLabel,
  className = "",
  onValueChange,
}: {
  // Dikosongkan kalau komponen dipakai di luar form (murni lewat onValueChange).
  name?: string;
  options: SearchableOption[];
  defaultValue?: string;
  placeholder?: string;
  // Kalau diisi, muncul pilihan kosong di paling atas (mis. "Belum ditugaskan").
  emptyLabel?: string;
  className?: string;
  // Untuk pemakaian non-form (mis. panel editor Alur Kerja) yang perlu tahu
  // perubahannya saat itu juga, bukan menunggu form disubmit.
  onValueChange?: (value: string) => void;
}) {
  // Sengaja tidak ada prop `required`: nilainya dikirim lewat input hidden,
  // dan spesifikasi HTML mengecualikan input hidden dari validasi bawaan
  // browser -- jadi `required` di sini akan diam-diam tidak berfungsi.
  // Field wajib divalidasi di server action masing-masing.
  const [value, setValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const labelByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  );

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = options.filter((o) => !q || o.label.toLowerCase().includes(q));

  const pick = (v: string) => {
    setValue(v);
    setQuery("");
    setOpen(false);
    onValueChange?.(v);
  };

  const currentLabel = value ? labelByValue.get(value) ?? placeholder : emptyLabel ?? placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {name && <input type="hidden" name={name} value={value} />}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left text-sm shadow-sm outline-none transition-all hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
      >
        <span className={`truncate ${value ? "text-slate-700" : "text-slate-400"}`}>
          {currentLabel}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-1 pb-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari…"
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

          <div className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
            {emptyLabel && (
              <button
                type="button"
                onClick={() => pick("")}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  value === "" ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {value === "" && <Check className="h-3.5 w-3.5 shrink-0" />}
                {emptyLabel}
              </button>
            )}

            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => pick(o.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  value === o.value
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {value === o.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                {o.label}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-center text-xs italic text-slate-400">
                Tidak ada yang cocok.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
