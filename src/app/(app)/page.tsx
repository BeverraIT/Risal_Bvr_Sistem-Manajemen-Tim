import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { DashboardCalendar, type CalendarTask } from "./DashboardCalendar";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  LEVEL_LABEL,
  LEVEL_COLOR,
  LEVEL_RANK,
  type TaskLevel,
  type TaskStatus,
} from "@/lib/pm";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Layers,
  ListTodo,
  Users2,
  Clock,
  Flame,
  ClipboardList,
  ArrowUpRight,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user) return null;

  const isManager = user.role === "superadmin" || user.role === "admin";
  const isLeader = user.role === "leader";
  const canSeeTeam = isManager || isLeader;

  const now = new Date();
  const nowStr = now.toISOString();
  const weekAgoStr = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStr = nowStr.split("T")[0];
  const soonStr = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Scope tugas: Staff/Lead -> divisi sendiri; Management/Owner -> semua.
  let taskQuery = supabase
    .from("pm_tasks")
    .select("id, title, status, level, division_id, assignee_id, end_date, created_at, updated_at");
  if (!isManager && user.divisionId) taskQuery = taskQuery.eq("division_id", user.divisionId);
  else if (!isManager && !user.divisionId) taskQuery = taskQuery.eq("assignee_id", user.id);

  const [{ data: tasksRaw }, { data: divisions }, { data: profiles }, { data: meetings }] =
    await Promise.all([
      taskQuery,
      supabase.from("divisions").select("id, name"),
      supabase.from("profiles").select("id, full_name, division_id"),
      supabase
        .from("meetings")
        .select("id, title, scheduled_at, status")
        .in("status", ["scheduled", "ongoing"])
        .gte("scheduled_at", nowStr)
        .order("scheduled_at", { ascending: true }),
    ]);

  const tasks = tasksRaw ?? [];
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // --- Summary Progress Task ---
  const summary = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "done").length,
    updated: tasks.filter((t) => t.updated_at && t.updated_at >= weekAgoStr).length,
    created: tasks.filter((t) => t.created_at && t.created_at >= weekAgoStr).length,
    cancel: tasks.filter((t) => t.status === "cancelled").length,
    dueSoon: tasks.filter(
      (t) =>
        t.end_date &&
        t.end_date >= todayStr &&
        t.end_date <= soonStr &&
        t.status !== "done" &&
        t.status !== "cancelled",
    ).length,
  };

  // --- Task Priority (open, urgent dulu) ---
  const openTasks = tasks
    .filter((t) => t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      const lr = LEVEL_RANK[a.level as TaskLevel] - LEVEL_RANK[b.level as TaskLevel];
      if (lr !== 0) return lr;
      return (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999");
    })
    .slice(0, 6);

  // --- Team management ---
  const teamProfiles = (profiles ?? []).filter((p) =>
    isManager ? true : p.division_id === user.divisionId,
  );
  const completionRate = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  // --- Recent Evaluation (dari modul Retro) ---
  const { data: recentEvals } = await supabase
    .from("retros")
    .select("id, title, assignee_id, description, eval_date, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const calendarTasks: CalendarTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    end_date: t.end_date,
    status: t.status as TaskStatus,
  }));

  const summaryCards = [
    { label: "Total Tugas", value: summary.total, icon: ListTodo, tint: "from-blue-600 to-cyan-500" },
    { label: "Selesai", value: summary.completed, icon: CheckCircle2, tint: "from-emerald-600 to-teal-500" },
    { label: "Dibuat (7 hari)", value: summary.created, icon: ClipboardList, tint: "from-violet-600 to-purple-500" },
    { label: "Diperbarui (7 hari)", value: summary.updated, icon: Activity, tint: "from-indigo-600 to-blue-500" },
    { label: "Segera Jatuh Tempo", value: summary.dueSoon, icon: Clock, tint: "from-amber-500 to-orange-500" },
    { label: "Dibatalkan", value: summary.cancel, icon: Flame, tint: "from-rose-600 to-pink-500" },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Selamat datang, <span className="font-semibold text-slate-800">{user.fullName ?? user.email}</span>. Ringkasan tim &amp; proyek Anda.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-600 shadow-sm">
          <Activity className="h-4 w-4 animate-pulse text-rose-500" />
          <span>Sistem Aktif</span>
        </div>
      </div>

      {/* Summary Progress Task */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr ${c.tint} text-white shadow-md`}>
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-2xl font-extrabold text-slate-900">{c.value}</h3>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick stats row: Total Divisi (manager) + Team + KPI Divisi */}
      {canSeeTeam && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isManager && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Divisi</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-md">
                  <Layers className="h-5 w-5" />
                </span>
              </div>
              <h3 className="mt-4 text-3xl font-extrabold text-slate-900">{(divisions ?? []).length}</h3>
              <p className="mt-1 text-xs text-slate-500">Divisi terdaftar</p>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Anggota Tim</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-purple-500 text-white shadow-md">
                <Users2 className="h-5 w-5" />
              </span>
            </div>
            <h3 className="mt-4 text-3xl font-extrabold text-slate-900">{teamProfiles.length}</h3>
            <p className="mt-1 text-xs text-slate-500">{isManager ? "Seluruh divisi" : "Divisi Anda"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">KPI Divisi (Penyelesaian)</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md">
                <CheckCircle2 className="h-5 w-5" />
              </span>
            </div>
            <h3 className="mt-4 text-3xl font-extrabold text-slate-900">{completionRate}%</h3>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionRate}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Task Priority + Reminder Rapat */}
      <div className="grid gap-8 lg:grid-cols-3">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Flame className="h-5 w-5 text-rose-500" /> Prioritas Tugas
            </h2>
            <Link href="/tugas" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
              Buka Tugas &rarr;
            </Link>
          </div>
          {openTasks.length === 0 ? (
            <p className="py-6 text-center text-sm italic text-slate-400">Tidak ada tugas aktif.</p>
          ) : (
            <div className="space-y-2.5">
              {openTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{t.title}</p>
                    <p className="text-xs text-slate-400">
                      {t.assignee_id ? profileName.get(t.assignee_id) ?? "-" : "Belum ditugaskan"}
                      {t.end_date && ` · Due ${new Date(t.end_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLOR[t.level as TaskLevel]}`}>
                      {LEVEL_LABEL[t.level as TaskLevel]}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[t.status as TaskStatus]}`}>
                      {STATUS_LABEL[t.status as TaskStatus]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-900">
            <Calendar className="h-5 w-5 text-blue-600" /> Reminder Rapat
          </h2>
          {(meetings ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm italic text-slate-400">Tidak ada rapat mendatang.</p>
          ) : (
            <div className="space-y-3">
              {(meetings ?? []).slice(0, 5).map((m) => (
                <Link
                  key={m.id}
                  href={`/meeting/${m.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3 hover:border-slate-200"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{m.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(m.scheduled_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Kalender tugas */}
      <DashboardCalendar tasks={calendarTasks} />

      {/* Recent Evaluation */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <ClipboardList className="h-5 w-5 text-emerald-600" /> Evaluasi Terbaru
          </h2>
          <Link href="/evaluasi" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
            Lihat semua &rarr;
          </Link>
        </div>
        {(recentEvals ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">Belum ada evaluasi.</p>
        ) : (
          <div className="space-y-2.5">
            {(recentEvals ?? []).map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{e.title}</p>
                  <p className="truncate text-xs text-slate-400">
                    Untuk: {e.assignee_id ? profileName.get(e.assignee_id) ?? "-" : "-"}
                  </p>
                </div>
                {e.eval_date && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                    {new Date(e.eval_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
