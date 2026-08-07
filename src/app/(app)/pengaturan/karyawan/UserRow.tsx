"use client";

import { useState } from "react";
import { type AppRole, ROLE_LABEL } from "@/lib/roles";
import { updateUserRoleAndProfile, deleteUser, changeUserPassword } from "./actions";
import { MIN_PANJANG_PASSWORD } from "@/lib/password";
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

  // Ubah password bersifat opsional: dibiarkan kosong = password lama tetap.
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const resetPasswordFields = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
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
    setError(null);

    // Validasi password dulu, sebelum menyentuh server -- supaya profil tidak
    // terlanjur tersimpan padahal isian passwordnya keliru.
    const ingin = newPassword.length > 0 || confirmPassword.length > 0;
    if (ingin) {
      if (newPassword !== confirmPassword) {
        setError("Konfirmasi password tidak cocok dengan password baru.");
        return;
      }
      if (newPassword.length < MIN_PANJANG_PASSWORD) {
        setError(`Password baru minimal ${MIN_PANJANG_PASSWORD} karakter.`);
        return;
      }
    }

    setLoading(true);
    const res = await updateUserRoleAndProfile(user.id, {
      fullName,
      divisionId: divisionId || null,
      position,
      employmentStatus,
      role,
    });

    if (!res.success) {
      setLoading(false);
      setError(res.error);
      return;
    }

    if (ingin) {
      const resSandi = await changeUserPassword(user.id, newPassword);
      setLoading(false);
      if (!resSandi.success) {
        // Profil sudah tersimpan; beri tahu supaya tidak mengira semuanya gagal.
        setError(`Data tersimpan, tetapi password gagal diubah: ${resSandi.error}`);
        return;
      }
    } else {
      setLoading(false);
    }

    resetPasswordFields();
    setIsEditing(false);
  };

  const currentDivName = divisions.find((d) => d.id === user.divisionId)?.name ?? "—";
  const displayRole = ROLE_LABEL[user.role];
  // Hanya Owner (superadmin) yang boleh menghapus, dan tidak boleh menghapus diri sendiri.
  const canDelete = currentUserRole === "superadmin" && user.id !== currentUserId;
  const isPeerOrAboveTarget = user.role === "superadmin" || user.role === "admin";
  const lockedForCurrentUser = currentUserRole !== "superadmin" && isPeerOrAboveTarget;

  if (isEditing) {
    return (
      <>
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
                resetPasswordFields();
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

      {/* Ubah Password -- opsional. Ditaruh di baris sendiri (bukan di dalam
          kolom) supaya kedua isian punya ruang yang cukup dan terbaca di HP. */}
      <tr className="border-b border-slate-100 bg-slate-50/50">
        <td colSpan={6} className="px-4 pb-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <KeyRound className="h-3.5 w-3.5 text-slate-400" />
              <h4 className="text-xs font-bold text-slate-700">Ubah Password</h4>
              <span className="text-[11px] font-medium text-slate-400">
                — kosongkan jika password tidak ingin diubah
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Password Baru</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    disabled={loading}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={`Min. ${MIN_PANJANG_PASSWORD} karakter`}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 py-2 text-xs focus:border-blue-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">Konfirmasi Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className={`w-full rounded-xl border bg-white px-3.5 py-2 text-xs focus:outline-none transition-colors ${
                    confirmPassword.length > 0 && confirmPassword !== newPassword
                      ? "border-rose-300 focus:border-rose-500"
                      : "border-slate-200 focus:border-blue-500"
                  }`}
                />
                {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                  <p className="text-[10px] font-medium text-rose-600">
                    Belum sama dengan password baru.
                  </p>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
      </>
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
      </td>
    </tr>
  );
}
