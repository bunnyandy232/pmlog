/**
 * Migrate all people into Auth + profiles.
 * Does NOT touch projects / milestones / work_logs.
 *
 * Usage: node supabase/seed-users.mjs
 *
 * Existing accounts: keep current password & must_change_password.
 * New accounts: initial password from roster (usually Pmlog@123), must change.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { PEOPLE } from "./people.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
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
  return env;
}

function emailOf(username) {
  return `${username}@pmlog.local`;
}

const env = loadEnv();
const url = env.SUPABASE_URL || "https://kiuhfbaqvgpojgxakvpl.supabase.co";
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function listAllUsers() {
  const users = [];
  let page = 1;
  for (;;) {
    const res = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (res.error) throw res.error;
    const batch = res.data.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
    page += 1;
  }
  return users;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(label, fn, tries = 5) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const msg = err?.message || String(err);
      console.warn(`retry ${i}/${tries} ${label}:`, msg);
      await sleep(600 * i);
    }
  }
  throw last;
}

async function ensurePerson(person, existingByEmail) {
  const email = emailOf(person.username);
  let user = existingByEmail.get(email);
  let created = false;

  if (!user) {
    const createdRes = await withRetry(`create ${person.username}`, () =>
      admin.auth.admin.createUser({
        email,
        password: person.password,
        email_confirm: true,
        user_metadata: {
          username: person.username,
          display_name: person.displayName
        }
      })
    );
    if (createdRes.error) throw createdRes.error;
    user = createdRes.data.user;
    created = true;
    existingByEmail.set(email, user);
    console.log("created", person.username);
  } else {
    const meta = await withRetry(`meta ${person.username}`, () =>
      admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
        user_metadata: {
          username: person.username,
          display_name: person.displayName
        }
      })
    );
    if (meta.error) throw meta.error;
    console.log("exists ", person.username);
  }

  const row = {
    id: user.id,
    username: person.username,
    display_name: person.displayName,
    line: person.line,
    role: person.role,
    active: true
  };
  if (created) {
    row.must_change_password = !!person.mustChangePassword;
  }

  const upserted = await withRetry(`profile ${person.username}`, () =>
    admin.from("profiles").upsert(row)
  );
  if (upserted.error) throw upserted.error;
  await sleep(250);
  return { username: person.username, created };
}

async function main() {
  console.log("Seeding users only →", url);
  console.log("Roster size:", PEOPLE.length);
  const existing = await listAllUsers();
  const byEmail = new Map(existing.map((u) => [u.email, u]));

  let createdN = 0;
  for (const person of PEOPLE) {
    const r = await ensurePerson(person, byEmail);
    if (r.created) createdN += 1;
  }

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("username, display_name, role, line")
    .eq("active", true)
    .order("username");
  if (error) throw error;

  console.log("Done. created=", createdN, "profiles=", profiles.length);
  profiles.forEach((p) => {
    console.log(`  ${p.username.padEnd(28)} ${p.role.padEnd(10)} ${p.display_name} · ${p.line}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
