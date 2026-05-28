create table if not exists public.hongshan_admin (
  id text primary key,
  admin jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.hongshan_users (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.hongshan_admin enable row level security;
alter table public.hongshan_users enable row level security;

drop policy if exists "hongshan_admin_select" on public.hongshan_admin;
drop policy if exists "hongshan_admin_insert" on public.hongshan_admin;
drop policy if exists "hongshan_admin_update" on public.hongshan_admin;
drop policy if exists "hongshan_users_select" on public.hongshan_users;
drop policy if exists "hongshan_users_insert" on public.hongshan_users;
drop policy if exists "hongshan_users_update" on public.hongshan_users;

create policy "hongshan_admin_select"
  on public.hongshan_admin for select
  to anon
  using (true);

create policy "hongshan_admin_insert"
  on public.hongshan_admin for insert
  to anon
  with check (true);

create policy "hongshan_admin_update"
  on public.hongshan_admin for update
  to anon
  using (true)
  with check (true);

create policy "hongshan_users_select"
  on public.hongshan_users for select
  to anon
  using (true);

create policy "hongshan_users_insert"
  on public.hongshan_users for insert
  to anon
  with check (true);

create policy "hongshan_users_update"
  on public.hongshan_users for update
  to anon
  using (true)
  with check (true);

insert into public.hongshan_admin (id, admin)
values (
  'main',
  '{
    "roundId": "main",
    "gameOpen": { "bingo": true, "sector": false, "panel": false, "survival": false },
    "gameEnded": { "bingo": false, "sector": false, "panel": false, "survival": false },
    "answersVisible": { "sector": false, "panel": false, "survival": false },
    "bingoDeadline": null,
    "bingoRevealed": {
      "增长": false, "客户": false, "协同": false, "创新": false, "AI": false,
      "全球化": false, "合规": false, "利润": false, "现金流": false, "品牌": false,
      "组织": false, "人才": false, "效率": false, "生态": false, "突破": false,
      "复盘": false, "交付": false, "质量": false, "体验": false, "长期主义": false,
      "战略": false, "风险": false, "数据": false, "产品": false, "文化": false,
      "冠军": false, "目标": false, "信任": false, "韧性": false, "未来": false
    },
    "released": {
      "sector-1-1": false, "sector-1-2": false, "sector-2-1": false, "sector-2-2": false,
      "sector-3-1": false, "sector-3-2": false, "sector-4-1": false, "sector-4-2": false,
      "sector-5-1": false, "sector-5-2": false,
      "panel-1": false, "panel-2": false, "panel-3": false,
      "panel-4": false, "panel-5": false, "panel-6": false,
      "survival-1": false, "survival-2": false, "survival-3": false,
      "survival-4": false, "survival-5": false
    }
  }'::jsonb
)
on conflict (id) do nothing;

delete from public.hongshan_users
where id like 'seed-%';

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'hongshan_admin'
  ) then
    alter publication supabase_realtime add table public.hongshan_admin;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
    and schemaname = 'public'
    and tablename = 'hongshan_users'
  ) then
    alter publication supabase_realtime add table public.hongshan_users;
  end if;
end $$;
