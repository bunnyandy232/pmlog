/**
 * Seed PMLog: admin001 + employee_lizhiyuan (+ 李志远 projects/logs)
 *
 * Usage:
 *   node supabase/seed.mjs
 *
 * Requires .env.local:
 *   SUPABASE_URL=
 *   SUPABASE_SERVICE_ROLE_KEY=
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const env = { ...process.env };
  const candidates = [
    resolve(root, ".env.local"),
    resolve(root, ".env")
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line) => {
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

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateOf(offsetDays) {
  const d = new Date(2026, 10, 23);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

async function ensureUser({ username, password, displayName, line, role, mustChangePassword }) {
  const email = emailOf(username);
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) throw list.error;
  let user = (list.data.users || []).find((u) => u.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName }
    });
    if (created.error) throw created.error;
    user = created.data.user;
    console.log("created auth user", username, user.id);
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName }
    });
    if (updated.error) throw updated.error;
    console.log("updated auth user", username, user.id);
  }

  const { error: upsertErr } = await admin.from("profiles").upsert({
    id: user.id,
    username,
    display_name: displayName,
    line,
    role,
    must_change_password: !!mustChangePassword,
    active: true
  });
  if (upsertErr) throw upsertErr;
  return user;
}

async function clearBizData() {
  // service role bypasses RLS; filters required by PostgREST
  const del = async (table, column) => {
    const { error } = await admin.from(table).delete().gte(column, "1970-01-01");
    if (error) {
      const { error: e2 } = await admin.from(table).delete().not(column, "is", null);
      if (e2) console.warn("clear", table, e2.message);
    }
  };
  await del("work_logs", "created_at");
  await del("milestones", "created_at");
  const { data: members } = await admin.from("project_members").select("project_id,user_id");
  if (members && members.length) {
    for (const m of members) {
      await admin.from("project_members").delete().eq("project_id", m.project_id).eq("user_id", m.user_id);
    }
  }
  await del("projects", "created_at");
}

async function seedLizhiyuanData(adminId, lizId) {
  const PROJECT_NAMES = [
    "值班手册改版",
    "条线日报自动化",
    "客户画像标签治理",
    "销售话术知识库",
    "客户回访任务闭环",
    "费用分摊规则梳理"
  ];
  const MILESTONES = [
    "完成需求澄清与范围确认",
    "输出方案草案并通过初审",
    "完成核心功能开发/配置"
  ];
  const SPECIAL = [
    "完成阶段性方案初稿并提交评审。",
    "落地一批规则/模板并完成自测。",
    "与对接人确认验收标准。"
  ];
  const DAILY = [
    "参加条线晨会，同步本周重点事项。",
    "梳理待办清单并与对接人确认口径。",
    "回复业务咨询邮件并记录结论。",
    "整理周例会纪要，分发行动项。",
    "学习内部制度更新并做笔记。"
  ];

  for (let i = 0; i < PROJECT_NAMES.length; i++) {
    const startOff = -18 + i * 2;
    const endOff = 5 + i * 4;
    const importance = i % 3 === 0 ? "not_important" : "important";
    const urgency = i % 2 === 0 ? "urgent" : "not_urgent";

    const { data: project, error: pErr } = await admin
      .from("projects")
      .insert({
        name: `李志远·${PROJECT_NAMES[i]}`,
        start_date: dateOf(startOff),
        end_date: dateOf(endOff),
        importance,
        contact: "财富条线对接人",
        assigned_at: dateOf(startOff),
        lead_id: lizId,
        status: "active",
        progress: 10 + (i * 12) % 80,
        created_by: adminId
      })
      .select("*")
      .single();
    if (pErr) throw pErr;

    const { error: mErr } = await admin.from("project_members").insert({
      project_id: project.id,
      user_id: lizId,
      urgency
    });
    if (mErr) throw mErr;

    const msCount = 1 + (i % 3);
    for (let m = 0; m < msCount; m++) {
      const { error } = await admin.from("milestones").insert({
        project_id: project.id,
        milestone_date: dateOf(startOff + 3 + m * 3),
        body: MILESTONES[m % MILESTONES.length],
        author_id: lizId,
        from_log: false
      });
      if (error) throw error;
    }

    const specialN = 1 + (i % 2);
    for (let s = 0; s < specialN; s++) {
      const content = SPECIAL[(i + s) % SPECIAL.length];
      const logDate = dateOf(-s - (i % 3));
      const { error: lErr } = await admin.from("work_logs").insert({
        log_type: "special",
        project_id: project.id,
        author_id: lizId,
        log_date: logDate,
        log_time: `${pad(9 + ((i + s) % 8))}:${pad((i * 7 + s * 11) % 60)}`,
        content
      });
      if (lErr) throw lErr;
      const { error: mlErr } = await admin.from("milestones").insert({
        project_id: project.id,
        milestone_date: logDate,
        body: content,
        author_id: lizId,
        from_log: true
      });
      if (mlErr) throw mlErr;
    }
  }

  for (let d = 0; d < 5; d++) {
    const { error } = await admin.from("work_logs").insert({
      log_type: "daily",
      project_id: null,
      author_id: lizId,
      log_date: dateOf(-d),
      log_time: `${pad(8 + d)}:${pad((13 + d * 17) % 60)}`,
      content: DAILY[d % DAILY.length]
    });
    if (error) throw error;
  }
}

async function main() {
  console.log("Seeding against", url);

  const adminUser = await ensureUser({
    username: "admin001",
    password: "xxjs@zyzq",
    displayName: "系统管理员",
    line: "中心主管",
    role: "leader",
    mustChangePassword: false
  });

  const liz = await ensureUser({
    username: "employee_lizhiyuan",
    password: "Pmlog@123",
    displayName: "李志远",
    line: "财富条线",
    role: "employee",
    mustChangePassword: true
  });

  await clearBizData();
  await seedLizhiyuanData(adminUser.id, liz.id);

  console.log("Seed complete.");
  console.log("Accounts:");
  console.log("  admin001 / xxjs@zyzq");
  console.log("  employee_lizhiyuan / Pmlog@123 (must change password)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
