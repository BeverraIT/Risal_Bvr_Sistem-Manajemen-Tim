import Link from "next/link";
import { loadTugasContext } from "../shared";
import { AssigneeFilter } from "../AssigneeFilter";
import { ActionItemStatusSelect } from "../../meeting/[meetingId]/ActionItemStatusSelect";
import { CalendarDays } from "lucide-react";

type SearchParams = Promise<{ assignee?: string }>;

// Sub-menu "Action Item Rapat" -- tindak lanjut hasil rapat, dibaca langsung
// dari tabel action_items (tidak disalin ke pm_tasks) supaya statusnya
// sinkron dua arah dengan halaman rapatnya.
//
// Cakupannya mengikuti pola Daftar Tugas: Management/Owner melihat semua,
// Lead melihat anggota divisinya, Staff hanya miliknya sendiri.
export default async function ActionItemPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await loadTugasContext();
  if (!ctx) return null;
  const { user, supabase, isManager, isLeader, isReviewer, profiles, profileName, members } = ctx;

  const sp = await searchParams;

  let query = supabase
    .from("action_items")
    .select("id, title, due_date, status, assignee_id, meeting_id, meetings(title)")
    .not("meeting_id", "is", null)
    .not("assignee_id", "is", null)
    .neq("status", "done");

  if (sp.assignee) {
    query = query.eq("assignee_id", sp.assignee);
  } else if (isLeader) {
    const divisionMemberIds = profiles
      .filter((p) => p.division_id === user.divisionId)
      .map((p) => p.id);
    query = query.in("assignee_id", divisionMemberIds);
  } else if (!isManager) {
    query = query.eq("assignee_id", user.id);
  }

  const { data: items } = await query.order("due_date", { nullsFirst: false });

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-800 to-blue-700 bg-clip-text text-transparent">
          Action Item Rapat
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tindak lanjut hasil rapat yang belum selesai. Statusnya sinkron dua arah dengan halaman rapat.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
            <CalendarDays className="h-4.5 w-4.5 text-indigo-600" />
            <span>Belum Selesai</span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-extrabold text-indigo-700">
              {(items ?? []).length}
            </span>
          </h2>
          {isReviewer && <AssigneeFilter people={members} />}
        </div>

        {(items ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm italic text-slate-400">
            Tidak ada action item yang belum selesai.
          </p>
        ) : (
          <div className="space-y-3">
            {(items ?? []).map((item) => {
              const rel = item.meetings;
              const meeting = Array.isArray(rel) ? rel[0] : rel;
              const meetingTitle = (meeting as { title?: string } | null)?.title;
              const overdue =
                item.due_date && new Date(item.due_date) < new Date(new Date().toDateString());
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 rounded-xl border border-slate-100 p-4 transition-colors hover:border-slate-200"
                >
                  <div className="min-w-0 space-y-1.5">
                    <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
                    <p className="text-xs text-slate-400">
                      PIC:{" "}
                      <span className="font-medium text-slate-600">
                        {item.assignee_id ? profileName.get(item.assignee_id) ?? "-" : "-"}
                      </span>
                      {" · "}
                      <Link
                        href={`/meeting/${item.meeting_id}`}
                        className="font-semibold text-blue-600 hover:underline"
                      >
                        {meetingTitle ?? "Lihat rapat"}
                      </Link>
                      {item.due_date && (
                        <>
                          {" · "}
                          <span className={overdue ? "font-bold text-rose-600" : ""}>
                            {overdue ? "Lewat tenggat " : "Tenggat "}
                            {new Date(item.due_date).toLocaleDateString("id-ID", {
                              dateStyle: "medium",
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <ActionItemStatusSelect
                    meetingId={item.meeting_id as string}
                    itemId={item.id}
                    status={item.status}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
