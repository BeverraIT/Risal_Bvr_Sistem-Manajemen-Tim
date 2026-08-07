"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from "@/lib/pm";

export type CalendarTask = {
  id: string;
  title: string;
  end_date: string | null;
  status: TaskStatus;
};

const DOT_COLOR: Record<TaskStatus, string> = {
  idea: "bg-violet-500",
  waiting_approval: "bg-amber-500",
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-purple-500",
  done: "bg-emerald-500",
  cancelled: "bg-rose-400",
};

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// Kalender tugas: menampilkan task berdasarkan end_date, dengan pencarian &
// filter status. Navigasi antar bulan.
export function DashboardCalendar({ tasks }: { tasks: CalendarTask[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.end_date) return false;
        if (statusFilter && t.status !== statusFilter) return false;
        if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [tasks, search, statusFilter],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const t of filtered) {
      const d = new Date(t.end_date!);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = String(d.getDate());
        const list = map.get(key) ?? [];
        list.push(t);
        map.set(key, list);
      }
    }
    return map;
  }, [filtered, year, month]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayKey =
    now.getFullYear() === year && now.getMonth() === month ? now.getDate() : -1;

  const prev = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="min-w-[150px] text-center text-base font-bold text-slate-900">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={next} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tugas..."
              className="w-40 rounded-lg border border-slate-200 py-1.5 pl-8 pr-2 text-xs outline-none focus:border-blue-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 outline-none focus:border-blue-400"
          >
            <option value="">Semua Status</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {DAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="min-h-[64px] rounded-lg" />;
          const dayTasks = byDay.get(String(day)) ?? [];
          const isToday = day === todayKey;
          return (
            <div
              key={day}
              className={`min-h-[64px] rounded-lg border p-1.5 text-left ${
                isToday ? "border-blue-300 bg-blue-50/40" : "border-slate-100"
              }`}
            >
              <span className={`text-[11px] font-semibold ${isToday ? "text-blue-700" : "text-slate-500"}`}>
                {day}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center gap-1" title={`${t.title} — ${STATUS_LABEL[t.status]}`}>
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_COLOR[t.status]}`} />
                    <span className="truncate text-[9px] text-slate-600">{t.title}</span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] font-medium text-slate-400">+{dayTasks.length - 3} lagi</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda status */}
      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
        {TASK_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1 text-[10px] font-medium text-slate-500">
            <span className={`h-2 w-2 rounded-full ${DOT_COLOR[s]}`} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </section>
  );
}
