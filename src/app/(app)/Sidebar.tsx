"use client";

import { useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, LogOut, Shield } from "lucide-react";
import { SidebarNav } from "./SidebarNav";

interface SidebarProps {
  isAdminOrSuperadmin: boolean;
  isLeader?: boolean;
  userLabel: string;
  roleLabel: string;
}

const STORAGE_KEY = "sidebar-collapsed";
const CHANGE_EVENT = "sidebar-collapsed-change";

// localStorage dibaca lewat useSyncExternalStore: server & hydration pertama
// memakai snapshot "tidak collapse", lalu React menyinkronkan tanpa
// setState-di-effect (render berantai). Akses storage dibungkus try/catch --
// bisa melempar di mode privat / storage diblokir.
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Sidebar desktop yang bisa disembunyikan/ditampilkan. Status collapse
// disimpan di localStorage supaya tidak balik terbuka tiap pindah halaman.
export function Sidebar({ isAdminOrSuperadmin, isLeader, userLabel, roleLabel }: SidebarProps) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  const toggle = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      // storage tidak tersedia -- toggle tetap tidak bisa diingat
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  if (collapsed) {
    return (
      <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center gap-4 border-r border-slate-800/60 bg-gradient-to-b from-slate-950 via-slate-950 to-[#1a1030] py-5 text-white lg:flex">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-rose-600 font-bold text-white shadow-md shadow-rose-600/20">
          B
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-label="Tampilkan sidebar"
          title="Tampilkan sidebar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-slate-800/60 bg-gradient-to-b from-slate-950 via-slate-950 to-[#1a1030] p-5 text-white lg:flex">
      {/* Glow effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 h-48 w-48 rounded-full bg-blue-500/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-24 right-0 h-56 w-56 rounded-full bg-rose-500/10 blur-3xl"
      />

      <div className="relative z-10 flex flex-col gap-8">
        {/* Logo Brand + toggle sembunyikan sidebar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-rose-600 font-bold text-white shadow-md shadow-rose-600/20">
              B
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
            onClick={toggle}
            aria-label="Sembunyikan sidebar"
            title="Sembunyikan sidebar"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Nav Menu */}
        <SidebarNav isAdminOrSuperadmin={isAdminOrSuperadmin} isLeader={isLeader} />
      </div>

      {/* User Card & Sign Out */}
      <div className="relative z-10 mt-auto flex flex-col gap-4 border-t border-slate-800/80 pt-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 backdrop-blur-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-700 via-rose-600 to-pink-500 text-white font-semibold shadow-md">
            {userLabel[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{userLabel}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] font-medium text-slate-400">{roleLabel}</span>
            </div>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-transparent px-3 py-2.5 text-left text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-white/5 hover:text-white hover:border-slate-700"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>Keluar</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
