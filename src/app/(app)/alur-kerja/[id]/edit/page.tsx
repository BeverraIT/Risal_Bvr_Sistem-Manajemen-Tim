import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { FlowEditor } from "../../FlowEditor";
import {
  canEditFlow,
  type DiagramNode,
  type DiagramEdge,
  type FlowNodeType,
} from "@/lib/flow";

export default async function FlowEditPage({
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
    .select("id, name, division_id, status, review_note")
    .eq("id", id)
    .maybeSingle();

  if (!flow || !canEditFlow(user.role, user.divisionId, flow.division_id)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-semibold">Tidak dapat mengedit</h1>
        <p className="text-sm text-slate-500">
          Hanya Lead Team pemilik divisi yang boleh mengedit alur ini.
        </p>
        <Link href="/alur-kerja" className="text-sm font-semibold text-cyan-600 hover:underline">
          &larr; Kembali ke Alur Kerja
        </Link>
      </div>
    );
  }

  const [{ data: nodeRows }, { data: edgeRows }, { data: members }] = await Promise.all([
    supabase
      .from("flow_nodes")
      .select("id, type, title, description, assignee_id, pos_x, pos_y")
      .eq("flow_id", id),
    supabase.from("flow_edges").select("source_node, target_node, label").eq("flow_id", id),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("division_id", flow.division_id ?? "")
      .order("full_name"),
  ]);

  const initialNodes: DiagramNode[] = (nodeRows ?? []).map((n) => ({
    id: n.id,
    type: n.type as FlowNodeType,
    title: n.title,
    description: n.description,
    assigneeId: n.assignee_id,
    x: n.pos_x,
    y: n.pos_y,
  }));
  const initialEdges: DiagramEdge[] = (edgeRows ?? []).map((e) => ({
    source: e.source_node,
    target: e.target_node,
    label: e.label,
  }));

  return (
    <FlowEditor
      flowId={flow.id}
      flowName={flow.name}
      status={flow.status}
      reviewNote={flow.review_note}
      members={(members ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
      initialNodes={initialNodes}
      initialEdges={initialEdges}
    />
  );
}
