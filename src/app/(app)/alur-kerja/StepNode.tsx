"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { User, AlertTriangle } from "lucide-react";
import {
  NODE_TYPE_COLOR,
  NODE_TYPE_LABEL,
  heatLevel,
  type FlowNodeType,
} from "@/lib/flow";

export type StepNodeData = {
  title: string;
  kind: FlowNodeType;
  description?: string | null;
  assigneeName?: string | null;
  openIssues?: number;
};

// Warnai node makin merah sesuai jumlah masalah terbuka (peta titik rawan).
function heatStyle(openIssues: number, base: { bg: string; border: string }) {
  const t = heatLevel(openIssues);
  if (t <= 0) return { background: base.bg, borderColor: base.border };
  // Interpolasi kasar menuju merah pekat.
  const border = t >= 0.99 ? "#dc2626" : "#f87171";
  const background = t >= 0.6 ? "#fee2e2" : "#fff1f2";
  return { background, borderColor: border };
}

// Titik sambung di keempat sisi. Tiap sisi punya handle source DAN target
// yang bertumpuk, jadi panah bisa ditarik dari sisi mana pun ke sisi mana pun
// (pola draw.io) -- bukan cuma bawah-ke-atas seperti sebelumnya. Titiknya
// dibuat cukup besar supaya gampang ditarik, dan disembunyikan sampai kotaknya
// disentuh/dipilih supaya diagram tetap bersih dilihat.
const SIDES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
] as const;

function StepNodeInner({ data, selected }: NodeProps) {
  const d = data as StepNodeData;
  const palette = NODE_TYPE_COLOR[d.kind];
  const openIssues = d.openIssues ?? 0;
  const style = heatStyle(openIssues, palette);
  const isDecision = d.kind === "keputusan";
  const isTerminal = d.kind === "mulai" || d.kind === "selesai";

  const handleStyle = {
    background: "#fff",
    border: `2px solid ${palette.border}`,
    width: 11,
    height: 11,
  };

  return (
    <div
      className="group relative rounded-xl border-2 px-3 py-2 shadow-sm transition-shadow"
      style={{
        ...style,
        color: palette.text,
        minWidth: isTerminal ? 96 : 150,
        maxWidth: 220,
        boxShadow: selected ? "0 0 0 3px rgba(59,130,246,0.35)" : undefined,
        borderRadius: isTerminal ? 999 : isDecision ? 14 : 12,
        textAlign: "center",
      }}
    >
      {SIDES.map((s) => (
        <div
          key={s.id}
          className={`transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
        >
          {/* target di bawah, source di atasnya -- keduanya di titik yang sama
              supaya satu titik bisa dipakai menarik keluar maupun menerima. */}
          <Handle
            type="target"
            id={s.id}
            position={s.position}
            style={handleStyle}
            isConnectableStart={false}
          />
          <Handle type="source" id={s.id} position={s.position} style={handleStyle} />
        </div>
      ))}

      <div className="flex items-center justify-center gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">
          {NODE_TYPE_LABEL[d.kind]}
        </span>
      </div>
      <div className="text-sm font-semibold leading-snug break-words">
        {d.title || <span className="opacity-40">(tanpa judul)</span>}
      </div>

      {d.assigneeName && (
        <div className="mt-1 flex items-center justify-center gap-1 text-[11px] opacity-70">
          <User className="h-3 w-3" />
          <span>{d.assigneeName}</span>
        </div>
      )}

      {openIssues > 0 && (
        <div className="absolute -right-2 -top-2 flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
          <AlertTriangle className="h-2.5 w-2.5" />
          {openIssues}
        </div>
      )}

    </div>
  );
}

export const StepNode = memo(StepNodeInner);

// Peta nodeTypes untuk React Flow (dipakai editor & viewer).
export const nodeTypes = { step: StepNode };
