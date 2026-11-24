import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
for (const file of [resolve(root, ".env.local"), resolve(root, ".env")]) {
  if (!existsSync(file)) continue;
  readFileSync(file, "utf8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!env[m[1]]) env[m[1]] = v;
  });
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = await admin.auth.admin.listUsers({ page: 1, perPage: 5 });
console.log(
  users.error ? `auth ERR: ${users.error.message}` : `auth OK users=${(users.data.users || []).length}`
);

const profiles = await admin.from("profiles").select("id").limit(1);
console.log(profiles.error ? `profiles ERR: ${profiles.error.message}` : `profiles OK`);
