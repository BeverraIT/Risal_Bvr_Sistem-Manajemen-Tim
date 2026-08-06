// Konstanta & label untuk modul Alur Kerja / SOP (diagram).
// Client-safe: tidak mengimpor apa pun yang server-only, jadi boleh dipakai
// di Server maupun Client Components.

import type { AppRole } from "@/lib/roles";

export type FlowStatus = "draft" | "diajukan" | "disetujui" | "perlu_revisi";
export type FlowNodeType = "mulai" | "langkah" | "keputusan" | "selesai";
export type FlowIssueStatus = "terbuka" | "selesai";

export const FLOW_STATUSES: FlowStatus[] = [
  "draft",
  "diajukan",
  "disetujui",
  "perlu_revisi",
];

export const FLOW_STATUS_LABEL: Record<FlowStatus, string> = {
  draft: "Draft",
  diajukan: "Menunggu Persetujuan",
  disetujui: "Disetujui",
  perlu_revisi: "Perlu Revisi",
};

export const FLOW_STATUS_COLOR: Record<FlowStatus, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  diajukan: "bg-amber-50 text-amber-700 border-amber-100",
  disetujui: "bg-emerald-50 text-emerald-700 border-emerald-100",
  perlu_revisi: "bg-rose-50 text-rose-700 border-rose-100",
};

export const NODE_TYPES: FlowNodeType[] = [
  "mulai",
  "langkah",
  "keputusan",
  "selesai",
];

export const NODE_TYPE_LABEL: Record<FlowNodeType, string> = {
  mulai: "Mulai",
  langkah: "Langkah",
  keputusan: "Keputusan",
  selesai: "Selesai",
};

// Warna dasar tiap tipe node di kanvas diagram (dipakai oleh custom node).
export const NODE_TYPE_COLOR: Record<
  FlowNodeType,
  { bg: string; border: string; text: string }
> = {
  mulai: { bg: "#ecfdf5", border: "#34d399", text: "#065f46" },
  langkah: { bg: "#eff6ff", border: "#60a5fa", text: "#1e3a8a" },
  keputusan: { bg: "#fffbeb", border: "#fbbf24", text: "#92400e" },
  selesai: { bg: "#f1f5f9", border: "#94a3b8", text: "#334155" },
};

// --- Hak akses (dipakai di server & client) -------------------------------

export function isReviewer(role: AppRole): boolean {
  return role === "admin" || role === "superadmin";
}

// Leader boleh mengedit flow bila ia pemilik divisi flow tsb.
export function canEditFlow(
  role: AppRole,
  userDivisionId: string | null,
  flowDivisionId: string | null,
): boolean {
  return role === "leader" && !!flowDivisionId && userDivisionId === flowDivisionId;
}

// --- Bentuk data diagram yang dikirim editor -> server ---------------------
// Sengaja polos (serializable) supaya aman lewat Server Action.
export type DiagramNode = {
  id: string;
  type: FlowNodeType;
  title: string;
  description: string | null;
  assigneeId: string | null;
  x: number;
  y: number;
};

export type DiagramEdge = {
  source: string;
  target: string;
  label: string | null;
};

export type DiagramPayload = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

// --- Heatmap titik rawan ---------------------------------------------------
// Ubah jumlah masalah terbuka pada sebuah node menjadi "suhu" 0..1 untuk
// mewarnai node makin merah. Di atas HEAT_CAP dianggap paling panas.
export const HEAT_CAP = 5;

export function heatLevel(openIssues: number): number {
  return Math.min(openIssues, HEAT_CAP) / HEAT_CAP;
}
