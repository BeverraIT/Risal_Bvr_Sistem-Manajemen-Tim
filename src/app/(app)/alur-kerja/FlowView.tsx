"use client";

import "@xyflow/react/dist/style.css";
import { useMemo, useState, useTransition } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  MarkerType,
  ConnectionMode,
} from "@xyflow/react";
import { AlertTriangle, CheckCircle2, Flame } from "lucide-react";
import { nodeTypes, type StepNodeData } from "./StepNode";
import type { DiagramNode, DiagramEdge } from "@/lib/flow";
import { reportIssue, resolveIssue, type ActionState } from "./actions";
import { useActionState } from "react";

export type IssueItem = {
  id: string;
  nodeId: string;
  description: string;
  status: "terbuka" | "selesai";
  reporterName: string | null;
  createdAt: string;
};

type Props = {
  flowId: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  issues: IssueItem[];
  memberNames: Record<string, string>;
  canReport: boolean;
  canResolve: boolean;
};

function ViewInner({
  flowId,
  nodes,
  edges,
  issues,
  memberNames,
  canReport,
  canResolve,
}: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const openByNode = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of issues) if (i.status === "terbuka") m[i.nodeId] = (m[i.nodeId] ?? 0) + 1;
    return m;
  }, [issues]);

  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: "step",
        position: { x: n.x, y: n.y },
        draggable: false,
        data: {
          title: n.title,
          kind: n.type,
          description: n.description,
          assigneeName: n.assigneeId ? memberNames[n.assigneeId] ?? null : null,
          openIssues: openByNode[n.id] ?? 0,
        } as StepNodeData,
      })),
    [nodes, memberNames, openByNode],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e, i) => ({
        id: `e${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        // Sisi & bentuk garis harus ikut dibaca, kalau tidak diagram yang
        // dilihat orang lain tampil beda dari yang disusun di editor.
        sourceHandle: e.sourceHandle ?? undefined,
        targetHandle: e.targetHandle ?? undefined,
        type: e.type ?? "smoothstep",
        label: e.label ?? undefined,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
        style: { strokeWidth: 2 },
      })),
    [edges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const nodeIssues = issues.filter((i) => i.nodeId === selectedNodeId);

  // Ranking titik rawan (node dgn masalah terbuka terbanyak).
  const hotspots = useMemo(() => {
    return Object.entries(openByNode)
      .map(([id, count]) => ({
        id,
        count,
        title: nodes.find((n) => n.id === id)?.title ?? "(node terhapus)",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [openByNode, nodes]);

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          onNodeClick={(_, n) => setSelectedNodeId(n.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          connectionMode={ConnectionMode.Loose}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>

      <div className="w-80 shrink-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {selectedNode ? (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">{selectedNode.title}</h3>
              {selectedNode.description && (
                <p className="mt-1 text-xs text-slate-500">{selectedNode.description}</p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Masalah pada langkah ini
              </h4>
              {nodeIssues.length === 0 && (
                <p className="text-xs text-slate-400">Belum ada masalah dilaporkan.</p>
              )}
              {nodeIssues.map((iss) => (
                <IssueRow key={iss.id} issue={iss} flowId={flowId} canResolve={canResolve} />
              ))}
            </div>

            {canReport && (
              <ReportForm flowId={flowId} nodeId={selectedNode.id} />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <Flame className="h-4 w-4 text-rose-500" /> Titik rawan
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Langkah dengan masalah terbuka terbanyak. Klik kotak di diagram untuk detail.
              </p>
            </div>
            {hotspots.length === 0 ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                Tidak ada masalah terbuka. 🎉
              </p>
            ) : (
              <ol className="space-y-1.5">
                {hotspots.map((h, idx) => (
                  <li
                    key={h.id}
                    onClick={() => setSelectedNodeId(h.id)}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-100 px-2.5 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <span className="truncate">
                      <span className="mr-1 text-slate-400">{idx + 1}.</span>
                      {h.title}
                    </span>
                    <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {h.count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const reportInitial: ActionState = { error: null };

function ReportForm({ flowId, nodeId }: { flowId: string; nodeId: string }) {
  const [state, action, pending] = useActionState(reportIssue, reportInitial);
  return (
    <form action={action} className="space-y-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="flowId" value={flowId} />
      <input type="hidden" name="nodeId" value={nodeId} />
      <label className="block text-xs font-semibold text-slate-600">
        Laporkan masalah di langkah ini
      </label>
      <textarea
        name="description"
        required
        rows={2}
        placeholder="Apa yang sering salah / menghambat di sini?"
        className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-cyan-400"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "Mengirim..." : "Lapor masalah"}
      </button>
      {state.error && <p className="text-xs text-rose-600">{state.error}</p>}
    </form>
  );
}

function IssueRow({
  issue,
  flowId,
  canResolve,
}: {
  issue: IssueItem;
  flowId: string;
  canResolve: boolean;
}) {
  const [pending, start] = useTransition();
  const done = issue.status === "selesai";
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-xs ${
        done ? "border-slate-100 bg-slate-50 text-slate-400" : "border-rose-100 bg-rose-50/60"
      }`}
    >
      <p className={done ? "line-through" : "text-slate-700"}>{issue.description}</p>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          {issue.reporterName ?? "Anonim"} · {new Date(issue.createdAt).toLocaleDateString("id-ID")}
        </span>
        {!done && canResolve && (
          <button
            onClick={() => start(() => resolveIssue(issue.id, flowId).then(() => {}))}
            disabled={pending}
            className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline disabled:opacity-50"
          >
            <CheckCircle2 className="h-3 w-3" /> {pending ? "..." : "Selesai"}
          </button>
        )}
        {done && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3 w-3" /> selesai</span>}
      </div>
    </div>
  );
}

export function FlowView(props: Props) {
  return (
    <ReactFlowProvider>
      <ViewInner {...props} />
    </ReactFlowProvider>
  );
}
