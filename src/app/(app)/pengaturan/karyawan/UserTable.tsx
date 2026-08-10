"use client";

import { useMemo, useState } from "react";
import { UserRow } from "./UserRow";
import { type AppRole, ROLE_LABEL } from "@/lib/roles";
import { Search, X } from "lucide-react";

type UserItem = {
  id: string;
  fullName: string;
  divisionId: string | null;
  position: string;
  employmentStatus: string;
  role: AppRole;
};

// Tabel anggota tim + pencarian. Dengan ~95 orang, menggulir tabel penuh
// untuk mencari satu nama tidak praktis -- pencarian menyaring per nama,
// jabatan, divisi, dan hak akses sekaligus supaya "cari semua orang di
// divisi Inbound" juga bisa lewat kotak yang sama.
export function UserTable({
  users,
  divisions,
  currentUserRole,
  currentUserId,
  restrictedToStaff,
}: {
  users: UserItem[];
  divisions: { id: string; name: string }[];
  currentUserRole: AppRole;
  currentUserId: string;
  restrictedToStaff?: boolean;
}) {
  const [query, setQuery] = useState("");

  const divisionName = useMemo(
    () => new Map(divisions.map((d) => [d.id, d.name])),
    [divisions],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const haystack = [
        u.fullName,
        u.position,
        u.divisionId ? divisionName.get(u.divisionId) ?? "" : "",
        ROLE_LABEL[u.role],
        u.employmentStatus === "active" ? "aktif" : "nonaktif",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, query, divisionName]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-64 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-blue-400">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, jabatan, divisi, atau hak akses…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Hapus pencarian"
              className="shrink-0 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {query && (
          <span className="text-xs font-semibold text-slate-500">
            {filtered.length} dari {users.length} orang
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
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
              {filtered.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  divisions={divisions}
                  currentUserRole={currentUserRole}
                  currentUserId={currentUserId}
                  restrictedToStaff={restrictedToStaff}
                />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center italic text-slate-400">
                    {users.length === 0
                      ? "Belum ada data profil karyawan."
                      : `Tidak ada yang cocok dengan "${query}".`}
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
