import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { ReviewControls } from "../ReviewControls";
import { isReviewer } from "@/lib/flow";
import { ArrowLeft, ArrowRight, ClipboardCheck, User, Clock } from "lucide-react";

export default async function ApprovalQueuePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  if (!isReviewer(user.role)) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-xl font-semibold">Akses ditolak</h1>
        <p className="text-sm text-slate-500">
          Hanya Management/Owner yang dapat membuka antrean persetujuan.
        </p>
        <Link href="/alur-kerja" className="text-sm font-semibold text-cyan-600 hover:underline">
          &larr; Kembali ke Alur Kerja
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: flows }, { data: divisions }, { data: profiles }] = await Promise.all([
    supabase
      .from("flows")
      .select("id, name, description, division_id, owner_id, updated_at")
      .eq("status", "diajukan")
      .order("updated_at", { ascending: true }),
    supabase.from("divisions").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name]));
  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const list = flows ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/alur-kerja"
          className="mb-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" /> Alur Kerja
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
          <ClipboardCheck className="h-6 w-6 text-amber-500" /> Persetujuan Alur Kerja
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Alur yang diajukan leader dan menunggu keputusan Anda.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-500">
            Tidak ada alur yang menunggu persetujuan. 🎉
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((f) => (
            <div
              key={f.id}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800">{f.name}</h2>
                  {f.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{f.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span>{divisionName.get(f.division_id ?? "") ?? "—"}</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {profileName.get(f.owner_id ?? "") ?? "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(f.updated_at).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                </div>
                <Link
                  href={`/alur-kerja/${f.id}`}
                  className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Lihat diagram <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ReviewControls flowId={f.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
