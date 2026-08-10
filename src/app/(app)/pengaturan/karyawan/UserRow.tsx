"use client";

import { useState } from "react";
import { type AppRole, ROLE_LABEL } from "@/lib/roles";
import { updateUserRoleAndProfile, deleteUser, resetUserPassword } from "./actions";
import { Edit2, Check, X, ShieldAlert, Trash2, KeyRound, Eye, EyeOff } from "lucide-react";

interface UserRowProps {
  user: {
    id: string;
    fullName: string;
    divisionId: string | null;
    position: string;
    employmentStatus: string;
    role: AppRole;
  };
  divisions: { id: string; name: string }[];
  currentUserRole: AppRole;
  currentUserId: string;
  // Leader Divisi viewing their own Staff -- role & division are locked
  // (both here and server-side) so they can only edit name/position/status.
  restrictedToStaff?: boolean;
}

export function UserRow({ user, divisions, currentUserRole, currentUserId, restrictedToStaff }: UserRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [divisionId, setDivisionId] = useState(user.divisionId || "");
  const [position, setPosition] = useState(user.position || "");
  const [employmentStatus, setEmploymentStatus] = useState(user.employmentStatus || "active");
  const [role, setRole] = useState(user.role);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset password -- khusus Owner. Password diketik langsung di baris ini,
  // tidak pernah ditampilkan ulang setelah tersimpan.
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  const handleResetPassword = async () => {
    setPwLoading(true);
    setPwError(null);
    const res = await resetUserPassword(user.id, newPassword);
    setPwLoading(false);
    if (res.success) {
      setNewPassword("");
      setShowPassword(false);
      setResetting(false);
      setPwDone(true);
      setTimeout(() => setPwDone(false), 4000);
    } else {
      setPwError(res.error);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Hapus permanen "${user.fullName || "karyawan ini"}"? Akun, profil, dan hak aksesnya akan dihapus dan tidak dapat dikembalikan.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    const res = await deleteUser(user.id);
    setDeleting(false);
    if (!res.success) {
      setDeleteError(res.error);
    }
    // Jika sukses, revalidatePath di server akan me-refresh daftar dan baris ini hilang.
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    const res = await updateUserRoleAndProfile(user.id, {
      fullName,
      divisionId: divisionId || null,
      position,
      employmentStatus,
      role,
    });
    setLoading(false);

    if (res.success) {
      setIsEditing(false);
    } else {
      setError(res.error);
    }
  };

  const currentDivName = divisions.find((d) => d.id === user.divisionId)?.name ?? "—";
  const displayRole = ROLE_LABEL[user.role];
  // Hanya Owner (superadmin) yang boleh menghapus, dan tidak boleh menghapus diri sendiri.
  const canDelete = currentUserRole === "superadmin" && user.id !== currentUserId;
  // Reset password juga khusus Owner (dijaga lagi di server action).
  const canResetPassword = currentUserRole === "superadmin";
  const isPeerOrAboveTarget = user.role === "superadmin" || user.role === "admin";
  const lockedForCurrentUser = currentUserRole !== "superadmin" && isPeerOrAboveTarget;

  if (isEditing) {
    return (
      <tr className="border-b border-slate-100 bg-slate-50/50">
        <td className="p-4">
          <input
            type="text"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nama Lengkap"
            disabled={loading}
          />
          {error && (
            <p className="mt-1 text-[10px] text-rose-600 flex items-center gap-1 font-medium">
              <ShieldAlert className="h-3 w-3 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </td>
        <td className="p-4">
          <input
            type="text"
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Jabatan (e.g. Packer)"
            disabled={loading}
          />
        </td>
        <td className="p-4">
          {restrictedToStaff ? (
            <span className="text-slate-500">{currentDivName}</span>
          ) : (
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={loading}
            >
              <option value="">Tanpa Divisi (—)</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </td>
        <td className="p-4">
          {restrictedToStaff ? (
            <span className="text-slate-500">Staff</span>
          ) : (
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              disabled={loading || lockedForCurrentUser}
            >
              <option value="staff">Staff</option>
              <option value="leader">Leader Divisi</option>
              {currentUserRole === "superadmin" && <option value="admin">Management</option>}
              {currentUserRole === "superadmin" && <option value="superadmin">Owner</option>}
            </select>
          )}
        </td>
        <td className="p-4">
          <select
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
            value={employmentStatus}
            onChange={(e) => setEmploymentStatus(e.target.value)}
            disabled={loading}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
              title="Simpan"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setError(null);
                setFullName(user.fullName);
                setDivisionId(user.divisionId || "");
                setPosition(user.position || "");
                setEmploymentStatus(user.employmentStatus || "active");
                setRole(user.role);
              }}
              disabled={loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              title="Batal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Mode reset password -- baris berubah jadi satu form kecil.
  if (resetting) {
    return (
      <tr className="border-b border-slate-100 bg-amber-50/40">
        <td className="p-4 font-semibold text-slate-800">{user.fullName || "—"}</td>
        <td className="p-4" colSpan={4}>
          <div className="flex flex-wrap items-center gap-2">
            <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password baru (min. 8 karakter)"
                autoComplete="new-password"
                disabled={pwLoading}
                className="w-64 rounded-md border border-slate-200 bg-white px-2 py-1 pr-8 text-sm focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title={showPassword ? "Sembunyikan" : "Tampilkan"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <span className="text-[11px] text-slate-500">
              Beri tahu password barunya langsung ke orang yang bersangkutan.
            </span>
          </div>
          {pwError && (
            <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-rose-600">
              <ShieldAlert className="h-3 w-3 shrink-0" />
              <span>{pwError}</span>
            </p>
          )}
        </td>
        <td className="p-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleResetPassword}
              disabled={pwLoading || newPassword.length < 8}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-40"
              title="Simpan password baru"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setResetting(false);
                setNewPassword("");
                setShowPassword(false);
                setPwError(null);
              }}
              disabled={pwLoading}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-200 text-slate-600 transition-colors hover:bg-slate-300"
              title="Batal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  // Read-only Row
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="p-4 font-semibold text-slate-800">{user.fullName || "—"}</td>
      <td className="p-4 text-slate-600">{user.position || "—"}</td>
      <td className="p-4 text-slate-600">{currentDivName}</td>
      <td className="p-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            user.role === "superadmin"
              ? "bg-rose-100 text-rose-700"
              : user.role === "admin"
              ? "bg-blue-100 text-blue-700"
              : user.role === "leader"
              ? "bg-purple-100 text-purple-700"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {displayRole}
        </span>
      </td>
      <td className="p-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            user.employmentStatus === "active"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700 border border-rose-200"
          }`}
        >
          {user.employmentStatus === "active" ? "Aktif" : "Nonaktif"}
        </span>
      </td>
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-all hover:border-slate-300"
            title="Edit Karyawan"
            disabled={lockedForCurrentUser || deleting}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {canResetPassword && (
            <button
              onClick={() => setResetting(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 transition-all hover:bg-amber-100 hover:text-amber-700 disabled:opacity-50"
              title="Ubah Password"
              disabled={deleting}
            >
              <KeyRound className="h-3.5 w-3.5" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-700 transition-all disabled:opacity-50"
              title="Hapus Karyawan"
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {deleteError && (
          <p className="mt-1 text-[10px] text-rose-600 flex items-center justify-end gap-1 font-medium">
            <ShieldAlert className="h-3 w-3 shrink-0" />
            <span>{deleteError}</span>
          </p>
        )}
        {pwDone && (
          <p className="mt-1 flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600">
            <Check className="h-3 w-3 shrink-0" />
            <span>Password berhasil diubah</span>
          </p>
        )}
      </td>
    </tr>
  );
}
