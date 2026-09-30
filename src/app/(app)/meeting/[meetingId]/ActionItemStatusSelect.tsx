"use client";

import { useState, useTransition } from "react";
import { updateActionItemStatus } from "../actions";

const STATUS_LABEL: Record<string, string> = {
  open: "Belum mulai",
  in_progress: "Berjalan",
  done: "Selesai",
  carried_over: "Dilanjutkan",
};

export function ActionItemStatusSelect({
  meetingId,
  itemId,
  status,
}: {
  meetingId: string;
  itemId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(status);

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        const previous = value;
        setValue(next);
        startTransition(async () => {
          try {
            const res = await updateActionItemStatus(meetingId, itemId, next);
            if (res.error) {
              setValue(previous);
              window.alert(res.error);
            }
          } catch {
            setValue(previous);
            window.alert("Gagal mengubah status. Periksa koneksi lalu coba lagi.");
          }
        });
      }}
      className="rounded-xl border border-slate-200 bg-white shadow-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 px-2 py-1 text-xs disabled:opacity-50"
    >
      {Object.entries(STATUS_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
