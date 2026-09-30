"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { runAction } from "@/lib/client-action";

// Tombol hapus dengan dialog konfirmasi. `action` adalah server action yang
// sudah di-bind dengan id target. Hanya dirender untuk role yang berhak
// (dicek di server component pemanggil + RLS di database).
export function ConfirmDeleteButton({
  action,
  label = "Hapus",
  confirmMessage,
}: {
  action: () => Promise<void>;
  label?: string;
  confirmMessage: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmMessage)) {
          startTransition(async () => {
            await runAction(action, "Gagal menghapus. Anda mungkin tidak berhak, atau koneksi terputus.");
          });
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Menghapus..." : label}
    </button>
  );
}
