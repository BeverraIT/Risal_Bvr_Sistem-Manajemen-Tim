import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { type AppRole, ROLE_LABEL } from "@/lib/roles";

// Re-exported for existing server-side importers -- client components
// should import these directly from "@/lib/roles" instead, since this file
// pulls in next/headers via lib/supabase/server and can't be bundled client-side.
export type { AppRole };
export { ROLE_LABEL };

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AppRole;
  divisionId: string | null;
};

// Dibungkus React cache(): layout DAN setiap page memanggil ini di request
// yang sama, jadi tanpa dedupe satu kali buka halaman = 2x auth.getUser()
// + 4x query (user_roles & profiles, dua kali). cache() menyatukannya jadi
// sekali per request; hasilnya tidak pernah dipakai lintas request, jadi
// aman untuk data per-user.
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: roleRow }, { data: profile }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role, division_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name, division_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: (roleRow?.role as AppRole) ?? "staff",
    divisionId: roleRow?.division_id ?? profile?.division_id ?? null,
  };
});
