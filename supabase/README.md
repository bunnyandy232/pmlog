# Supabase 部署步骤

项目 URL：`https://kiuhfbaqvgpojgxakvpl.supabase.co`

## 1. 复制 API 密钥

Dashboard → **Project Settings** → **API Keys**（新界面；旧名曾叫 API）：

- **Publishable**（`sb_publishable_…`，旧称 anon）→ `SUPABASE_ANON_KEY`
- **Secret**（`sb_secret_…`，旧称 service_role）→ `SUPABASE_SERVICE_ROLE_KEY`（仅本地种子用）
  - 同一页的 **Legacy API keys** 里也可点 Reveal 复制旧版 `service_role` JWT（`eyJ…`）
  - 若只有「Create new API keys」按钮，点一下会生成 publishable + secret，不影响旧密钥

写入仓库根目录 `.env.local`（参考 `.env.example`）。

## 2. 执行建表 SQL

打开 Dashboard → **SQL Editor**，粘贴并运行：

[`migrations/001_pmlog.sql`](migrations/001_pmlog.sql)

## 3. Auth 设置建议

Dashboard → **Authentication** → **Providers** → Email：

- 关闭 “Confirm email”（演示账号由 service_role 创建并已 confirm）
- 无需开启找回密码邮件

## 4. 种子数据

```bash
npm install
npm run seed
node scripts/write-config.mjs
```

将写入：

- `admin001` / `xxjs@zyzq`（领导）
- `employee_lizhiyuan` / `Pmlog@123`（员工，首次须改密）
- 仅李志远的 6 个项目 + 里程碑 + 专项/日常日志

## 5. 本地预览

须用 http 打开（勿用 `file://`）：

```bash
npm run serve
```

访问 `http://localhost:5173/index.html`

## 管理员重置密码

1. Dashboard → Authentication → Users → 选中用户 → Reset password / 更新密码  
2. SQL：`update profiles set must_change_password = true where username = 'employee_lizhiyuan';`
