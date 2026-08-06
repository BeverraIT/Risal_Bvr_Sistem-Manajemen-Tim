"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { reviewFlow } from "./actions";

export function ReviewControls({ flowId }: { flowId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [showRevisi, setShowRevisi] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const decide = (decision: "setujui" | "revisi") =>
    start(async () => {
      setErr(null);
      const res = await reviewFlow(flowId, decision, decision === "revisi" ? note : null);
      if (res.error) setErr(res.error);
    });

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-bold text-amber-800">Menunggu persetujuan Anda</h3>
      <p className="mt-0.5 text-xs text-amber-700">
        Sebagai Management/Owner, tinjau alur ini lalu setujui atau minta revisi.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => decide("setujui")}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" /> Setujui
        </button>
        <button
          onClick={() => setShowRevisi((v) => !v)}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" /> Minta Revisi
        </button>
      </div>
      {showRevisi && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Catatan revisi untuk leader…"
            className="w-full resize-none rounded-lg border border-amber-200 px-2.5 py-2 text-sm outline-none focus:border-amber-400"
          />
          <button
            onClick={() => decide("revisi")}
            disabled={pending || !note.trim()}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
          >
            {pending ? "Mengirim..." : "Kirim permintaan revisi"}
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
