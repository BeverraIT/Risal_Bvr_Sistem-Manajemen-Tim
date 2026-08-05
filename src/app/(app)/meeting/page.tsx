import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { NewMeetingForm } from "./NewMeetingForm";
import { MeetingFilters } from "./MeetingFilters";
import {
  MEETING_STATUS_LABEL,
  MEETING_STATUS_COLOR,
  THREAD_TYPE_LABEL,
  meetingDisplayStatus,
} from "@/lib/pm";
import { Calendar, Plus, Clock, ArrowRight, Lock, Globe } from "lucide-react";

type SearchParams = Promise<{ status?: string; type?: string; division?: string }>;

export default async function MeetingPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const sp = await searchParams;

  const isManager = user?.role === "superadmin" || user?.role === "admin";
  const isLeader = user?.role === "leader";
  const canCreate = isManager || isLeader;

  const [{ data: meetingsRaw }, { data: divisions }, { data: meetingDivisions }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("meetings")
        .select("id, title, visibility, scheduled_at, status")
        .order("scheduled_at", { ascending: false }),
      supabase.from("divisions").select("id, name").order("name"),
      supabase.from("meeting_divisions").select("meeting_id, division_id"),
      supabase.from("profiles").select("id, full_name, division_id").order("full_name"),
    ]);

  const people = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    divisionId: p.division_id,
  }));

  const divisionName = new Map((divisions ?? []).map((d) => [d.id, d.name]));
  const divisionsByMeeting = new Map<string, string[]>();
  for (const md of meetingDivisions ?? []) {
    const list = divisionsByMeeting.get(md.meeting_id) ?? [];
    list.push(md.division_id);
    divisionsByMeeting.set(md.meeting_id, list);
  }

  // Filter in-memory: status (turunan), type (jenis), division.
  const meetings = (meetingsRaw ?? []).filter((m) => {
    const dStatus = meetingDisplayStatus(m.status);
    if (sp.status && dStatus !== sp.status) return false;
    const type = m.visibility === "private" ? "internal" : "global";
    if (sp.type && type !== sp.type) return false;
    if (isManager && sp.division) {
      const divs = divisionsByMeeting.get(m.id) ?? [];
      if (!divs.includes(sp.division)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
          Rapat &amp; Notulen
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola jadwal rapat, kehadiran, dan notulen (dengan bantuan AI).
        </p>
      </div>

      {canCreate && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
            <Plus className="h-4.5 w-4.5 text-blue-600" />
            <span>Jadwalkan Rapat Baru</span>
          </h2>
          <NewMeetingForm
            divisions={divisions ?? []}
            userDivisionId={user?.divisionId ?? null}
            isManager={!!isManager}
            people={people}
          />
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Jadwal Rapat</h2>
          <MeetingFilters showType={canCreate} showDivision={!!isManager} divisions={divisions ?? []} />
        </div>

        <div className="grid max-w-3xl gap-3">
          {meetings.map((m) => {
            const dStatus = meetingDisplayStatus(m.status);
            const type = m.visibility === "private" ? "internal" : "global";
            const divs = (divisionsByMeeting.get(m.id) ?? []).map((id) => divisionName.get(id)).filter(Boolean);
            const dateObj = new Date(m.scheduled_at);
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
                        {type === "internal" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {type === "internal" ? divs.join(", ") || THREAD_TYPE_LABEL.internal : THREAD_TYPE_LABEL.global}
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {dateObj.toLocaleDateString("id-ID", { dateStyle: "medium" })} pukul{" "}
                      {dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
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
