// One-time: set a password for an existing auth user (service-role only).
// Usage: node scripts/set-password.mjs <email> <new-password>
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

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/set-password.mjs <email> <new-password>");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: list } = await supabase.auth.admin.listUsers();
const user = list?.users?.find((u) => u.email === email);
if (!user) {
  console.error(`No user found with email ${email}`);
  process.exit(1);
}

const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
if (error) {
  console.error(`Failed: ${error.message}`);
  process.exit(1);
}

console.log(`Password set for ${email}.`);
