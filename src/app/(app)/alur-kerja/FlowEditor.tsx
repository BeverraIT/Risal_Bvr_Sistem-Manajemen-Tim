"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import {
  Plus,
  GitBranch,
  Save,
  Send,
  Trash2,
  ArrowLeft,
  Info,
} from "lucide-react";
import Link from "next/link";
import { nodeTypes, type StepNodeData } from "./StepNode";
import { SearchableSelect } from "@/components/SearchableSelect";
import {
  NODE_TYPE_LABEL,
  type DiagramNode,
  type DiagramEdge,
  type FlowNodeType,
} from "@/lib/flow";
import { saveDiagram, submitFlow } from "./actions";

type Member = { id: string; name: string };

type Props = {
  flowId: string;
  flowName: string;
  status: string;
  reviewNote: string | null;
  members: Member[];
  initialNodes: DiagramNode[];
  initialEdges: DiagramEdge[];
};

const EDGE_STYLE = {
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
  style: { strokeWidth: 2 },
};

function toRfNodes(nodes: DiagramNode[], members: Member[]): Node[] {
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  return nodes.map((n) => ({
    id: n.id,
    type: "step",
    position: { x: n.x, y: n.y },
    data: {
      title: n.title,
      kind: n.type,
      description: n.description,
      assigneeName: n.assigneeId ? nameOf.get(n.assigneeId) ?? null : null,
      // simpan field mentah utk edit
      _assigneeId: n.assigneeId,
    } as StepNodeData & { _assigneeId: string | null },
  }));
}

function toRfEdges(edges: DiagramEdge[]): Edge[] {
  return edges.map((e, i) => ({
    id: `e${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
    ...EDGE_STYLE,
  }));
}

function EditorInner({
  flowId,
  flowName,
  status,
  reviewNote,
  members,
  initialNodes,
  initialEdges,
}: Props) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toRfNodes(initialNodes, members),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRfEdges(initialEdges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const markDirty = () => setDirty(true);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => addEdge({ ...c, ...EDGE_STYLE }, eds));
      markDirty();
    },
    [setEdges],
  );

  const addNode = (kind: FlowNodeType) => {
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type: "step",
      position: { x: 120 + Math.random() * 240, y: 140 + Math.random() * 160 },
      data: {
        title: kind === "keputusan" ? "Keputusan?" : "Langkah baru",
        kind,
        description: null,
        assigneeName: null,
        _assigneeId: null,
      } as StepNodeData & { _assigneeId: string | null },
    };
    setNodes((ns) => [...ns, newNode]);
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
    markDirty();
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;

  const updateNodeData = (patch: Partial<StepNodeData & { _assigneeId: string | null }>) => {
    if (!selectedNodeId) return;
    setNodes((ns) =>
      ns.map((n) =>
        n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
    );
    markDirty();
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selectedNodeId));
    setEdges((es) => es.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
    markDirty();
  };

  const updateEdgeLabel = (label: string) => {
    if (!selectedEdgeId) return;
    setEdges((es) =>
      es.map((e) => (e.id === selectedEdgeId ? { ...e, label: label || undefined } : e)),
    );
    markDirty();
  };

  const deleteSelectedEdge = () => {
    if (!selectedEdgeId) return;
    setEdges((es) => es.filter((e) => e.id !== selectedEdgeId));
    setSelectedEdgeId(null);
    markDirty();
  };

  const buildPayload = () => {
    const dNodes: DiagramNode[] = nodes.map((n) => {
      const data = n.data as StepNodeData & { _assigneeId: string | null };
      return {
        id: n.id,
        type: data.kind,
        title: data.title ?? "",
        description: data.description ?? null,
        assigneeId: data._assigneeId ?? null,
        x: n.position.x,
        y: n.position.y,
      };
    });
    const dEdges: DiagramEdge[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      label: (e.label as string) ?? null,
    }));
    return { nodes: dNodes, edges: dEdges };
  };

  const handleSave = () =>
    startSaving(async () => {
      setMsg(null);
      const res = await saveDiagram(flowId, buildPayload());
      if (res.error) setMsg(res.error);
      else {
        setDirty(false);
        setMsg("Tersimpan.");
      }
    });

  const handleSubmit = () =>
    startSubmit(async () => {
      setMsg(null);
      // Simpan dulu supaya yang di-review adalah versi terbaru.
      const saved = await saveDiagram(flowId, buildPayload());
      if (saved.error) return setMsg(saved.error);
      const res = await submitFlow(flowId);
      if (res.error) setMsg(res.error);
      else router.push(`/alur-kerja/${flowId}`);
    });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/alur-kerja/${flowId}`}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <h1 className="text-lg font-bold text-slate-800">{flowName}</h1>
        {dirty && <span className="text-xs font-medium text-amber-600">• belum disimpan</span>}
        {msg && <span className="text-xs font-medium text-slate-500">{msg}</span>}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-500 px-3 py-2 text-sm font-bold text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> {submitting ? "Mengajukan..." : "Ajukan"}
          </button>
        </div>
      </div>

      {status === "perlu_revisi" && reviewNote && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Diminta revisi oleh Management:</b> {reviewNote}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(c) => {
              onNodesChange(c);
              if (c.some((ch) => ch.type === "position" && ch.dragging === false)) markDirty();
            }}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => {
              setSelectedNodeId(n.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, e) => {
              setSelectedEdgeId(e.id);
              setSelectedNodeId(null);
            }}
            onPaneClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
            <Panel position="top-left" className="flex gap-2">
              <button
                onClick={() => addNode("langkah")}
                className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm hover:bg-blue-50"
              >
                <Plus className="h-3.5 w-3.5" /> Langkah
              </button>
              <button
                onClick={() => addNode("keputusan")}
                className="flex items-center gap-1 rounded-lg border border-amber-200 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-amber-700 shadow-sm hover:bg-amber-50"
              >
                <GitBranch className="h-3.5 w-3.5" /> Keputusan
              </button>
            </Panel>
          </ReactFlow>
        </div>

        {/* Inspektur */}
        <div className="w-72 shrink-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {selectedNode ? (
            <NodeInspector
              node={selectedNode}
              members={members}
              onChange={updateNodeData}
              onDelete={deleteSelectedNode}
            />
          ) : selectedEdge ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">Panah / Alur</h3>
              <div>
                <label className="mb-1 block text-xs text-slate-500">
                  Label (mis. &quot;Ya&quot; / &quot;Tidak&quot; untuk cabang)
                </label>
                <input
                  value={(selectedEdge.label as string) ?? ""}
                  onChange={(e) => updateEdgeLabel(e.target.value)}
                  placeholder="kosongkan bila tak perlu"
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <button
                onClick={deleteSelectedEdge}
                className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus panah
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-500">
              <p className="font-semibold text-slate-700">Cara pakai</p>
              <ul className="list-disc space-y-1 pl-4 text-xs">
                <li>Klik <b>Langkah</b>/<b>Keputusan</b> untuk menambah kotak.</li>
                <li>Tarik dari titik bawah kotak ke kotak lain untuk membuat panah.</li>
                <li>Klik kotak untuk mengedit judul & penanggung jawab.</li>
                <li>Klik panah untuk memberi label cabang (Ya/Tidak).</li>
                <li>Jangan lupa <b>Simpan</b>.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NodeInspector({
  node,
  members,
  onChange,
  onDelete,
}: {
  node: Node;
  members: Member[];
  onChange: (patch: Partial<StepNodeData & { _assigneeId: string | null }>) => void;
  onDelete: () => void;
}) {
  const data = node.data as StepNodeData & { _assigneeId: string | null };
  const isTerminal = data.kind === "mulai" || data.kind === "selesai";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-slate-700">
        Edit {NODE_TYPE_LABEL[data.kind]}
      </h3>
      <div>
        <label className="mb-1 block text-xs text-slate-500">Judul</label>
        <input
          value={data.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-cyan-400"
        />
      </div>

      {!isTerminal && (
        <>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Deskripsi</label>
            <textarea
              value={data.description ?? ""}
              onChange={(e) => onChange({ description: e.target.value })}
              rows={3}
              className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Penanggung jawab</label>
            {/* key: SearchableSelect memegang pilihannya di state internal,
                jadi tanpa ini pindah node bikin nama PIC node sebelumnya
                nyangkut di panel. */}
            <SearchableSelect
              key={data._assigneeId ?? "none"}
              options={members.map((m) => ({ value: m.id, label: m.name }))}
              defaultValue={data._assigneeId ?? ""}
              emptyLabel="— tidak ada —"
              onValueChange={(id) => {
                const name = members.find((m) => m.id === id)?.name ?? null;
                onChange({ _assigneeId: id || null, assigneeName: name });
              }}
            />
          </div>
        </>
      )}

      {!isTerminal && (
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
        >
          <Trash2 className="h-3.5 w-3.5" /> Hapus kotak ini
        </button>
      )}
    </div>
  );
}

export function FlowEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}
