"use client";

import { useState, useTransition } from "react";
import { updateTaskProgress } from "../actions";
import { Check, Loader2 } from "lucide-react";

// Pengatur progress 0-100. Slider untuk mengubah cepat, tombol Simpan supaya
// tidak mengirim permintaan ke server pada tiap geseran.
export function TaskProgressControl({
  taskId,
  progress,
  bisaUbah,
}: {
  taskId: string;
  progress: number;
  bisaUbah: boolean;
}) {
  const [nilai, setNilai] = useState(progress);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const berubah = nilai !== progress;

  if (!bisaUbah) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${progress >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="w-10 text-right text-sm font-bold text-slate-600">{progress}%</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={nilai}
          disabled={pending}
          onChange={(e) => setNilai(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-600"
          aria-label="Progress tugas"
        />
        <span className="w-10 text-right text-sm font-bold text-slate-700">{nilai}%</span>
        <button
          type="button"
          disabled={pending || !berubah}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await updateTaskProgress(taskId, nilai);
              if (res.error) {
                setError(res.error);
                setNilai(progress);
              }
            })
          }
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Simpan
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  );
}
