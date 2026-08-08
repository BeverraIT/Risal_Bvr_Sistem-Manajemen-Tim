"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, Search } from "lucide-react";

// Dropdown pencarian untuk Management/Owner memilih Catatan & Job List milik
// siapa yang mau dilihat -- dulu semua nama dirender jadi tombol sejajar
// (kacau kalau karyawannya puluhan), sekarang jadi satu dropdown yang bisa
// dicari, sama seperti PersonMultiSelect.
export function ViewerPicker({
  people,
  currentUserId,
  viewingUserId,
}: {
  people: { id: string; name: string }[];
  currentUserId: string;
  viewingUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

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
  const filtered = people.filter((p) => !q || p.name.toLowerCase().includes(q));
  const currentName =
    viewingUserId === currentUserId
      ? "Saya sendiri"
      : people.find((p) => p.id === viewingUserId)?.name ?? "Pilih orang";

  const select = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(id === currentUserId ? "/catatan" : `/catatan?user=${id}`);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-300"
      >
        <Eye className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-slate-500">Lihat milik:</span>
        <span className="text-blue-700">{currentName}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama pegawai..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="mt-1 max-h-72 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              onClick={() => select(currentUserId)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                viewingUserId === currentUserId
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {viewingUserId === currentUserId && <Check className="h-3.5 w-3.5 shrink-0" />}
              Saya sendiri
            </button>

            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  viewingUserId === p.id
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {viewingUserId === p.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                {p.name}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-center text-xs italic text-slate-400">
                Tidak ada nama yang cocok.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
