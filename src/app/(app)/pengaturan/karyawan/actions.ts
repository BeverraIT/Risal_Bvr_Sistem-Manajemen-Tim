"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, type AppRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type UserActionState = {
  success: boolean;
  error: string | null;
};

export async function updateUserRoleAndProfile(
  userId: string,
  data: {
    role: AppRole;
    divisionId: string | null;
    fullName: string;
    position: string;
    employmentStatus: string;
  }
): Promise<UserActionState> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Role protection logic
    if (currentUser.role !== "superadmin" && currentUser.role !== "admin" && currentUser.role !== "leader") {
      return { success: false, error: "Unauthorized. Hanya Leader Divisi, Management, atau Owner yang dapat melakukan ini." };
    }

    // Management cannot promote anyone to Owner
    if (data.role === "superadmin" && currentUser.role !== "superadmin") {
      return { success: false, error: "Hanya Owner yang dapat memberikan akses Owner." };
    }

    // Management cannot promote anyone to Management -- only Owner mints peers/superiors
    if (data.role === "admin" && currentUser.role !== "superadmin") {
      return { success: false, error: "Hanya Owner yang dapat memberikan akses Management." };
    }

    // Leader cannot grant Leader Divisi access -- only Management/Owner can
    if (data.role === "leader" && currentUser.role === "leader") {
      return { success: false, error: "Leader Divisi tidak dapat memberikan akses Leader Divisi." };
    }

    // Writes bypass RLS via the service-role client (same as registerNewUser
    // -- user_roles has no non-superadmin RLS write policy by design, so all
    // authorization for Management/Leader happens here in code instead).
    const supabaseAdmin = createAdminClient();

    // Fetch the target user's current role + division
    const [{ data: targetRoleRow }, { data: targetProfile }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("profiles").select("division_id").eq("id", userId).maybeSingle(),
    ]);

    // Prevent Management from modifying an Owner's role or profile
    if (targetRoleRow?.role === "superadmin" && currentUser.role !== "superadmin") {
      return { success: false, error: "Management tidak dapat mengubah profil atau hak akses Owner." };
    }

    // Prevent Management from modifying a peer Management account
    if (targetRoleRow?.role === "admin" && currentUser.role !== "superadmin") {
      return { success: false, error: "Management tidak dapat mengubah profil atau hak akses sesama Management." };
    }

    // Leader Divisi: can only edit Staff already in their own division, and
    // can only keep them as Staff in that same division (no role/division change).
    if (currentUser.role === "leader") {
      if (targetRoleRow?.role !== "staff" || targetProfile?.division_id !== currentUser.divisionId) {
        return { success: false, error: "Leader Divisi hanya bisa mengelola Staff di divisinya sendiri." };
      }
      if (data.role !== "staff" || data.divisionId !== currentUser.divisionId) {
        return { success: false, error: "Leader Divisi tidak bisa mengubah role atau memindahkan divisi Staff." };
      }
    }

    // 1. Update profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: data.fullName,
        division_id: data.divisionId || null,
        position: data.position || null,
        employment_status: data.employmentStatus,
      }, { onConflict: "id" });

    if (profileError) {
      return { success: false, error: `Profil error: ${profileError.message}` };
    }

    // 2. Update user_roles table
    // Delete existing roles first to ensure one role per user
    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteRoleError) {
      return { success: false, error: `Hapus role error: ${deleteRoleError.message}` };
    }

    // Insert new role
    const { error: insertRoleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: data.role,
        division_id: (data.role === "leader" || data.role === "staff") ? data.divisionId : null,
      });

    if (insertRoleError) {
      return { success: false, error: `Tambah role error: ${insertRoleError.message}` };
    }

    revalidatePath("/pengaturan/karyawan");
    revalidatePath("/");
    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return { success: false, error: message };
  }
}

export async function deleteUser(userId: string): Promise<UserActionState> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Hanya Owner (superadmin) yang boleh menghapus user secara permanen.
    if (currentUser.role !== "superadmin") {
      return { success: false, error: "Hanya Owner yang dapat menghapus karyawan." };
    }

    // Owner tidak boleh menghapus akunnya sendiri (mencegah lockout).
    if (userId === currentUser.id) {
      return { success: false, error: "Anda tidak dapat menghapus akun Anda sendiri." };
    }

    const supabaseAdmin = createAdminClient();

    // Cukup hapus akun auth: FK ke auth.users sudah dikonfigurasi (migrasi
    // 0021) sehingga profiles/user_roles serta jejak lain ikut CASCADE, dan
    // record bersama (notulen, forum, proyek) di-SET NULL. Menghapus di sini
    // saja menjaga konsistensi -- tidak ada penghapusan manual yang bisa
    // meninggalkan akun auth yatim bila salah satu langkah gagal.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      // authError.message kadang kosong saat error datang dari level database
      // (mis. FK belum di-cascade) -- sertakan detail apa pun yang tersedia.
      const detail =
        authError.message ||
        (authError as { code?: string }).code ||
        JSON.stringify(authError);
      return { success: false, error: `Gagal menghapus akun auth: ${detail}` };
    }

    revalidatePath("/pengaturan/karyawan");
    revalidatePath("/");
    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return { success: false, error: message };
  }
}

export async function registerNewUser(data: {
  email: string;
  password: string;
  fullName: string;
  position: string;
  divisionId: string | null;
  role: AppRole;
}): Promise<UserActionState> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }

    // Role protection logic
    if (currentUser.role !== "superadmin" && currentUser.role !== "admin" && currentUser.role !== "leader") {
      return { success: false, error: "Unauthorized. Hanya Leader Divisi, Management, atau Owner yang dapat mendaftarkan karyawan baru." };
    }

    // Management cannot create Owner accounts
    if (data.role === "superadmin" && currentUser.role !== "superadmin") {
      return { success: false, error: "Hanya Owner yang dapat membuat akun dengan akses Owner." };
    }

    // Management cannot create peer Management accounts -- only Owner can
    if (data.role === "admin" && currentUser.role !== "superadmin") {
      return { success: false, error: "Hanya Owner yang dapat membuat akun dengan akses Management." };
    }

    // Leader Divisi can only create Staff accounts in their own division
    if (currentUser.role === "leader") {
      if (data.role !== "staff") {
        return { success: false, error: "Leader Divisi hanya bisa membuat akun dengan akses Staff." };
      }
      if (data.divisionId !== currentUser.divisionId) {
        return { success: false, error: "Leader Divisi hanya bisa membuat Staff untuk divisinya sendiri." };
      }
    }

    // Inputs validation
    if (!data.email || !data.password || !data.fullName) {
      return { success: false, error: "Email, password, dan nama lengkap wajib diisi." };
    }

    if (data.password.length < 6) {
      return { success: false, error: "Password minimal terdiri dari 6 karakter." };
    }

    const supabaseAdmin = createAdminClient();

    // 1. Create the user in Supabase Auth using the admin service role client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // auto-confirm the user email so they can log in directly
    });

    if (authError) {
      return { success: false, error: `Gagal membuat akun auth: ${authError.message}` };
    }

    const newUserId = authData.user?.id;
    if (!newUserId) {
      return { success: false, error: "Gagal mendapatkan User ID dari Auth" };
    }

    // 2. Insert into profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUserId,
        full_name: data.fullName,
        division_id: data.divisionId || null,
        position: data.position || null,
        employment_status: "active",
      });

    if (profileError) {
      // Cleanup auth user to prevent orphaned auth record
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Gagal membuat data profil: ${profileError.message}` };
    }

    // 3. Insert into user_roles table
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUserId,
        role: data.role,
        division_id: (data.role === "leader" || data.role === "staff") ? data.divisionId : null,
      });

    if (roleError) {
      // Cleanup both auth and profile
      await supabaseAdmin.from("profiles").delete().eq("id", newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Gagal memberikan hak akses: ${roleError.message}` };
    }

    revalidatePath("/pengaturan/karyawan");
    revalidatePath("/");
    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return { success: false, error: message };
  }
}

// Reset password anggota tim. Khusus Owner (superadmin) -- sejalan dengan
// pembagian wewenang yang sudah ada: Owner memegang tata kelola akun
// (memberi akses Owner/Management, menghapus karyawan), Management hanya
// operasional. Password baru ditentukan Owner, tidak pernah ditulis ke log
// atau dikembalikan ke klien.
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<UserActionState> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Not authenticated" };
    }
    if (currentUser.role !== "superadmin") {
      return { success: false, error: "Hanya Owner yang dapat mengubah password karyawan." };
    }
    if (newPassword.length < 8) {
      return { success: false, error: "Password minimal 8 karakter." };
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return { success: false, error: `Gagal mengubah password: ${error.message}` };
    }

    return { success: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan internal";
    return { success: false, error: message };
  }
}
