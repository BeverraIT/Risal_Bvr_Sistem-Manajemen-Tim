import Link from "next/link";
import { ActionItemStatusSelect } from "../meeting/[meetingId]/ActionItemStatusSelect";
import { CalendarDays } from "lucide-react";

export type ActionItemRowData = {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
  assignee_id: string | null;
  meeting_id: string | null;
  meetings: unknown;
};

// Baris action item rapat di dalam Daftar Tugas. Bentuknya dibuat sejajar
// dengan TaskRow (judul, badge, PIC, tenggat, kontrol status di kanan)
// karena keduanya sama-sama "tugas yang ada PIC-nya" -- yang membedakan
// cuma asalnya: ini lahir dari rapat, jadi diberi badge "Rapat" + tautan ke
// rapat asalnya.
export function ActionItemRow({
  item,
  profileName,
}: {
  item: ActionItemRowData;
  profileName: Map<string, string>;
}) {
  const rel = item.meetings;
  const meeting = Array.isArray(rel) ? rel[0] : rel;
  const meetingTitle = (meeting as { title?: string } | null)?.title;
  const overdue =
    item.due_date && new Date(item.due_date) < new Date(new Date().toDateString());

  return (
    <div className="rounded-xl border border-slate-100 p-4 transition-colors hover:border-slate-200">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
              <CalendarDays className="h-2.5 w-2.5" /> Rapat
            </span>
          </div>
          <p className="text-xs text-slate-400">
            PIC:{" "}
            <span className="font-medium text-slate-600">
              {item.assignee_id ? profileName.get(item.assignee_id) ?? "-" : "Belum ditugaskan"}
            </span>
            {item.due_date && (
              <>
                {" · "}
                <span className={overdue ? "font-bold text-rose-600" : ""}>
                  {overdue ? "Lewat tenggat " : "Due "}
                  {new Date(item.due_date).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                </span>
              </>
            )}
          </p>
          <Link
            href={`/meeting/${item.meeting_id}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
          >
            <CalendarDays className="h-3 w-3" /> {meetingTitle ?? "Lihat rapat"}
          </Link>
        </div>
        <ActionItemStatusSelect
          meetingId={item.meeting_id as string}
          itemId={item.id}
          status={item.status}
        />
      </div>
    </div>
  );
}
