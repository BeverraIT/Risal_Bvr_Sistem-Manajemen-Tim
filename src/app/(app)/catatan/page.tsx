import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { NoteForm } from "./NoteForm";
import { JobForm } from "./JobForm";
import { NoteCard } from "./NoteCard";
import { JobRow } from "./JobRow";
import { NotebookPen, ListChecks } from "lucide-react";

type SearchParams = Promise<{ tab?: string }>;

export default async function CatatanPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user) return null;

  const sp = await searchParams;
  const tab = sp.tab === "job" ? "job" : "note";
  const isManager = user.role === "superadmin" || user.role === "admin";

  const [{ data: divisions }, { data: profiles }, { data: notes }, { data: jobs }] =
    await Promise.all([
      supabase.from("divisions").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase
        .from("special_notes")
        .select("id, title, content, is_private, division_id, created_by, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("job_list")
        .select("id, title, description, assignee_id, division_id, due_date, done, created_by, created_at")
        .order("done")
        .order("due_date", { nullsFirst: false }),
    ]);

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name]));
  const personName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const people = (profiles ?? []).map((p) => ({ id: p.id, name: p.full_name }));

  const tabCls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
      active
        ? "bg-white text-slate-900 shadow-sm"
        : "text-slate-500 hover:text-slate-800"
    }`;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-violet-800 to-emerald-700 bg-clip-text text-transparent">
          Catatan &amp; Job List
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Catatan khusus pribadi atau tim, dan daftar pekerjaan ringan di luar modul Tugas &amp; Poin.
        </p>
      </div>

      {/* Tab */}
      <div className="inline-flex gap-1 rounded-2xl bg-slate-100 p-1">
        <Link href="/catatan?tab=note" className={tabCls(tab === "note")}>
          <NotebookPen className="h-4 w-4" /> Catatan Khusus
        </Link>
        <Link href="/catatan?tab=job" className={tabCls(tab === "job")}>
          <ListChecks className="h-4 w-4" /> Job List
        </Link>
      </div>

      {tab === "note" ? (
        <section className="space-y-4">
          <NoteForm divisions={divisions ?? []} />

          {(notes ?? []).length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm italic text-slate-400 shadow-sm">
              Belum ada catatan. Buat catatan pertama Anda.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(notes ?? []).map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  divisionName={n.division_id ? divisionName.get(n.division_id) ?? null : null}
                  canDelete={n.created_by === user.id || isManager}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <JobForm divisions={divisions ?? []} people={people} />

          {(jobs ?? []).length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm italic text-slate-400 shadow-sm">
              Belum ada job. Tambahkan pekerjaan pertama.
            </p>
          ) : (
            <ul className="space-y-2">
              {(jobs ?? []).map((j) => (
                <JobRow
                  key={j.id}
                  job={j}
                  assigneeName={j.assignee_id ? personName.get(j.assignee_id) ?? null : null}
                  divisionName={j.division_id ? divisionName.get(j.division_id) ?? null : null}
                  canDelete={j.created_by === user.id || j.assignee_id === user.id || isManager}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
