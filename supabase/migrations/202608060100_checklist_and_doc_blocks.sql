-- Standalone weekly checklist items (no study goal / amount required) and
-- brainstorm document blocks (rich text: title/subtitle/heading/bullet/body).

alter table public.brainstorm_boards
  add column if not exists blocks jsonb not null default '[]'::jsonb;

-- Per-date brainstorming documents (opened from Monthly via Alt+7), stored on
-- the user's preferences row alongside daily_memos.
alter table public.user_preferences
  add column if not exists date_brainstorms jsonb not null default '{}'::jsonb;

-- Per-subject daily study time window (placed on the weekly timeline).
alter table public.study_goals
  add column if not exists daily_start_time text,
  add column if not exists daily_end_time text;

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  text text not null default '',
  done boolean not null default false,
  sort_order integer not null default 0,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists checklist_items_user_date_idx on public.checklist_items (user_id, date);

alter table public.checklist_items enable row level security;
drop policy if exists own_data on public.checklist_items;
create policy own_data on public.checklist_items
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
