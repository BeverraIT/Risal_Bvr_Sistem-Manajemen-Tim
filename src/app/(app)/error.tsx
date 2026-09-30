"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Error boundary untuk semua halaman yang butuh login. Tanpa file ini,
// satu query/aksi yang melempar error membuat seluruh halaman blank.
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
        <AlertTriangle className="h-6 w-6 text-rose-600" />
      </span>
      <div>
        <h2 className="text-base font-bold text-slate-800">Terjadi kesalahan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Halaman ini gagal dimuat. Coba lagi -- kalau masih gagal, laporkan ke admin
          {error.digest ? (
            <>
              {" "}dengan kode <code className="font-mono text-xs">{error.digest}</code>
            </>
          ) : null}
          .
        </p>
      </div>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Coba lagi
      </button>
    </div>
  );
}
