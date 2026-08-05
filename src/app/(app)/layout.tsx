import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_LABEL } from "@/lib/auth";
import { SidebarNav } from "./SidebarNav";
import { MobileHeader } from "./MobileHeader";
import { NotificationBell } from "./NotificationBell";
import { getMyNotifications } from "./notifications-actions";
import { LogOut, Shield } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAdminOrSuperadmin = user.role === "superadmin" || user.role === "admin";
  const isLeader = user.role === "leader";
  const userLabel = user.fullName ?? user.email ?? "?";
  const { items: notifications, unread } = await getMyNotifications();

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800 antialiased">
      {/* Header + drawer khusus layar kecil (Android/iOS) */}
      <MobileHeader
        isAdminOrSuperadmin={isAdminOrSuperadmin}
        isLeader={isLeader}
        userLabel={userLabel}
        roleLabel={ROLE_LABEL[user.role]}
        notificationBell={
          <NotificationBell items={notifications} unread={unread} tone="light" />
        }
      />

      <div className="flex">
        {/* Sidebar desktop -- sticky supaya menu selalu terlihat saat scroll */}
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
            {/* Logo Brand */}
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
                  <span className="text-[10px] font-medium text-slate-400">
                    {ROLE_LABEL[user.role]}
                  </span>
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

        {/* Main Content Area */}
        <main className="relative min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {/* Latar berwarna lembut biar halaman tidak terasa datar */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-blue-200/30 blur-3xl" />
            <div className="absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-rose-200/25 blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-100/30 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-6xl animate-page-in">
            {/* Bar lonceng khusus desktop -- di mobile sudah ada di MobileHeader. */}
            <div className="mb-2 hidden justify-end lg:flex">
              <NotificationBell items={notifications} unread={unread} tone="light" />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
