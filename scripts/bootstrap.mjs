// One-time Phase 1 bootstrap: seed divisions + create the first superadmin.
// Uses the service-role key, so it bypasses RLS by design. Run with:
//   node scripts/bootstrap.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim().replace(/^"(.*)"$/, "$1");
  }
}
loadEnvLocal();

const SUPERADMIN_EMAIL = process.env.BOOTSTRAP_SUPERADMIN_EMAIL ?? "operasional.ai.2026@gmail.com";
const SUPERADMIN_NAME = process.env.BOOTSTRAP_SUPERADMIN_NAME ?? "Owner";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const DIVISIONS = [
  { name: "IT", category: "Internal" },
  { name: "Purchasing", category: "Internal" },
  { name: "Accounting", category: "Internal" },
  { name: "Marketing Shopee", category: "Marketplace" },
  { name: "Marketing TikTok", category: "Marketplace" },
  { name: "Affiliator TikTok", category: "Marketplace" },
  { name: "Inbound", category: "Gudang" },
  { name: "Restock", category: "Gudang" },
  { name: "Operasional", category: "Gudang" },
  { name: "Customer Service", category: "Support" },
  { name: "Admin Cs", category: "Support" },
  { name: "Haven Office", category: "Haven" },
  { name: "Haven Produksi", category: "Haven" },
  { name: "Design", category: "Kreatif" },
  { name: "Konten / Live", category: "Kreatif" },
];

async function seedDivisions() {
  const { data, error } = await supabase
    .from("divisions")
    .upsert(DIVISIONS, { onConflict: "name", ignoreDuplicates: true })
    .select("id, name");

  if (error) throw new Error(`Seed divisions failed: ${error.message}`);
  console.log(`Divisions ok (${data?.length ?? 0} rows touched).`);
}

async function bootstrapSuperadmin() {
  const { data: existing } = await supabase.auth.admin.listUsers();
  let user = existing?.users?.find((u) => u.email === SUPERADMIN_EMAIL);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: SUPERADMIN_EMAIL,
      email_confirm: true,
    });
    if (error) throw new Error(`Create superadmin user failed: ${error.message}`);
    user = data.user;
    console.log(`Created auth user ${SUPERADMIN_EMAIL} (${user.id}).`);
  } else {
    console.log(`Auth user ${SUPERADMIN_EMAIL} already exists (${user.id}).`);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { id: user.id, full_name: SUPERADMIN_NAME, employment_status: "active" },
      { onConflict: "id" },
    );
  if (profileError) throw new Error(`Upsert profile failed: ${profileError.message}`);

  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert(
      { user_id: user.id, role: "superadmin", division_id: null },
      { onConflict: "user_id,role" },
    );
  if (roleError) throw new Error(`Upsert role failed: ${roleError.message}`);

  console.log(`Superadmin role set for ${SUPERADMIN_EMAIL}.`);
  console.log(`Login at /login using "Kirim magic link" with this email.`);
}

await seedDivisions();
await bootstrapSuperadmin();
