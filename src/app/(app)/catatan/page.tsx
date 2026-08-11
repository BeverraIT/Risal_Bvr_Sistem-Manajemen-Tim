import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { NoteForm } from "./NoteForm";
import { JobForm } from "./JobForm";
import { PriorityList, type PriorityItem } from "./PriorityList";
import { ViewerPicker } from "./ViewerPicker";

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

  const [
    { data: managerProfiles },
    { data: notes, error: notesError },
    { data: jobs, error: jobsError },
  ] = await Promise.all([
    isManager
      ? supabase.from("profiles").select("id, full_name").order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase
      .from("special_notes")
      .select("id, title, content, related_job_id, position, created_at, updated_at")
      .eq("created_by", viewingUserId)
      .order("position")
      .order("created_at"),
    supabase
      .from("job_list")
      .select("id, title, description, done, position, created_at, updated_at")
      .eq("created_by", viewingUserId)
      .order("position")
      .order("created_at"),
  ]);

  // Tanpa ini, query yang gagal (mis. migrasi 0031 belum dijalankan sehingga
  // kolom position/related_job_id belum ada) cuma tampil sebagai daftar
  // kosong -- menyesatkan, seolah orangnya memang belum punya catatan.
  const loadError = notesError?.message ?? jobsError?.message ?? null;

  const items: PriorityItem[] = [
    ...(notes ?? []).map((n) => ({
      kind: "note" as const,
      id: n.id,
      title: n.title,
      content: n.content,
      relatedJobId: n.related_job_id,
      updatedAt: n.updated_at ?? n.created_at,
      position: n.position,
      createdAt: n.created_at,
    })),
    ...(jobs ?? []).map((j) => ({
      kind: "job" as const,
      id: j.id,
      title: j.title,
      description: j.description,
      done: j.done,
      updatedAt: j.updated_at ?? j.created_at,
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
        <ViewerPicker
          people={(managerProfiles ?? [])
            .filter((p) => p.id !== user.id)
            .map((p) => ({ id: p.id, name: p.full_name }))}
          currentUserId={user.id}
          viewingUserId={viewingUserId}
        />
      )}

      {loadError && (
        <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          Gagal memuat daftar: {loadError}
        </p>
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

      {/* key: PriorityList menyimpan daftarnya di useState, dan nilai awal
          useState cuma dipakai saat mount pertama. Tanpa key ini, ganti orang
          di dropdown (navigasi client-side, komponen tidak di-remount) bikin
          daftar orang sebelumnya tetap tampil. */}
      <PriorityList key={viewingUserId} items={items} editable={isOwnList} />
    </div>
  );
}
