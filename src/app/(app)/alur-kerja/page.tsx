import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { NewFlowForm } from "./NewFlowForm";
import { FLOW_STATUS_LABEL, FLOW_STATUS_COLOR, isReviewer, type FlowStatus } from "@/lib/flow";
import { Workflow, ArrowRight, AlertTriangle, User, ClipboardCheck } from "lucide-react";

export default async function AlurKerjaPage() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const [{ data: flows }, { data: divisions }, { data: profiles }, { data: issues }] =
    await Promise.all([
      supabase
        .from("flows")
        .select("id, name, description, division_id, owner_id, status, version, updated_at")
        .order("updated_at", { ascending: false }),
      supabase.from("divisions").select("id, name"),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("flow_issues").select("flow_id, status"),
    ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name]));
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const openByFlow = new Map<string, number>();
  for (const i of issues ?? []) {
    if (i.status === "terbuka") openByFlow.set(i.flow_id, (openByFlow.get(i.flow_id) ?? 0) + 1);
  }

  const isLeader = user.role === "leader";
  const reviewer = isReviewer(user.role);
  const pendingCount = (flows ?? []).filter((f) => f.status === "diajukan").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
            <Workflow className="h-6 w-6 text-cyan-500" /> Alur Kerja & SOP
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gambarkan proses kerja tim sebagai diagram. Titik yang sering bermasalah otomatis menyala merah.
          </p>
        </div>
        {isLeader && <NewFlowForm />}
      </div>

      {reviewer && (
        <Link
          href="/alur-kerja/approval"
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm transition hover:bg-amber-100"
        >
          <ClipboardCheck className="h-5 w-5 text-amber-600" />
          <span className="font-semibold text-amber-800">
            {pendingCount > 0
              ? `${pendingCount} alur menunggu persetujuan Anda`
              : "Antrean persetujuan"}
          </span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-600 px-2 py-0.5 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
          <ArrowRight className="ml-auto h-4 w-4 text-amber-600" />
        </Link>
      )}

      {(flows ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <Workflow className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            {isLeader
              ? "Belum ada alur. Klik “Buat Alur Baru” untuk mulai menggambar SOP divisi Anda."
              : "Belum ada alur kerja untuk divisi Anda."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(flows ?? []).map((f) => {
            const open = openByFlow.get(f.id) ?? 0;
            return (
              <Link
                key={f.id}
                href={`/alur-kerja/${f.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold text-slate-800 group-hover:text-cyan-700">{f.name}</h2>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      FLOW_STATUS_COLOR[f.status as FlowStatus]
                    }`}
                  >
                    {FLOW_STATUS_LABEL[f.status as FlowStatus]}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{f.description}</p>
                )}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                  <span>{divisionName.get(f.division_id ?? "") ?? "—"}</span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {profileName.get(f.owner_id ?? "") ?? "—"}
                  </span>
                  <span>v{f.version}</span>
                  {open > 0 && (
                    <span className="ml-auto flex items-center gap-1 font-bold text-rose-500">
                      <AlertTriangle className="h-3 w-3" /> {open} masalah
                    </span>
                  )}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
