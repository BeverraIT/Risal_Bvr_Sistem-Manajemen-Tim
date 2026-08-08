import { redirect } from "next/navigation";
import { getCurrentUser, ROLE_LABEL } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { NotificationBell } from "./NotificationBell";
import { getMyNotifications } from "./notifications-actions";

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
        {/* Sidebar desktop -- sticky supaya menu selalu terlihat saat scroll, bisa disembunyikan */}
        <Sidebar
          isAdminOrSuperadmin={isAdminOrSuperadmin}
          isLeader={isLeader}
          userLabel={userLabel}
          roleLabel={ROLE_LABEL[user.role]}
        />

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
