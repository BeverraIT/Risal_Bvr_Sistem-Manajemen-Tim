"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Shield } from "lucide-react";
import { SidebarNav } from "./SidebarNav";

interface MobileHeaderProps {
  isAdminOrSuperadmin: boolean;
  isLeader?: boolean;
  userLabel: string;
  roleLabel: string;
  // Dirender di server (butuh data notifikasi), diselipkan sebagai slot.
  notificationBell?: React.ReactNode;
}

export function MobileHeader({
  isAdminOrSuperadmin,
  isLeader,
  userLabel,
  roleLabel,
  notificationBell,
}: MobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Tutup drawer setiap pindah halaman (pola "adjust state during render",
  // bukan setState di dalam effect)
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Kunci scroll body saat drawer terbuka
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Top bar mobile */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-rose-600 font-bold text-white shadow-md shadow-rose-600/20">
            O
          </span>
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-slate-900">
              INTERNAL OPS
            </p>
            <p className="text-[9px] text-slate-400">MNGM SYSTEM</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {notificationBell}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Buka menu navigasi"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between bg-gradient-to-b from-slate-950 via-slate-950 to-[#1a1030] p-5 text-white shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-rose-600 font-bold text-white shadow-md shadow-rose-600/20">
                O
              </span>
              <div>
                <p className="text-sm font-bold tracking-wider uppercase text-white">
                  INTERNAL OPS
                </p>
                <p className="text-[10px] text-slate-500">MNGM SYSTEM</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup menu navigasi"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Klik link mana pun langsung menutup drawer (termasuk ke rute yang sama) */}
          <div
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <SidebarNav
              isAdminOrSuperadmin={isAdminOrSuperadmin}
              isLeader={isLeader}
            />
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-4 border-t border-slate-800/80 pt-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 backdrop-blur-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-700 via-rose-600 to-pink-500 font-semibold text-white shadow-md">
              {userLabel[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{userLabel}</p>
              <div className="mt-0.5 flex items-center gap-1">
                <Shield className="h-3 w-3 text-slate-400" />
                <span className="text-[10px] font-medium text-slate-400">{roleLabel}</span>
              </div>
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition-all duration-200 hover:border-slate-700 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Keluar</span>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
