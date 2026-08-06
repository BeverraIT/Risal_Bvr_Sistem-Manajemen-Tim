"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  ClipboardList,
  MessageSquare,
  CalendarDays,
  Settings,
  Target,
  Users2,
  NotebookPen,
} from "lucide-react";

interface SidebarNavProps {
  isAdminOrSuperadmin: boolean;
  isLeader?: boolean;
}

// Tiap modul punya identitas warna sendiri biar navigasi terasa hidup:
// gradient saat aktif, warna ikon saat idle.
const NAV_COLORS = {
  blue: { active: "from-blue-600 to-cyan-500 shadow-blue-500/20", idle: "text-blue-400" },
  violet: { active: "from-violet-600 to-purple-500 shadow-violet-500/20", idle: "text-violet-400" },
  emerald: { active: "from-emerald-600 to-teal-500 shadow-emerald-500/20", idle: "text-emerald-400" },
  cyan: { active: "from-cyan-600 to-sky-500 shadow-cyan-500/20", idle: "text-cyan-400" },
  amber: { active: "from-amber-500 to-orange-500 shadow-amber-500/20", idle: "text-amber-400" },
  rose: { active: "from-rose-600 to-pink-500 shadow-rose-500/20", idle: "text-rose-400" },
  indigo: { active: "from-indigo-600 to-blue-500 shadow-indigo-500/20", idle: "text-indigo-400" },
  slate: { active: "from-slate-600 to-slate-500 shadow-slate-500/20", idle: "text-slate-400" },
} as const;

type NavColor = keyof typeof NAV_COLORS;

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  color: NavColor;
  // Menu bercabang: parent hanya membuka/menutup daftar sub-menu, tidak
  // menavigasi ke mana-mana.
  children?: { href: string; label: string }[];
};

export function SidebarNav({ isAdminOrSuperadmin, isLeader }: SidebarNavProps) {
  const pathname = usePathname();
  const canCreateMeeting = isAdminOrSuperadmin || !!isLeader;

  const links: NavLink[] = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, color: "blue" },
    {
      href: "/tugas",
      label: "Manajemen Tugas",
      icon: Target,
      color: "amber",
      children: [
        { href: "/tugas/ide", label: "Ide" },
        { href: "/tugas/persetujuan", label: "Menunggu Persetujuan" },
        { href: "/tugas", label: "Daftar Tugas" },
      ],
    },
    { href: "/evaluasi", label: "Evaluasi & Retro", icon: ClipboardList, color: "emerald" },
    { href: "/forum", label: "Forum Diskusi", icon: MessageSquare, color: "rose" },
    {
      href: "/meeting",
      label: "Manajemen Rapat",
      icon: CalendarDays,
      color: "indigo",
      children: [
        ...(canCreateMeeting ? [{ href: "/meeting/baru", label: "Jadwalkan Rapat Baru" }] : []),
        { href: "/meeting", label: "Jadwal Rapat" },
      ],
    },
    // Alur Kerja & SOP sementara dinonaktifkan atas permintaan; kodenya tetap
    // ada di src/app/(app)/alur-kerja. Untuk menghidupkan kembali: tambahkan
    // lagi baris menunya di sini (ikon Workflow dari lucide-react, warna
    // "cyan") dan hapus penjaga di alur-kerja/layout.tsx.
    { href: "/catatan", label: "Catatan & Job List", icon: NotebookPen, color: "violet" },
  ];

  // Team Divisi: Lead Team melihat divisinya sendiri, Management/Owner semua divisi.
  if (isAdminOrSuperadmin || isLeader) {
    links.push({ href: "/pengaturan/karyawan", label: "Team Divisi", icon: Users2, color: "violet" });
  }

  // Pengaturan (Divisi CRUD & konfigurasi) khusus Management/Owner.
  if (isAdminOrSuperadmin) {
    links.push({ href: "/pengaturan", label: "Pengaturan", icon: Settings, color: "slate" });
  }

  // Exact match untuk dashboard (/), prefix untuk rute lain.
  const matches = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  // Sub-menu yang lebih spesifik menang: /meeting/baru mengalahkan /meeting.
  const activeChildHref = (children: { href: string }[]) =>
    children
      .filter((c) => matches(c.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  // Cabang yang sedang dibuka manual; kalau belum disentuh, cabang yang
  // rutenya aktif otomatis terbuka.
  const [manuallyOpen, setManuallyOpen] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex flex-col gap-1.5 text-sm">
      {links.map((link) => {
        const Icon = link.icon;
        const colors = NAV_COLORS[link.color];
        const isActive = matches(link.href);
        const itemCls = (active: boolean) =>
          `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all duration-200 ${
            active
              ? `bg-gradient-to-r ${colors.active} text-white shadow-md hover:opacity-95`
              : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1"
          }`;

        if (link.children) {
          const expanded = manuallyOpen[link.href] ?? isActive;
          const childHref = activeChildHref(link.children);
          return (
            <div key={link.href}>
              <button
                type="button"
                onClick={() => setManuallyOpen((prev) => ({ ...prev, [link.href]: !expanded }))}
                aria-expanded={expanded}
                className={itemCls(isActive)}
              >
                <Icon
                  className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? "text-white" : colors.idle
                  }`}
                />
                <span>{link.label}</span>
                <ChevronDown
                  className={`ml-auto h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                    expanded ? "rotate-180" : ""
                  } ${isActive ? "text-white/80" : "text-slate-500"}`}
                />
              </button>

              {expanded && (
                <div className="mt-1 ml-5 flex flex-col gap-1 border-l border-white/10 pl-3">
                  {link.children.map((child) => {
                    const childActive = child.href === childHref;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-all duration-200 ${
                          childActive
                            ? "bg-white/10 font-semibold text-white"
                            : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-1"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            childActive ? "bg-white/80" : "bg-slate-600"
                          }`}
                        />
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link key={link.href} href={link.href} className={itemCls(isActive)}>
            <Icon
              className={`h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                isActive ? "text-white" : colors.idle
              }`}
            />
            <span>{link.label}</span>
            {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />}
          </Link>
        );
      })}
    </nav>
  );
}
