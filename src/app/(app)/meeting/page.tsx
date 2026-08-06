import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { MeetingFilters } from "./MeetingFilters";
import { MEETING_STATUS_LABEL, MEETING_STATUS_COLOR, meetingDisplayStatus } from "@/lib/pm";
import { Calendar, Plus, Clock, ArrowRight, Users, Globe } from "lucide-react";

type SearchParams = Promise<{ status?: string }>;

// Sub-menu "Jadwal Rapat" -- daftar rapat yang sudah teragenda. Form
// pembuatan rapat dipindah ke halaman sendiri (/meeting/baru).
export default async function MeetingPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const sp = await searchParams;

  const canCreate =
    user?.role === "superadmin" || user?.role === "admin" || user?.role === "leader";

  const [{ data: meetingsRaw }, { data: participantRows }] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, visibility, scheduled_at, status")
      .order("scheduled_at", { ascending: false }),
    // RLS hanya mengembalikan baris rapat yang boleh dilihat, jadi hitungan
    // ini aman dipakai apa adanya.
    supabase.from("meeting_participants").select("meeting_id"),
  ]);

  const participantCount = new Map<string, number>();
  for (const row of participantRows ?? []) {
    participantCount.set(row.meeting_id, (participantCount.get(row.meeting_id) ?? 0) + 1);
  }

  const meetings = (meetingsRaw ?? []).filter(
    (m) => !sp.status || meetingDisplayStatus(m.status) === sp.status,
  );

  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
            Jadwal Rapat
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rapat yang sudah teragenda beserta notulennya (dengan bantuan AI).
          </p>
        </div>
        {canCreate && (
          <Link
            href="/meeting/baru"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-rose-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-rose-600/15 transition-all hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>Jadwalkan Rapat Baru</span>
          </Link>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Daftar Rapat
          </h2>
          <MeetingFilters />
        </div>

        <div className="grid max-w-3xl gap-3">
          {meetings.map((m) => {
            const dStatus = meetingDisplayStatus(m.status);
            const start = new Date(m.scheduled_at);
            const count = participantCount.get(m.id) ?? 0;
            return (
              <Link
                key={m.id}
                href={`/meeting/${m.id}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:scale-[1.005] hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all duration-300 group-hover:bg-gradient-to-tr group-hover:from-blue-600 group-hover:to-rose-600 group-hover:text-white">
                    <Calendar className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-[260px] truncate font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                        {m.title}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {m.visibility === "private" ? (
                          <>
                            <Users className="h-3 w-3" />
                            {count} peserta
                          </>
                        ) : (
                          <>
                            <Globe className="h-3 w-3" />
                            Semua Divisi
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {start.toLocaleDateString("id-ID", { dateStyle: "medium" })} pukul{" "}
                      {start.toLocaleTimeString("id-ID", timeFmt)} WIB
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-4">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${MEETING_STATUS_COLOR[dStatus]}`}>
                    {MEETING_STATUS_LABEL[dStatus]}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-colors group-hover:text-slate-800" />
                </div>
              </Link>
            );
          })}

          {meetings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
              <p className="text-sm italic text-slate-400">Tidak ada rapat yang cocok dengan filter.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
