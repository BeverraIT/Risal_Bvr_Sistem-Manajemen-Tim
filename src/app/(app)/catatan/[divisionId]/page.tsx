import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Users2, ListChecks, NotebookPen, ChevronRight, CircleCheck } from "lucide-react";

// Tingkat 2 dari 3: Karyawan dalam satu divisi.
export default async function DivisiCatatanPage({
  params,
}: {
  params: Promise<{ divisionId: string }>;
}) {
  const { divisionId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  // Selaras dengan halaman induknya: non-Management hanya boleh membuka
  // divisinya sendiri, karena RLS memang tidak memberi mereka data divisi lain.
  const isManager = user.role === "superadmin" || user.role === "admin";
  if (!isManager && divisionId !== user.divisionId) notFound();

  const supabase = await createClient();
  const { data: divisi } = await supabase
    .from("divisions")
    .select("id, name, category")
    .eq("id", divisionId)
    .maybeSingle();
  if (!divisi) notFound();

  const [{ data: anggota }, { data: jobs }, { data: notes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, position")
      .eq("division_id", divisionId)
      .order("full_name"),
    supabase.from("job_list").select("id, assignee_id, done"),
    supabase.from("special_notes").select("id, created_by"),
  ]);

  const orang = (anggota ?? []).map((p) => {
    const jobOrang = (jobs ?? []).filter((j) => j.assignee_id === p.id);
    return {
      id: p.id,
      nama: p.full_name ?? "(tanpa nama)",
      jabatan: p.position as string | null,
      jobAktif: jobOrang.filter((j) => !j.done).length,
      jobSelesai: jobOrang.filter((j) => j.done).length,
      jumlahNote: (notes ?? []).filter((n) => n.created_by === p.id).length,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      <nav className="flex items-center gap-1 text-xs font-semibold text-slate-400">
        <Link href="/catatan" className="hover:text-slate-600">
          Catatan &amp; Job List
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-600">{divisi.name}</span>
      </nav>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{divisi.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {orang.length} karyawan. Pilih satu orang untuk melihat job list dan
          catatan pekerjaannya.
        </p>
      </div>

      {orang.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Belum ada karyawan di divisi ini"
          description="Tambahkan karyawan lewat menu Team Divisi, lalu mereka akan muncul di sini."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orang.map((o) => (
            <Link
              key={o.id}
              href={`/catatan/${divisionId}/${o.id}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                    {o.nama}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {o.jabatan || "Tanpa jabatan"}
                  </p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-extrabold text-blue-600">
                  {o.nama.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3.5 w-3.5 text-slate-400" />
                  {o.jobAktif} aktif
                </span>
                <span className="inline-flex items-center gap-1">
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-500" />
                  {o.jobSelesai} selesai
                </span>
                <span className="inline-flex items-center gap-1">
                  <NotebookPen className="h-3.5 w-3.5 text-slate-400" />
                  {o.jumlahNote}
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
