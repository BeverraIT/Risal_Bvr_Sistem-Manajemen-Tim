import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FlowView, type IssueItem } from "../FlowView";
import { ReviewControls } from "../ReviewControls";
import {
  FLOW_STATUS_LABEL,
  FLOW_STATUS_COLOR,
  canEditFlow,
  isReviewer,
  type FlowStatus,
  type DiagramNode,
  type DiagramEdge,
  type EdgeShape,
  type FlowNodeType,
} from "@/lib/flow";
import { ArrowLeft, Pencil, Info } from "lucide-react";

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: flow } = await supabase
    .from("flows")
    .select("id, name, description, division_id, owner_id, status, version, review_note")
    .eq("id", id)
    .maybeSingle();

  if (!flow) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-semibold">Alur kerja tidak ditemukan</h1>
        <Link href="/alur-kerja" className="text-sm font-semibold text-cyan-600 hover:underline">
          &larr; Kembali ke Alur Kerja
        </Link>
      </div>
    );
  }

  const [{ data: nodeRows }, { data: edgeRows }, { data: issueRows }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("flow_nodes")
        .select("id, type, title, description, assignee_id, pos_x, pos_y")
        .eq("flow_id", id),
      supabase
        .from("flow_edges")
        .select("source_node, target_node, label, source_handle, target_handle, edge_type")
        .eq("flow_id", id),
      supabase
        .from("flow_issues")
        .select("id, node_id, description, status, reporter_id, created_at")
        .eq("flow_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const memberNames: Record<string, string> = {};
  for (const p of profiles ?? []) memberNames[p.id] = p.full_name;

  const nodes: DiagramNode[] = (nodeRows ?? []).map((n) => ({
    id: n.id,
    type: n.type as FlowNodeType,
    title: n.title,
    description: n.description,
    assigneeId: n.assignee_id,
    x: n.pos_x,
    y: n.pos_y,
  }));
  const edges: DiagramEdge[] = (edgeRows ?? []).map((e) => ({
    source: e.source_node,
    target: e.target_node,
    label: e.label,
    sourceHandle: e.source_handle ?? null,
    targetHandle: e.target_handle ?? null,
    type: (e.edge_type as EdgeShape) ?? "smoothstep",
  }));
  const issues: IssueItem[] = (issueRows ?? []).map((i) => ({
    id: i.id,
    nodeId: i.node_id,
    description: i.description,
    status: i.status as "terbuka" | "selesai",
    reporterName: i.reporter_id ? memberNames[i.reporter_id] ?? null : null,
    createdAt: i.created_at,
  }));

  const canEdit = canEditFlow(user.role, user.divisionId, flow.division_id);
  const reviewer = isReviewer(user.role);
  const status = flow.status as FlowStatus;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/alur-kerja"
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <h1 className="text-lg font-bold text-slate-800">{flow.name}</h1>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${FLOW_STATUS_COLOR[status]}`}
        >
          {FLOW_STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-slate-400">v{flow.version}</span>
        {canEdit && (
          <Link
            href={`/alur-kerja/${flow.id}/edit`}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 px-3 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-95"
          >
            <Pencil className="h-4 w-4" /> Edit Diagram
          </Link>
        )}
      </div>

      {status === "perlu_revisi" && flow.review_note && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Diminta revisi:</b> {flow.review_note}
          </span>
        </div>
      )}

      {reviewer && status === "diajukan" && <ReviewControls flowId={flow.id} />}

      {nodes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">
          Diagram masih kosong.
          {canEdit && " Klik “Edit Diagram” untuk mulai menggambar."}
        </div>
      ) : (
        <FlowView
          flowId={flow.id}
          nodes={nodes}
          edges={edges}
          issues={issues}
          memberNames={memberNames}
          canReport
          canResolve={canEdit || reviewer}
        />
      )}
    </div>
  );
}
