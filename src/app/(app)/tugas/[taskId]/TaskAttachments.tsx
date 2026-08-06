"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  registerTaskAttachment,
  deleteTaskAttachment,
  getAttachmentUrl,
} from "../actions";
import { Paperclip, Upload, Trash2, Download, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { pesanError } from "@/lib/errors";

// Batas ukuran lampiran. File diunggah langsung dari browser ke Storage,
// jadi tidak terkena batas body serverless Vercel yang ~4.5MB.
const MAKS_BYTE = 20 * 1024 * 1024;

export type Lampiran = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
  uploaderName: string;
  bisaHapus: boolean;
};

const ukuran = (b: number | null) => {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};

export function TaskAttachments({
  taskId,
  lampiran,
}: {
  taskId: string;
  lampiran: Lampiran[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mengunggah, setMengunggah] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pilihFile = async (file: File) => {
    setError(null);
    if (file.size > MAKS_BYTE) {
      setError(`File terlalu besar (maks ${MAKS_BYTE / 1024 / 1024} MB).`);
      return;
    }

    setMengunggah(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

      const { error: eUpload } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (eUpload) throw new Error(eUpload.message);

      const res = await registerTaskAttachment({
        taskId,
        fileName: file.name,
        filePath: path,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      });
      if (res.error) throw new Error(res.error);

      router.refresh();
    } catch (err: unknown) {
      setError(pesanError(err, "Gagal mengunggah lampiran."));
    } finally {
      setMengunggah(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Bucket-nya privat, jadi unduhan harus lewat link bertanda tangan yang
  // dibuat sesaat sebelum dibuka.
  const unduh = (path: string) =>
    startTransition(async () => {
      const { url, error: e } = await getAttachmentUrl(path);
      if (e || !url) {
        setError(e ?? "Gagal membuat tautan unduhan.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <Paperclip className="h-4.5 w-4.5 text-blue-600" />
          <span>Lampiran</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">
            {lampiran.length}
          </span>
        </h2>
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 ${
            mengunggah ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {mengunggah ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          <span>{mengunggah ? "Mengunggah…" : "Unggah File"}</span>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            disabled={mengunggah}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pilihFile(f);
            }}
          />
        </label>
      </div>

      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      {lampiran.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="Belum ada lampiran"
          description={`Unggah dokumen, gambar, atau berkas pendukung tugas ini. Maksimal ${MAKS_BYTE / 1024 / 1024} MB per file.`}
        />
      ) : (
        <ul className="space-y-2">
          {lampiran.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-700">{l.file_name}</p>
                <p className="text-[11px] text-slate-400">
                  {l.uploaderName}
                  {ukuran(l.file_size) && ` · ${ukuran(l.file_size)}`}
                  {" · "}
                  {new Date(l.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => unduh(l.file_path)}
                  aria-label={`Unduh ${l.file_name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:text-blue-600 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                {l.bisaHapus && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await deleteTaskAttachment(taskId, l.id, l.file_path);
                        router.refresh();
                      })
                    }
                    aria-label={`Hapus ${l.file_name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
