-- PMLog schema + RLS (Supabase)
-- Order: tables → helper functions → policies → triggers → grants

create extension if not exists "pgcrypto";

-- ---------- tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null,
  line text not null default '',
  role text not null check (role in ('leader', 'employee')),
  must_change_password boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_username_idx on public.profiles (username);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date,
  end_date date,
  importance text check (importance is null or importance in ('important', 'not_important')),
  contact text default '',
  assigned_at date,
  lead_id uuid references public.profiles (id),
  status text not null default 'active' check (status in ('active', 'done')),
  progress int not null default 0,
  completed_at date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_lead_idx on public.projects (lead_id);
create index if not exists projects_status_idx on public.projects (status);

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  urgency text check (urgency is null or urgency in ('urgent', 'not_urgent')),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);

create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_date date not null,
  body text not null,
  author_id uuid not null references public.profiles (id),
  from_log boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists milestones_project_idx on public.milestones (project_id);

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  log_type text not null check (log_type in ('daily', 'special')),
  project_id uuid references public.projects (id) on delete set null,
  author_id uuid not null references public.profiles (id),
  log_date date not null,
  log_time text not null default '09:00',
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists work_logs_author_idx on public.work_logs (author_id);
create index if not exists work_logs_date_idx on public.work_logs (log_date);

-- ---------- helpers (after tables exist) ----------
create or replace function public.pmlog_is_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'leader' and p.active = true
  );
$$;

create or replace function public.pmlog_is_project_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = pid and m.user_id = auth.uid()
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.work_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (active = true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.pmlog_is_leader())
  with check (id = auth.uid() or public.pmlog_is_leader());

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.pmlog_is_leader() or public.pmlog_is_project_member(id));

drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.pmlog_is_leader());

drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (public.pmlog_is_leader() or public.pmlog_is_project_member(id))
  with check (public.pmlog_is_leader() or public.pmlog_is_project_member(id));

drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (public.pmlog_is_leader());

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (
    public.pmlog_is_leader()
    or user_id = auth.uid()
    or public.pmlog_is_project_member(project_id)
  );

drop policy if exists project_members_write on public.project_members;
create policy project_members_write on public.project_members
  for all to authenticated
  using (public.pmlog_is_leader() or user_id = auth.uid())
  with check (public.pmlog_is_leader() or user_id = auth.uid());

drop policy if exists milestones_select on public.milestones;
create policy milestones_select on public.milestones
  for select to authenticated
  using (public.pmlog_is_leader() or public.pmlog_is_project_member(project_id));

drop policy if exists milestones_insert on public.milestones;
create policy milestones_insert on public.milestones
  for insert to authenticated
  with check (
    public.pmlog_is_leader()
    or (author_id = auth.uid() and public.pmlog_is_project_member(project_id))
  );

drop policy if exists milestones_update on public.milestones;
create policy milestones_update on public.milestones
  for update to authenticated
  using (public.pmlog_is_leader() or author_id = auth.uid())
  with check (public.pmlog_is_leader() or author_id = auth.uid());

drop policy if exists milestones_delete on public.milestones;
create policy milestones_delete on public.milestones
  for delete to authenticated
  using (public.pmlog_is_leader() or author_id = auth.uid());

drop policy if exists work_logs_select on public.work_logs;
create policy work_logs_select on public.work_logs
  for select to authenticated
  using (public.pmlog_is_leader() or author_id = auth.uid());

drop policy if exists work_logs_insert on public.work_logs;
create policy work_logs_insert on public.work_logs
  for insert to authenticated
  with check (author_id = auth.uid() or public.pmlog_is_leader());

drop policy if exists work_logs_update on public.work_logs;
create policy work_logs_update on public.work_logs
  for update to authenticated
  using (author_id = auth.uid() or public.pmlog_is_leader())
  with check (author_id = auth.uid() or public.pmlog_is_leader());

drop policy if exists work_logs_delete on public.work_logs;
create policy work_logs_delete on public.work_logs
  for delete to authenticated
  using (author_id = auth.uid() or public.pmlog_is_leader());

-- ---------- triggers ----------
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------- grants ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
