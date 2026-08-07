import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { TaskStatusControl } from "../TaskStatusControl";
import { TaskComments, type Komentar } from "./TaskComments";
import { TaskAttachments, type Lampiran } from "./TaskAttachments";
import { TaskProgressControl } from "./TaskProgressControl";
import { EmptyState } from "@/components/EmptyState";
import { KOLOM_TUGAS, type Tugas } from "../data";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  TYPE_LABEL,
  TYPE_COLOR,
  LEVEL_LABEL,
  LEVEL_COLOR,
  type TaskLevel,
  type TaskStatus,
  type TaskType,
} from "@/lib/pm";
import { CalendarClock, History, User2, Building2, Award, ChevronRight } from "lucide-react";

// Kata kerja riwayat dalam bahasa yang dimengerti pengguna non-IT.
const LABEL_AKSI: Record<string, string> = {
  created: "membuat tugas",
  status_changed: "mengubah status",
  approved: "menyetujui",
  rejected: "menolak",
  assigned: "mengubah penugasan",
  progress_changed: "memperbarui progress",
  commented: "menambah komentar",
  attachment_added: "menambah lampiran",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("pm_tasks")
    .select(KOLOM_TUGAS)
    .eq("id", taskId)
    .maybeSingle<Tugas>();
  if (!task) notFound();

  const [
    { data: profiles },
    { data: divisions },
    { data: komentarRaw },
    { data: lampiranRaw },
    { data: aktivitasRaw },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("divisions").select("id, name"),
    supabase
      .from("pm_task_comments")
      .select("id, content, created_at, author_id")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pm_task_attachments")
      .select("id, file_name, file_path, file_size, created_at, uploaded_by")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false }),
    supabase
      .from("pm_task_activity")
      .select("id, action, detail, created_at, actor_id")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const nama = new Map((profiles ?? []).map((p) => [p.id, p.full_name as string]));
  const divisi = new Map((divisions ?? []).map((d) => [d.id, d.name as string]));

  const isManager = user.role === "superadmin" || user.role === "admin";
  const isLeaderOfDivision = user.role === "leader" && task.division_id === user.divisionId;
  const isAssignee = task.assignee_id === user.id;
  const bisaUbahProgress = isAssignee || isManager || isLeaderOfDivision;

  const komentar: Komentar[] = (komentarRaw ?? []).map((k) => ({
    id: k.id,
    content: k.content,
    created_at: k.created_at,
    author_id: k.author_id,
    authorName: k.author_id ? nama.get(k.author_id) ?? "-" : "-",
    bisaHapus: k.author_id === user.id || isManager,
  }));

  const lampiran: Lampiran[] = (lampiranRaw ?? []).map((l) => ({
    id: l.id,
    file_name: l.file_name,
    file_path: l.file_path,
    file_size: l.file_size,
    created_at: l.created_at,
    uploaderName: l.uploaded_by ? nama.get(l.uploaded_by) ?? "-" : "-",
    bisaHapus: l.uploaded_by === user.id || isManager,
  }));

  const status = task.status as TaskStatus;
  const tenggat = task.end_date ? new Date(task.end_date) : null;

  // Halaman induk untuk tautan kembali, mengikuti tahap tugasnya sekarang.
  const induk =
    status === "idea"
      ? { href: "/tugas/ide", label: "Ide" }
      : status === "waiting_approval"
        ? { href: "/tugas/persetujuan", label: "Menunggu Persetujuan" }
        : { href: "/tugas", label: "Daftar Tugas" };

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs font-semibold text-slate-400">
        <Link href="/tugas" className="hover:text-slate-600">
          Manajemen Tugas
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={induk.href} className="hover:text-slate-600">
          {induk.label}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="truncate text-slate-600">{task.title}</span>
      </nav>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COLOR[status]}`}>
                {STATUS_LABEL[status]}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${LEVEL_COLOR[task.level as TaskLevel]}`}>
                {LEVEL_LABEL[task.level as TaskLevel]}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_COLOR[task.type as TaskType]}`}>
                {TYPE_LABEL[task.type as TaskType]}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold leading-tight text-slate-900">{task.title}</h1>
            {task.description && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {task.description}
              </p>
            )}
          </div>
          <TaskStatusControl
            taskId={task.id}
            status={status}
            isAssignee={isAssignee}
            isReviewer={isManager || isLeaderOfDivision}
          />
        </div>

        <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-xs">
            <User2 className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="text-slate-400">PIC:</dt>
            <dd className="font-semibold text-slate-700">
              {task.assignee_id ? nama.get(task.assignee_id) ?? "-" : "Belum ditugaskan"}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="text-slate-400">Divisi:</dt>
            <dd className="font-semibold text-slate-700">
              {divisi.get(task.division_id ?? "") ?? "Tanpa Divisi"}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="text-slate-400">Deadline:</dt>
            <dd className="font-semibold text-slate-700">
              {tenggat
                ? tenggat.toLocaleDateString("id-ID", { dateStyle: "medium" })
                : "Tidak ditentukan"}
            </dd>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Award className="h-4 w-4 shrink-0 text-slate-400" />
            <dt className="text-slate-400">Poin:</dt>
            <dd className="font-semibold text-slate-700">{task.points}</dd>
          </div>
        </dl>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Progress</p>
          <TaskProgressControl
            taskId={task.id}
            progress={task.progress}
            bisaUbah={bisaUbahProgress}
          />
        </div>
      </section>

      <TaskAttachments taskId={task.id} lampiran={lampiran} />

      <TaskComments taskId={task.id} komentar={komentar} />

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
          <History className="h-4.5 w-4.5 text-blue-600" />
          <span>Riwayat Aktivitas</span>
        </h2>

        {(aktivitasRaw ?? []).length === 0 ? (
          <EmptyState
            icon={History}
            title="Belum ada aktivitas tercatat"
            description="Perubahan status, progress, komentar, dan lampiran akan tercatat di sini secara otomatis."
          />
        ) : (
          <ol className="space-y-3">
            {(aktivitasRaw ?? []).map((a) => (
              <li key={a.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-600">
                    <span className="font-bold text-slate-700">
                      {a.actor_id ? nama.get(a.actor_id) ?? "-" : "Sistem"}
                    </span>{" "}
                    {LABEL_AKSI[a.action] ?? a.action}
                    {a.detail && <span className="text-slate-400"> — {a.detail}</span>}
                  </p>
                  <time className="text-[11px] text-slate-400">
                    {new Date(a.created_at).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
