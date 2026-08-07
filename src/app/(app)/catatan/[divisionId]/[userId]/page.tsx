import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { JobForm } from "../../JobForm";
import { NoteForm } from "../../NoteForm";
import { JobRow } from "../../JobRow";
import { NoteCard } from "../../NoteCard";
import { EmptyState } from "@/components/EmptyState";
import { ChevronRight, ListChecks, NotebookPen } from "lucide-react";

// Tingkat 3 dari 3: satu karyawan.
// Job List dan Notes sengaja dipisah jadi dua bagian yang berdiri sendiri --
// pekerjaan yang harus dituntaskan berbeda sifatnya dari catatan pribadi.
export default async function OrangCatatanPage({
  params,
}: {
  params: Promise<{ divisionId: string; userId: string }>;
}) {
  const { divisionId, userId } = await params;
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const [{ data: divisi }, { data: orang }] = await Promise.all([
    supabase.from("divisions").select("id, name").eq("id", divisionId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, position, division_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (!divisi || !orang) notFound();

  const isManager = user.role === "superadmin" || user.role === "admin";
  const [{ data: jobs }, { data: notes }, { data: divisions }] = await Promise.all([
    supabase
      .from("job_list")
      .select("id, title, description, assignee_id, division_id, due_date, done, created_by, created_at")
      .eq("assignee_id", userId)
      .order("done")
      .order("due_date", { nullsFirst: false }),
    // Catatan milik orang ini. RLS tetap yang menentukan mana yang boleh
    // terbaca -- catatan privat orang lain tidak akan ikut terambil.
    supabase
      .from("special_notes")
      .select("id, title, content, is_private, division_id, created_by, created_at, updated_at")
      .eq("created_by", userId)
      .order("updated_at", { ascending: false }),
    supabase.from("divisions").select("id, name").order("name"),
  ]);

  const nama = orang.full_name ?? "(tanpa nama)";
  const jobAktif = (jobs ?? []).filter((j) => !j.done);
  const jobSelesai = (jobs ?? []).filter((j) => j.done);
  const diriSendiri = user.id === userId;

  return (
    <div className="space-y-6 pb-12">
      <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-400">
        <Link href="/catatan" className="hover:text-slate-600">
          Catatan &amp; Job List
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/catatan/${divisionId}`} className="hover:text-slate-600">
          {divisi.name}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-600">{nama}</span>
      </nav>

      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-violet-600 text-xl font-extrabold text-white shadow-md">
          {nama.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold text-slate-900">{nama}</h1>
          <p className="text-sm text-slate-500">
            {orang.position || "Tanpa jabatan"} · {divisi.name}
          </p>
        </div>
      </div>

      {/* --- Job List --- */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <ListChecks className="h-4.5 w-4.5 text-emerald-600" />
            <span>Job List</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">
              {jobAktif.length} aktif
            </span>
          </h2>
          <JobForm
            divisions={divisions ?? []}
            people={[{ id: userId, name: nama }]}
            terkunci={{
              assigneeId: userId,
              assigneeName: nama,
              divisionId: orang.division_id ?? divisionId,
            }}
          />
        </div>

        {(jobs ?? []).length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="Belum ada job"
            description={`Tambahkan pekerjaan ringan untuk ${nama} di luar modul Manajemen Tugas.`}
          />
        ) : (
          <div className="space-y-4">
            {jobAktif.length > 0 && (
              <ul className="space-y-2">
                {jobAktif.map((j) => (
                  <JobRow
                    key={j.id}
                    job={j}
                    assigneeName={nama}
                    divisionName={divisi.name}
                    canDelete={j.created_by === user.id || diriSendiri || isManager}
                  />
                ))}
              </ul>
            )}

            {jobSelesai.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Selesai ({jobSelesai.length})
                </p>
                <ul className="space-y-2 opacity-70">
                  {jobSelesai.map((j) => (
                    <JobRow
                      key={j.id}
                      job={j}
                      assigneeName={nama}
                      divisionName={divisi.name}
                      canDelete={j.created_by === user.id || diriSendiri || isManager}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* --- Notes, terpisah dari Job List --- */}
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <NotebookPen className="h-4.5 w-4.5 text-violet-600" />
            <span>Catatan</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-extrabold text-slate-600">
              {(notes ?? []).length}
            </span>
          </h2>
          {diriSendiri && <NoteForm divisions={divisions ?? []} />}
        </div>

        {(notes ?? []).length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Belum ada catatan"
            description={
              diriSendiri
                ? "Catat hal penting seputar pekerjaan Anda di sini. Catatan privat hanya terlihat oleh Anda."
                : `${nama} belum menulis catatan yang bisa Anda lihat.`
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(notes ?? []).map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                divisionName={n.division_id === divisi.id ? divisi.name : null}
                canDelete={n.created_by === user.id || isManager}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
