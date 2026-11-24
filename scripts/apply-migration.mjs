/**
 * Apply supabase/migrations/001_pmlog.sql via PostgREST is not possible for DDL.
 * Uses the Supabase Management-less approach: execute via pg through supabase SQL API
 * with the database REST endpoint using service role + rpc, OR split and use
 * https://api.supabase.com — here we use the Postgres HTTP wire via supabase-js
 * is insufficient for DDL. Fallback: use fetch to the SQL endpoint if available.
 *
 * Practical approach for hosted projects without CLI login:
 * POST to https://<ref>.supabase.co/rest/v1/rpc will not run DDL.
 * We use the Supabase Database API via `pg` if DATABASE_URL set,
 * otherwise call the query endpoint with service role through
 * https://kiuhfbaqvgpojgxakvpl.supabase.co/pg — not public.
 *
 * This script uses @supabase/supabase-js only to verify connectivity,
 * and applies SQL by splitting statements through the Supabase SQL Editor API
 * is not available. Best effort: use `postgres` package with connection string
 * from SUPABASE_DB_PASSWORD, or instruct paste.
 *
 * Alternative working method: use fetch against
 * https://api.supabase.com/v1/projects/{ref}/database/query
 * requires personal access token.
 *
 * For this project we apply via node-postgres if SUPABASE_DB_URL is set;
 * else we try the experimental SQL run using supabase functions.
 */
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

const env = loadEnv();
const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const accessToken = env.SUPABASE_ACCESS_TOKEN;
const projectRef = (url || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!url || !serviceKey) {
  console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sqlPath = resolve(root, "supabase/migrations/001_pmlog.sql");
const sql = readFileSync(sqlPath, "utf8");

async function applyViaManagementApi() {
  if (!accessToken) return false;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: sql })
    }
  );
  const text = await res.text();
  if (!res.ok) {
    console.error("Management API failed:", res.status, text);
    return false;
  }
  console.log("Migration applied via Management API");
  return true;
}

async function applyViaPgMeta() {
  // Supabase studio uses pg-meta; some projects expose:
  // POST /pg/query with service role — not officially supported but works on many projects
  const endpoints = [
    `${url}/pg/query`,
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: sql })
      });
      const text = await res.text();
      console.log(endpoint, res.status, text.slice(0, 300));
      if (res.ok) {
        console.log("Migration applied via", endpoint);
        return true;
      }
    } catch (e) {
      console.warn(endpoint, e.message);
    }
  }
  return false;
}

async function verifyTables() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await admin.from("profiles").select("id").limit(1);
  if (error && /relation .* does not exist|Could not find the table/i.test(error.message)) {
    return false;
  }
  if (error) {
    console.warn("profiles check:", error.message);
    return false;
  }
  console.log("profiles table OK", data);
  return true;
}

const okTables = await verifyTables();
if (okTables) {
  console.log("Schema already present — skip DDL");
  process.exit(0);
}

if (await applyViaManagementApi()) process.exit(0);
if (await applyViaPgMeta()) process.exit(0);

console.error(`
无法自动执行 DDL。请打开 SQL Editor 粘贴运行：
  ${sqlPath}

页面：
  https://supabase.com/dashboard/project/${projectRef}/sql/new
`);
process.exit(2);
