import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { NewMeetingForm } from "../NewMeetingForm";
import { CalendarPlus } from "lucide-react";

// Sub-menu "Jadwalkan Rapat Baru" -- halaman khusus form pembuatan rapat.
// Daftar rapat yang sudah teragenda ada di halaman terpisah (/meeting).
export default async function NewMeetingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/meeting");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .order("full_name");

  // Penyelenggara tidak perlu muncul di dropdown -- dia otomatis ikut.
  const people = (profiles ?? [])
    .filter((p) => p.id !== user.id)
    .map((p) => ({
      id: p.id,
      name: p.full_name ?? "(tanpa nama)",
    }));

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <div>
        <Link href="/meeting" className="text-xs font-semibold text-blue-600 hover:underline">
          &larr; Kembali ke Jadwal Rapat
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
          Jadwalkan Rapat Baru
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tentukan waktu dan siapa saja yang diundang. Hanya peserta yang
          dipilih (beserta Management/Owner) yang bisa membuka rapat ini.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-bold text-slate-800">
          <CalendarPlus className="h-4.5 w-4.5 text-blue-600" />
          <span>Detail Rapat</span>
        </h2>
        <NewMeetingForm people={people} />
      </section>
    </div>
  );
}
