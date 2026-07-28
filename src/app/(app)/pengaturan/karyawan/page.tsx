import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserRow } from "./UserRow";
import { CreateUserForm } from "./CreateUserForm";
import { Users2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function KaryawanPage() {
  const user = await getCurrentUser();

  // Role Protection -- Leader Divisi bisa akses juga, tapi dibatasi ke
  // Staff di divisinya sendiri saja (lihat filter di bawah).
  if (!user || (user.role !== "superadmin" && user.role !== "admin" && user.role !== "leader")) {
    redirect("/");
  }

  const isLeader = user.role === "leader";

  // Create standard client for public reads (divisions) and admin client to fetch all profiles & roles
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const [
    { data: divisions },
    { data: profiles },
    { data: userRoles },
  ] = await Promise.all([
    supabase.from("divisions").select("id, name").order("name"),
    supabaseAdmin.from("profiles").select("id, full_name, division_id, position, employment_status, joined_at"),
    supabaseAdmin.from("user_roles").select("user_id, role, division_id"),
  ]);

  const activeDivisions = divisions ?? [];
  const rawProfiles = profiles ?? [];
  const rawRoles = userRoles ?? [];

  // Create a map of user ID -> role for quick lookup
  const roleByUserId = new Map(rawRoles.map((r) => [r.user_id, r]));

  // Combine profile and role data
  let users = rawProfiles.map((p) => {
    const roleRow = roleByUserId.get(p.id);
    return {
      id: p.id,
      fullName: p.full_name,
      divisionId: roleRow?.division_id ?? p.division_id ?? null,
      position: p.position ?? "",
      employmentStatus: p.employment_status ?? "active",
      role: roleRow?.role ?? "staff",
    };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Leader Divisi hanya boleh lihat & kelola Staff di divisinya sendiri.
  if (isLeader) {
    users = users.filter((u) => u.role === "staff" && u.divisionId === user.divisionId);
  }

  const ownDivision = activeDivisions.find((d) => d.id === user.divisionId) ?? null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={isLeader ? "/" : "/pengaturan"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-blue-800 to-rose-700 bg-clip-text text-transparent">
              Team Divisi
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 ml-10">
            {isLeader
              ? "Kelola anggota tim di divisi Anda -- tambah anggota baru, ubah jabatan, dan status kerja."
              : "Kelola anggota tim seluruh divisi: profil, jabatan, dan hak akses."}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 border border-blue-100 text-xs font-semibold text-blue-700 sm:ml-10">
          <Users2 className="h-4 w-4" />
          <span>Total: {users.length} {isLeader ? "Anggota Divisi Anda" : "Anggota Tim"}</span>
        </div>
      </div>

      {/* Create User Form Section */}
      <CreateUserForm
        divisions={activeDivisions}
        currentUserRole={user.role}
        lockedDivision={isLeader ? ownDivision : null}
      />

      {/* Main Table Card */}
      <div className="overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4">Jabatan</th>
                <th className="p-4">Divisi</th>
                <th className="p-4">Hak Akses</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  divisions={activeDivisions}
                  currentUserRole={user.role}
                  currentUserId={user.id}
                  restrictedToStaff={isLeader}
                />
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                    Belum ada data profil karyawan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
