"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ASSIGNEE_NEXT_STATUS,
  REVIEWER_NEXT_STATUS,
  TASK_LEVELS,
  TASK_STATUSES,
  TASK_TYPES,
  type TaskLevel,
  type TaskStatus,
  type TaskType,
} from "@/lib/pm";

export type ActionState = { error: string | null };

function asType(v: FormDataEntryValue | null): TaskType {
  const s = String(v ?? "");
  return (TASK_TYPES as string[]).includes(s) ? (s as TaskType) : "pengembangan";
}
function asLevel(v: FormDataEntryValue | null): TaskLevel {
  const s = String(v ?? "");
  return (TASK_LEVELS as string[]).includes(s) ? (s as TaskLevel) : "medium";
}
function asStatus(v: FormDataEntryValue | null, fallback: TaskStatus): TaskStatus {
  const s = String(v ?? "");
  return (TASK_STATUSES as string[]).includes(s) ? (s as TaskStatus) : fallback;
}
function optionalString(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

// ---------------------------------------------------------------------------
// Buat Tugas (role-aware). Staff -> idea (menunggu approval) & assign ke diri
// sendiri di divisinya. Lead -> divisinya sendiri, boleh set assignee/status/
// tanggal. Management/Owner -> bebas lintas divisi.
// ---------------------------------------------------------------------------
export async function createTask(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Nama tugas wajib diisi." };

  const type = asType(formData.get("type"));
  const level = asLevel(formData.get("level"));
  const description = optionalString(formData.get("description"));
  const projectId = optionalString(formData.get("project_id"));

  const supabase = await createClient();

  // Bangun payload sesuai peran.
  const base: Record<string, unknown> = {
    title,
    description,
    type,
    level,
    project_id: projectId,
    created_by: user.id,
  };

  if (user.role === "staff") {
    if (!user.divisionId) return { error: "Akun Anda belum punya divisi." };
    base.status = "idea"; // menunggu approval Lead/Management
    base.assignee_id = user.id;
    base.division_id = user.divisionId;
  } else if (user.role === "leader") {
    if (!user.divisionId) return { error: "Akun Anda belum punya divisi." };
    base.division_id = user.divisionId;
    base.status = asStatus(formData.get("status"), "todo");
    base.start_date = optionalString(formData.get("start_date"));
    base.end_date = optionalString(formData.get("end_date"));
    const assigneeId = optionalString(formData.get("assignee_id"));
    if (assigneeId) {
      // Pastikan assignee memang anggota divisi Lead ini.
      const { data: prof } = await supabase
        .from("profiles")
        .select("division_id")
        .eq("id", assigneeId)
        .maybeSingle();
      if (prof?.division_id !== user.divisionId) {
        return { error: "Assignee harus anggota divisi Anda." };
      }
      base.assignee_id = assigneeId;
    }

    const { data: task, error } = await supabase.from("pm_tasks").insert(base).select("id").single();
    if (error) return { error: error.message };

    const staffIds = formData
      .getAll("staff_ids")
      .map((v) => String(v).trim())
      .filter((id) => Boolean(id) && id !== assigneeId);
    if (staffIds.length > 0) {
      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, division_id")
        .in("id", staffIds);
      const validStaffIds = (staffProfiles ?? [])
        .filter((p) => p.division_id === user.divisionId)
        .map((p) => p.id);
      if (validStaffIds.length > 0) {
        await supabase
          .from("pm_task_staff")
          .insert(validStaffIds.map((uid) => ({ task_id: task.id, user_id: uid })));
      }
    }

    revalidatePath("/tugas");
  revalidatePath("/tugas/ide");
  revalidatePath("/tugas/persetujuan");
    revalidatePath("/");
    if (projectId) revalidatePath(`/tugas/proyek/${projectId}`);
    return { error: null };
  } else {
    // Management / Owner: boleh memilih lebih dari satu divisi — sistem
    // membuat satu tugas per divisi terpilih.
    const divisionIds = formData
      .getAll("division_ids")
      .map((v) => String(v).trim())
      .filter(Boolean);
    // Kompatibel dengan form lama yang mengirim satu division_id.
    const single = optionalString(formData.get("division_id"));
    if (divisionIds.length === 0 && single) divisionIds.push(single);
    if (divisionIds.length === 0) return { error: "Pilih minimal satu divisi." };

    // ACC Owner opsional: hanya Management (admin) & tipe "fitur". Jika minta
    // ACC, tugas masuk sebagai Ide menunggu persetujuan Owner.
    const needAcc = user.role === "admin" && type === "fitur" && formData.get("need_acc") === "1";
    base.status = needAcc ? "idea" : asStatus(formData.get("status"), "todo");
    base.start_date = optionalString(formData.get("start_date"));
    base.end_date = optionalString(formData.get("end_date"));

    // PIC hanya dipasang pada tugas di divisinya sendiri; salinan untuk
    // divisi lain dibiarkan "Belum ditugaskan".
    const assigneeId = optionalString(formData.get("assignee_id"));
    let assigneeDivision: string | null = null;
    if (assigneeId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("division_id")
        .eq("id", assigneeId)
        .maybeSingle();
      assigneeDivision = prof?.division_id ?? null;
    }

    const rows = divisionIds.map((divId) => ({
      ...base,
      division_id: divId,
      assignee_id: assigneeId && assigneeDivision === divId ? assigneeId : null,
    }));

    const { data: createdTasks, error } = await supabase.from("pm_tasks").insert(rows).select("id, division_id");
    if (error) return { error: error.message };

    // Staff pelaksana: hanya dipasang pada salinan tugas di divisi mereka sendiri.
    const staffIds = formData
      .getAll("staff_ids")
      .map((v) => String(v).trim())
      .filter(Boolean);
    if (staffIds.length > 0 && createdTasks) {
      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, division_id")
        .in("id", staffIds);
      const staffByDivision = new Map<string, string[]>();
      for (const p of staffProfiles ?? []) {
        if (!p.division_id) continue;
        const list = staffByDivision.get(p.division_id) ?? [];
        if (!(assigneeId && p.id === assigneeId && assigneeDivision === p.division_id)) list.push(p.id);
        staffByDivision.set(p.division_id, list);
      }
      const staffRows = createdTasks.flatMap((t) =>
        (staffByDivision.get(t.division_id) ?? []).map((uid) => ({ task_id: t.id, user_id: uid })),
      );
      if (staffRows.length > 0) {
        await supabase.from("pm_task_staff").insert(staffRows);
      }
    }

    revalidatePath("/tugas");
  revalidatePath("/tugas/ide");
  revalidatePath("/tugas/persetujuan");
    revalidatePath("/");
    if (projectId) revalidatePath(`/tugas/proyek/${projectId}`);
    return { error: null };
  }

  const { error } = await supabase.from("pm_tasks").insert(base);
  if (error) return { error: error.message };

  revalidatePath("/tugas");
  revalidatePath("/tugas/ide");
  revalidatePath("/tugas/persetujuan");
  revalidatePath("/");
  if (projectId) revalidatePath(`/tugas/proyek/${projectId}`);
  return { error: null };
}

// ---------------------------------------------------------------------------
// Ubah status task (validasi transisi per peran).
// ---------------------------------------------------------------------------
export async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("pm_tasks")
    .select("id, status, assignee_id, division_id")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { error: "Task tidak ditemukan." };

  const isReviewer =
    user.role === "superadmin" ||
    user.role === "admin" ||
    (user.role === "leader" && task.division_id === user.divisionId);
  const isAssignee = task.assignee_id === user.id;

  const allowed = new Set<TaskStatus>();
  if (isAssignee) ASSIGNEE_NEXT_STATUS[task.status as TaskStatus].forEach((s) => allowed.add(s));
  if (isReviewer) REVIEWER_NEXT_STATUS[task.status as TaskStatus].forEach((s) => allowed.add(s));

  if (!allowed.has(newStatus)) {
    return { error: "Perubahan status ini tidak diizinkan." };
  }

  const { error } = await supabase.from("pm_tasks").update({ status: newStatus }).eq("id", taskId);
  if (error) return { error: error.message };

  revalidatePath("/tugas");
  revalidatePath("/tugas/ide");
  revalidatePath("/tugas/persetujuan");
  revalidatePath("/");
  return { error: null };
}

// Approve idea -> todo (khusus reviewer).
export async function approveIdeaTask(taskId: string) {
  return updateTaskStatus(taskId, "todo");
}

// Tolak / batalkan task -> cancelled (khusus reviewer).
export async function rejectTask(taskId: string) {
  return updateTaskStatus(taskId, "cancelled");
}

// ---------------------------------------------------------------------------
// Proyek (Management / Owner).
// ---------------------------------------------------------------------------
export async function createProject(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "superadmin" && user.role !== "admin") {
    return { error: "Hanya Management atau Owner yang dapat membuat proyek." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nama proyek wajib diisi." };

  // Boleh lebih dari satu divisi — satu proyek dibuat per divisi terpilih.
  const divisionIds = formData
    .getAll("division_ids")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const single = optionalString(formData.get("division_id"));
  if (divisionIds.length === 0 && single) divisionIds.push(single);
  if (divisionIds.length === 0) return { error: "Pilih minimal satu divisi." };

  const type = asType(formData.get("type"));
  // ACC Owner opsional: hanya Management (admin) & tipe "fitur".
  const needAcc = user.role === "admin" && type === "fitur" && formData.get("need_acc") === "1";
  const status = needAcc ? ("idea" as TaskStatus) : asStatus(formData.get("status"), "todo");

  const supabase = await createClient();

  // PIC hanya dipasang pada proyek di divisinya sendiri.
  const assigneeId = optionalString(formData.get("assignee_id"));
  let assigneeDivision: string | null = null;
  if (assigneeId) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("division_id")
      .eq("id", assigneeId)
      .maybeSingle();
    assigneeDivision = prof?.division_id ?? null;
  }

  const rows = divisionIds.map((divId) => ({
    name,
    description: optionalString(formData.get("description")),
    division_id: divId,
    start_date: optionalString(formData.get("start_date")),
    end_date: optionalString(formData.get("end_date")),
    type,
    status,
    level: asLevel(formData.get("level")),
    assignee_id: assigneeId && assigneeDivision === divId ? assigneeId : null,
    created_by: user.id,
  }));

  const { data: projects, error } = await supabase
    .from("pm_projects")
    .insert(rows)
    .select("id");

  if (error) return { error: error.message };
  revalidatePath("/tugas/proyek");
  // Satu divisi -> langsung ke detail proyeknya; lebih dari satu -> ke daftar.
  if (projects?.length === 1) redirect(`/tugas/proyek/${projects[0].id}`);
  redirect("/tugas/proyek");
}

export async function updateProjectStatus(projectId: string, newStatus: TaskStatus) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "superadmin" && user.role !== "admin") {
    return { error: "Tidak diizinkan." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pm_projects")
    .update({ status: newStatus })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/tugas/proyek");
  revalidatePath(`/tugas/proyek/${projectId}`);
  return { error: null };
}
