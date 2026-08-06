import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteMeeting } from "../actions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { NotulenForm } from "./NotulenForm";
import { DecisionForm } from "./DecisionForm";
import { ActionItemForm } from "./ActionItemForm";
import { ActionItemRow } from "./ActionItemRow";
import { DecisionItem } from "./DecisionItem";
import { MeetingImages } from "./MeetingImages";
import { AudioRecorder } from "./AudioRecorder";
import { PasteNotesForm } from "./PasteNotesForm";
import { ShareVisualButton } from "./ShareVisualButton";
import { getVisualNotesToken } from "@/lib/visual-notes-token";
import { Sparkles, Calendar, MapPin, CheckSquare, FileText, Lock, Image as ImageIcon, Download } from "lucide-react";
import Link from "next/link";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ meetingId: string }>;
}) {
  const { meetingId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  // Ambil meeting dulu -- RLS mengembalikan null kalau rapat ini privat dan
  // divisi user tidak di-include (kecuali dia pembuatnya atau Owner).
  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", meetingId)
    .maybeSingle();

  if (!meeting) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-xl font-semibold">Rapat tidak ditemukan</h1>
        <p className="text-sm text-neutral-500">
          Rapat ini tidak ada, atau bersifat privat dan divisi Anda tidak disertakan.
        </p>
        <Link href="/meeting" className="text-sm font-semibold text-blue-600 hover:underline">
          &larr; Kembali ke daftar rapat
        </Link>
      </div>
    );
  }

  const [
    { data: notulenRow },
    { data: decisions },
    { data: actionItems },
    { data: profiles },
    { data: meetingImages },
    { data: meetingDivisions },
  ] = await Promise.all([
    supabase.from("notulen").select("content, source").eq("meeting_id", meetingId).maybeSingle(),
    supabase.from("decisions").select("id, content, source, created_at").eq("meeting_id", meetingId).order("created_at"),
    supabase.from("action_items").select("id, title, assignee_id, due_date, status, source, parent_id").eq("meeting_id", meetingId).order("created_at"),
    supabase.from("profiles").select("id, full_name"),
    supabase
      .from("meeting_images")
      .select("id, storage_path, caption")
      .eq("meeting_id", meetingId)
      .order("created_at"),
    meeting.visibility === "private"
      ? supabase.from("meeting_divisions").select("division_id, divisions(name)").eq("meeting_id", meetingId)
      : Promise.resolve({ data: [] as { division_id: string; divisions: unknown }[] }),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const meetingDivisionNames = (meetingDivisions ?? [])
    .map((d) => {
      const rel = d.divisions;
      const div = Array.isArray(rel) ? rel[0] : rel;
      return (div as { name?: string } | null)?.name;
    })
    .filter(Boolean);
  const canEditNotulen =
    user?.role === "superadmin" || user?.role === "admin" || user?.role === "leader";

  // Bucket "meeting-images" publik, jadi URL-nya langsung bisa dipakai <img>.
  const images = (meetingImages ?? []).map((img) => ({
    id: img.id,
    url: supabase.storage.from("meeting-images").getPublicUrl(img.storage_path).data.publicUrl,
    caption: img.caption,
  }));

  // Pisahkan action item induk dari sub-item-nya untuk dirender bertingkat.
  const topLevelActionItems = (actionItems ?? []).filter((i) => !i.parent_id);
  const subItemsByParent = new Map<string, typeof topLevelActionItems>();
  for (const item of actionItems ?? []) {
    if (!item.parent_id) continue;
    const list = subItemsByParent.get(item.parent_id) ?? [];
    list.push(item);
    subItemsByParent.set(item.parent_id, list);
  }

  const getSourceBadge = (source: string | null | undefined) => {
    if (source === "ai_generated") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600 border border-purple-100">
          <Sparkles className="h-2.5 w-2.5" />
          <span>AI</span>
        </span>
      );
    }
    if (source === "ai_edited") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 border border-blue-100">
          <span>AI + Edit</span>
        </span>
      );
    }
    return null;
  };

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      {/* Back to list */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/meeting"
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          &larr; Kembali ke daftar rapat
        </Link>
        {canEditNotulen && (
          <ConfirmDeleteButton
            action={deleteMeeting.bind(null, meetingId)}
            label="Hapus Rapat"
            confirmMessage={`Hapus rapat "${meeting.title}" beserta notulen, keputusan, dan action item-nya? Tindakan ini tidak bisa dibatalkan.`}
          />
        )}
      </div>

      {/* Title block */}
      <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              {meeting.visibility === "private"
                ? meetingDivisionNames.join(", ") || "Divisi terpilih"
                : "Semua Divisi"}
            </span>
            {meeting.visibility === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <Lock className="h-3 w-3" />
                Privat
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900 leading-tight">
            {meeting.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100 text-xs font-semibold text-slate-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span>
              {new Date(meeting.scheduled_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              {meeting.ends_at &&
                ` – ${new Date(meeting.ends_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
          {meeting.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>{meeting.location}</span>
            </div>
          )}
        </div>

        {meeting?.agenda && (
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Agenda Rapat</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
              {meeting.agenda}
            </p>
          </div>
        )}
      </div>

      {/* AI Audio Recorder + tempel catatan (Only for Leaders & Admins) */}
      {canEditNotulen && (
        <div className="space-y-3">
          <AudioRecorder meetingId={meetingId} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sudah punya catatan rapat?</h3>
              <p className="text-xs text-slate-500">
                Untuk rapat yang sudah lewat: tempel catatan mentahnya, AI menyusun notulen, keputusan, dan action items secara otomatis.
              </p>
            </div>
            <PasteNotesForm meetingId={meetingId} />
          </div>
        </div>
      )}

      {/* Notulen */}
      <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <span>Notulen</span>
          </h2>
          {getSourceBadge(notulenRow?.source)}
        </div>
        
        {canEditNotulen ? (
          <NotulenForm meetingId={meetingId} initialContent={notulenRow?.content ?? ""} />
        ) : (
          <div className="prose prose-sm max-w-none rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {notulenRow?.content || <span className="text-slate-400 italic">Belum ada notulen rapat.</span>}
          </div>
        )}
      </section>

      {/* Gambar dokumentasi rapat -- ikut dirender di poster Catatan Visual */}
      {(canEditNotulen || images.length > 0) && (
        <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-slate-400" />
            <span>Gambar Rapat</span>
          </h2>
          <MeetingImages meetingId={meetingId} images={images} canEdit={canEditNotulen} />
        </section>
      )}

      {/* Catatan Visual (infografis ringkasan rapat) */}
      {(notulenRow?.content ||
        (decisions ?? []).length > 0 ||
        (actionItems ?? []).length > 0 ||
        images.length > 0) && (
        <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-slate-400" />
              <span>Catatan Visual</span>
            </h2>
            <div className="flex items-center gap-2">
              <ShareVisualButton
                sharePath={`/api/meeting/${meetingId}/visual-notes?token=${getVisualNotesToken(meetingId)}`}
              />
              <a
                href={`/api/meeting/${meetingId}/visual-notes`}
                download={`catatan-visual-${meetingId}.png`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh PNG</span>
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Poster ringkasan rapat yang dibuat otomatis dari notulen, keputusan, dan action items — siap dibagikan.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- gambar dinamis dari route sendiri, tidak perlu optimasi next/image */}
          <img
            src={`/api/meeting/${meetingId}/visual-notes`}
            alt={`Catatan visual rapat ${meeting.title}`}
            className="w-full rounded-xl border border-slate-100 shadow-sm"
          />
        </section>
      )}

      {/* Decisions */}
      <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-slate-400" />
          <span>Keputusan</span>
        </h2>
        
        <ul className="space-y-2">
          {(decisions ?? []).map((d) => (
            <DecisionItem
              key={d.id}
              meetingId={meetingId}
              decisionId={d.id}
              content={d.content}
              badge={getSourceBadge(d.source)}
              canEdit={canEditNotulen}
            />
          ))}
          {(decisions ?? []).length === 0 && (
            <p className="text-sm text-slate-400 italic">Belum ada keputusan tercatat.</p>
          )}
        </ul>
        {canEditNotulen && <DecisionForm meetingId={meetingId} />}
      </section>

      {/* Action Items */}
      <section className="rounded-2xl bg-white p-6 border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-slate-400" />
          <span>Action Items</span>
        </h2>
        
        <ul className="space-y-2">
          {topLevelActionItems.map((item) => (
            <ActionItemRow
              key={item.id}
              meetingId={meetingId}
              item={item}
              subItems={subItemsByParent.get(item.id) ?? []}
              profiles={profiles ?? []}
              nameById={Object.fromEntries(nameById)}
              canEdit={canEditNotulen}
              badge={getSourceBadge(item.source)}
            />
          ))}
          {(actionItems ?? []).length === 0 && (
            <p className="text-sm text-slate-400 italic">Belum ada action item.</p>
          )}
        </ul>
        {canEditNotulen && (
          <ActionItemForm meetingId={meetingId} profiles={profiles ?? []} />
        )}
      </section>
    </div>
  );
}
