import { loadTugasContext } from "../shared";
import { Award, Trophy } from "lucide-react";

// Sub-menu "Poin Saya" -- perolehan poin dari tugas yang selesai. Untuk
// Management/Owner sekalian ditampilkan papan peringkat seluruh tim; Staff
// & Lead hanya melihat poinnya sendiri.
export default async function PoinPage() {
  const ctx = await loadTugasContext();
  if (!ctx) return null;
  const { user, supabase, isManager, profileName } = ctx;

  const [{ data: myPoints }, { data: allPoints }] = await Promise.all([
    supabase
      .from("pm_user_points")
      .select("total_points, done_count")
      .eq("assignee_id", user.id)
      .maybeSingle(),
    isManager
      ? supabase.from("pm_user_points").select("assignee_id, total_points, done_count")
      : Promise.resolve({ data: [] as { assignee_id: string; total_points: number; done_count: number }[] }),
  ]);

  const leaderboard = [...(allPoints ?? [])].sort(
    (a, b) => (b.total_points ?? 0) - (a.total_points ?? 0),
  );

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-amber-700 to-orange-700 bg-clip-text text-transparent">
          Poin Saya
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Poin bertambah otomatis saat tugas berstatus Selesai, dibagi rata dengan staff pelaksana lain jika ada.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25">
            <Award className="h-5.5 w-5.5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Poin</p>
            <p className="text-2xl font-extrabold text-slate-900">
              {Math.round((myPoints?.total_points as number) ?? 0)}{" "}
              <span className="text-sm font-medium text-slate-400">poin</span>
            </p>
          </div>
        </div>
        <p className="max-w-xs text-right text-xs text-slate-500">
          {myPoints?.done_count ?? 0} tugas selesai.
        </p>
      </div>

      {isManager && leaderboard.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
            <Trophy className="h-4.5 w-4.5 text-amber-500" />
            <span>Papan Peringkat Tim</span>
          </h2>
          <div className="space-y-2">
            {leaderboard.map((row, i) => (
              <div
                key={row.assignee_id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                      i === 0
                        ? "bg-amber-100 text-amber-700"
                        : i === 1
                          ? "bg-slate-200 text-slate-600"
                          : i === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {profileName.get(row.assignee_id) ?? "-"}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-slate-500">
                  <span className="font-bold text-slate-800">
                    {Math.round(row.total_points ?? 0)}
                  </span>{" "}
                  poin · {row.done_count ?? 0} selesai
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
