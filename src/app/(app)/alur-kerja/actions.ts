"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canEditFlow, isReviewer, type DiagramPayload } from "@/lib/flow";

export type ActionState = { error: string | null };

// Ambil flow + role/divisi user, lalu pastikan user boleh mengedit.
// Mengembalikan pesan error string bila tidak boleh, atau null bila boleh.
async function assertCanEdit(flowId: string): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return "Sesi tidak ditemukan.";
  const supabase = await createClient();
  const { data: flow } = await supabase
    .from("flows")
    .select("division_id")
    .eq("id", flowId)
    .maybeSingle();
  if (!flow) return "Alur kerja tidak ditemukan.";
  if (!canEditFlow(user.role, user.divisionId, flow.division_id)) {
    return "Hanya leader pemilik divisi yang boleh mengubah alur ini.";
  }
  return null;
}

// --- Buat / ubah metadata flow --------------------------------------------

export async function createFlow(
  _prev: ActionState & { id?: string },
  formData: FormData,
): Promise<ActionState & { id?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi tidak ditemukan." };
  if (user.role !== "leader") {
    return { error: "Hanya Lead Team yang bisa membuat alur kerja." };
  }
  if (!user.divisionId) {
    return { error: "Akun Anda belum terhubung ke divisi mana pun." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nama alur wajib diisi." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("flows")
    .insert({
      name,
      description: String(formData.get("description") ?? "") || null,
      division_id: user.divisionId,
      owner_id: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Benih node "Mulai" & "Selesai" supaya kanvas tidak kosong melompong.
  const { error: seedError } = await supabase.from("flow_nodes").insert([
    { flow_id: data.id, type: "mulai", title: "Mulai", pos_x: 250, pos_y: 40 },
    { flow_id: data.id, type: "selesai", title: "Selesai", pos_x: 250, pos_y: 360 },
  ]);
  // Tidak fatal: alurnya sudah tersimpan, node bisa ditambah manual di editor.
  if (seedError) console.error("Gagal membuat node awal alur:", seedError.message);

  revalidatePath("/alur-kerja");
  return { error: null, id: data.id };
}

export async function renameFlow(
  id: string,
  data: { name: string; description: string | null },
): Promise<ActionState> {
  const denied = await assertCanEdit(id);
  if (denied) return { error: denied };

  const supabase = await createClient();
  const { error } = await supabase
    .from("flows")
    .update({ name: data.name.trim(), description: data.description || null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/alur-kerja");
  revalidatePath(`/alur-kerja/${id}`);
  return { error: null };
}

export async function deleteFlow(id: string): Promise<ActionState> {
  const denied = await assertCanEdit(id);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase.from("flows").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/alur-kerja");
  return { error: null };
}

// --- Simpan diagram (nodes + edges) ---------------------------------------
// Strategi: upsert node yang ada (id stabil supaya masalah yang menempel tidak
// hilang), hapus node yang dibuang user, lalu ganti total edges.

export async function saveDiagram(
  flowId: string,
  payload: DiagramPayload,
): Promise<ActionState> {
  const denied = await assertCanEdit(flowId);
  if (denied) return { error: denied };
  const supabase = await createClient();

  const incomingIds = payload.nodes.map((n) => n.id);

  // 1. Hapus node yang tidak ada lagi (cascade: edge & issue-nya ikut hilang).
  const { data: existing } = await supabase
    .from("flow_nodes")
    .select("id")
    .eq("flow_id", flowId);
  const toDelete = (existing ?? [])
    .map((r) => r.id)
    .filter((id) => !incomingIds.includes(id));
  if (toDelete.length > 0) {
    const { error } = await supabase.from("flow_nodes").delete().in("id", toDelete);
    if (error) return { error: error.message };
  }

  // 2. Upsert node yang tersisa.
  if (payload.nodes.length > 0) {
    const rows = payload.nodes.map((n) => ({
      id: n.id,
      flow_id: flowId,
      type: n.type,
      title: n.title,
      description: n.description,
      assignee_id: n.assigneeId,
      pos_x: n.x,
      pos_y: n.y,
    }));
    const { error } = await supabase.from("flow_nodes").upsert(rows);
    if (error) return { error: error.message };
  }

  // 3. Ganti total edges (tidak ada yang mereferensikan edge, jadi aman).
  const { error: delErr } = await supabase.from("flow_edges").delete().eq("flow_id", flowId);
  if (delErr) return { error: delErr.message };
  if (payload.edges.length > 0) {
    const edgeRows = payload.edges.map((e) => ({
      flow_id: flowId,
      source_node: e.source,
      target_node: e.target,
      label: e.label,
      source_handle: e.sourceHandle,
      target_handle: e.targetHandle,
      edge_type: e.type,
    }));
    const { error } = await supabase.from("flow_edges").insert(edgeRows);
    if (error) return { error: error.message };
  }

  revalidatePath(`/alur-kerja/${flowId}`);
  revalidatePath(`/alur-kerja/${flowId}/edit`);
  return { error: null };
}

// --- Alur persetujuan ------------------------------------------------------

export async function submitFlow(id: string): Promise<ActionState> {
  const denied = await assertCanEdit(id);
  if (denied) return { error: denied };
  const supabase = await createClient();
  const { error } = await supabase
    .from("flows")
    .update({ status: "diajukan", review_note: null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/alur-kerja");
  revalidatePath(`/alur-kerja/${id}`);
  return { error: null };
}

export async function reviewFlow(
  id: string,
  decision: "setujui" | "revisi",
  note: string | null,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi tidak ditemukan." };
  if (!isReviewer(user.role)) {
    return { error: "Hanya Management/Owner yang boleh me-review." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("flows")
    .update({
      status: decision === "setujui" ? "disetujui" : "perlu_revisi",
      review_note: decision === "revisi" ? note : null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/alur-kerja");
  revalidatePath(`/alur-kerja/${id}`);
  return { error: null };
}

// --- Masalah per node (peta titik rawan) ----------------------------------

export async function reportIssue(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi tidak ditemukan." };
  const flowId = String(formData.get("flowId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  if (!flowId || !nodeId) return { error: "Node tidak valid." };
  if (!description) return { error: "Deskripsi masalah wajib diisi." };

  const supabase = await createClient();
  const { error } = await supabase.from("flow_issues").insert({
    flow_id: flowId,
    node_id: nodeId,
    reporter_id: user.id,
    description,
  });
  if (error) return { error: error.message };
  revalidatePath(`/alur-kerja/${flowId}`);
  return { error: null };
}

export async function resolveIssue(
  issueId: string,
  flowId: string,
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi tidak ditemukan." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("flow_issues")
    .update({ status: "selesai", resolved_at: new Date().toISOString() })
    .eq("id", issueId);
  if (error) return { error: error.message };
  revalidatePath(`/alur-kerja/${flowId}`);
  return { error: null };
}
