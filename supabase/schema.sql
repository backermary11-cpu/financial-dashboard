-- Financial Dashboard: run this once in Supabase → SQL Editor → New query → Run.
-- One row per user holding their whole dashboard as JSON. Row-level security
-- means each signed-in user can only ever read or write their own row.

create table if not exists public.finance_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_data enable row level security;

drop policy if exists "Users read own finance data" on public.finance_data;
create policy "Users read own finance data" on public.finance_data
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own finance data" on public.finance_data;
create policy "Users insert own finance data" on public.finance_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own finance data" on public.finance_data;
create policy "Users update own finance data" on public.finance_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own finance data" on public.finance_data;
create policy "Users delete own finance data" on public.finance_data
  for delete using (auth.uid() = user_id);

-- Live updates between devices (optional; the app also refreshes when it regains focus).
do $$
begin
  alter publication supabase_realtime add table public.finance_data;
exception when duplicate_object then null;
end $$;
