import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { NoteForm } from "./NoteForm";
import { JobForm } from "./JobForm";
import { PriorityList, type PriorityItem } from "./PriorityList";
import { Eye } from "lucide-react";

type SearchParams = Promise<{ user?: string }>;

// Catatan Khusus & Job List: satu daftar prioritas pribadi per orang
// (drag & drop = urutan penting), digabung dari dua tabel & dibedakan warna.
// Management/Owner bisa intip milik siapa saja lewat pemilih "Lihat milik",
// tapi cuma bisa geser/tambah/hapus punya sendiri -- punya orang lain
// read-only.
export default async function CatatanPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user) return null;

  const sp = await searchParams;
  const isManager = user.role === "superadmin" || user.role === "admin";
  const viewingUserId = isManager && sp.user ? sp.user : user.id;
  const isOwnList = viewingUserId === user.id;

  const [{ data: managerProfiles }, { data: notes }, { data: jobs }] = await Promise.all([
    isManager
      ? supabase.from("profiles").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase
      .from("special_notes")
      .select("id, title, content, related_job_id, position, created_at")
      .eq("created_by", viewingUserId)
      .order("position")
      .order("created_at"),
    supabase
      .from("job_list")
      .select("id, title, description, done, position, created_at")
      .eq("created_by", viewingUserId)
      .order("position")
      .order("created_at"),
  ]);

  const items: PriorityItem[] = [
    ...(notes ?? []).map((n) => ({
      kind: "note" as const,
      id: n.id,
      title: n.title,
      content: n.content,
      relatedJobId: n.related_job_id,
      position: n.position,
      createdAt: n.created_at,
    })),
    ...(jobs ?? []).map((j) => ({
      kind: "job" as const,
      id: j.id,
      title: j.title,
      description: j.description,
      done: j.done,
      position: j.position,
      createdAt: j.created_at,
    })),
  ].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

  const viewingName = isOwnList
    ? "Anda"
    : (managerProfiles ?? []).find((p) => p.id === viewingUserId)?.full_name ?? "orang ini";

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-violet-800 to-emerald-700 bg-clip-text text-transparent">
          Catatan &amp; Job List
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Daftar prioritas pribadi -- catatan khusus dan job list ringan, digeser urutannya sesuai penting duluan.
        </p>
      </div>

      {isManager && (managerProfiles ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
            <Eye className="h-3.5 w-3.5" /> Lihat milik:
          </span>
          <a
            href="/catatan"
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
              isOwnList
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
            }`}
          >
            Saya sendiri
          </a>
          {(managerProfiles ?? [])
            .filter((p) => p.id !== user.id)
            .map((p) => (
              <a
                key={p.id}
                href={`/catatan?user=${p.id}`}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  viewingUserId === p.id
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {p.full_name}
              </a>
            ))}
        </div>
      )}

      {!isOwnList && (
        <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
          Melihat daftar milik {viewingName} -- read-only, tidak bisa diubah dari sini.
        </p>
      )}

      {isOwnList && (
        <div className="space-y-2">
          <JobForm />
          <NoteForm jobs={(jobs ?? []).map((j) => ({ id: j.id, title: j.title }))} />
        </div>
      )}

      <PriorityList items={items} editable={isOwnList} />
    </div>
  );
}
