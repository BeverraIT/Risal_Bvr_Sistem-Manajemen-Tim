"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from "./notifications-actions";

const KIND_DOT: Record<string, string> = {
  meeting: "bg-blue-500",
  task: "bg-emerald-500",
  action_item: "bg-amber-500",
  thread: "bg-violet-500",
  info: "bg-slate-400",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export function NotificationBell({
  items,
  unread,
  tone = "dark",
}: {
  items: NotificationRow[];
  unread: number;
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  // Tutup dropdown saat klik di luar area lonceng.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const bellColor =
    tone === "dark"
      ? "text-slate-300 hover:bg-white/10 hover:text-white"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${bellColor}`}
        aria-label={unread > 0 ? `${unread} notifikasi belum dibaca` : "Notifikasi"}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-bold text-slate-800">Notifikasi</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() =>
                  startTransition(() => {
                    void markAllNotificationsRead();
                  })
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-8 text-center text-xs italic text-slate-400">
                Belum ada notifikasi.
              </p>
            )}

            {items.map((n) => {
              const inner = (
                <div className="flex gap-2.5">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      KIND_DOT[n.kind] ?? KIND_DOT.info
                    } ${n.read_at ? "opacity-30" : ""}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs leading-snug ${
                        n.read_at ? "font-medium text-slate-500" : "font-bold text-slate-800"
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{n.body}</p>
                    )}
                    <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startTransition(() => {
                          void markNotificationRead(n.id);
                        });
                      }}
                      className="shrink-0 self-start rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-emerald-600"
                      title="Tandai sudah dibaca"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );

              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read_at) {
                      startTransition(() => {
                        void markNotificationRead(n.id);
                      });
                    }
                  }}
                  className="block border-b border-slate-50 px-4 py-3 transition-colors last:border-0 hover:bg-slate-50"
                >
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className="border-b border-slate-50 px-4 py-3 last:border-0">
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
