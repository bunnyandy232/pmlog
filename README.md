# PMLog

技术部门工作日志与项目管理（静态前端 + Supabase）。

## 本地运行

1. 配置 Supabase（见 [`supabase/README.md`](supabase/README.md)）
2. 生成前端配置并启动：

```bash
node scripts/write-config.mjs
npm run serve
```

打开 `http://localhost:5173/index.html`（不要用 `file://`）。

## 登录说明

- 账号由管理员分配；首次登录或管理员重置后须强制修改密码
- 不提供自助找回密码
- 管理员：`admin001` / `xxjs@zyzq`
- 员工/领导初始密码统一 `Pmlog@123`（首次须改密；已改密账号以新密码为准）
- 命名规则：领导 `leader_拼音`（如 `leader_wangrui`），员工 `employee_拼音`（如 `employee_lizhiyuan`）；管理员特例 `admin001`
- 仅同步人员：`npm run seed:users`（不覆盖项目/日志）

## 角色说明

- **admin001**：领导权限（项目中心：项目总览 / 项目明细 / 日志明细）
- **employee_lizhiyuan**：员工，仅本人项目与日志

## 架构说明

| 地址 | 前端从哪来 | 数据在哪 |
|------|------------|----------|
| `file:///.../prototypes/...`（早期） | 本机磁盘 | 浏览器 localStorage（仅本机） |
| `http://localhost:5173/`（现在） | 本机静态服务 | **互联网 Supabase** |
| Vercel 线上域名 | GitHub → Vercel 构建 | **同一套互联网 Supabase** |

前端是静态页；登录与业务数据走 Supabase（Auth + Postgres）。`service_role` 只用于本机种子，**不要**配到 Vercel。

## 在线部署（GitHub + Vercel + Supabase）

1. 推送代码到 GitHub
2. Vercel 项目环境变量（Production / Preview）：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`（publishable / anon，可进前端）
3. Build Command：`npm run build`（生成 `prototypes/config.js`）
4. 部署后用线上域名登录，与本地共用同一云库
