-- DEAR MY DIARY — Supabase 전체 설정 SQL (SQL Editor에 통째로 붙여넣고 Run 한 번이면 끝)
-- = migrations 202608020100 + 202608020200 + 202608060100 순서대로 합친 파일

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Diary Keeper', handle text not null unique,
  avatar_path text, timezone text not null default 'Asia/Seoul', default_event_duration integer not null default 60,
  default_reminder integer not null default 10, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.planner_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, description text not null default '', start_at timestamptz not null, end_at timestamptz not null,
  all_day boolean not null default false, color text not null default '#8f78b8', location text not null default '',
  status text not null default 'planned' check(status in ('planned','done','cancelled')), recurrence_rule text not null default '', reminder_minutes integer,
  source text not null default 'local', google_sync boolean not null default false, external_provider text, external_calendar_id text,
  external_event_id text, external_updated_at timestamptz, last_synced_at timestamptz, sync_status text not null default 'local', sync_error text,
  deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(end_at > start_at)
);
create index if not exists planner_events_user_start_idx on public.planner_events(user_id,start_at);
create unique index if not exists planner_events_external_unique on public.planner_events(user_id,external_provider,external_calendar_id,external_event_id) where external_event_id is not null;
create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null unique references public.planner_events(id) on delete cascade, title text not null default '', body text not null default '', mood text not null default 'calm', tags text[] not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.diary_images (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.diary_entries(id) on delete cascade, storage_path text not null, file_name text not null,
  sort_order integer not null default 0, created_at timestamptz not null default now(), unique(entry_id,sort_order)
);
create table if not exists public.diary_comments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.diary_entries(id) on delete cascade, body text not null check(length(body)<=1000), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.brainstorm_boards (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.brainstorm_nodes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null references public.brainstorm_boards(id) on delete cascade, title text not null default '', body text not null default '', color text not null default '#fff4a8',
  x double precision not null default 0, y double precision not null default 0, width double precision not null default 220, height double precision not null default 150,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.brainstorm_edges (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  board_id uuid not null references public.brainstorm_boards(id) on delete cascade, source_id uuid not null references public.brainstorm_nodes(id) on delete cascade,
  target_id uuid not null references public.brainstorm_nodes(id) on delete cascade, created_at timestamptz not null default now(), unique(board_id,source_id,target_id)
);
create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('google')), account_email text, calendar_id text not null default 'primary',
  encrypted_refresh_token text not null, access_token_expires_at timestamptz, auto_sync boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,provider)
);
create table if not exists public.calendar_sync_states (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.calendar_connections(id) on delete cascade, sync_token text, last_synced_at timestamptz,
  oauth_state text unique, oauth_state_expires_at timestamptz, return_to text, status text not null default 'idle', error text, updated_at timestamptz not null default now(), unique(user_id,connection_id)
);
create table if not exists public.calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique, revoked_at timestamptz, created_at timestamptz not null default now(), last_accessed_at timestamptz
);

do $$ declare t text; begin foreach t in array array['profiles','planner_events','diary_entries','diary_images','diary_comments','brainstorm_boards','brainstorm_nodes','brainstorm_edges','calendar_connections','calendar_sync_states','calendar_feed_tokens'] loop execute format('alter table public.%I enable row level security',t); execute format('drop policy if exists own_data on public.%I',t); execute format('create policy own_data on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t); end loop; end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('diary-images','diary-images',false,5242880,array['image/jpeg','image/png','image/gif','image/webp']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists diary_images_owner on storage.objects;
create policy diary_images_owner on storage.objects for all to authenticated using(bucket_id='diary-images' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='diary-images' and (storage.foldername(name))[1]=(select auth.uid())::text);

alter table public.planner_events add column if not exists text_color text;
alter table public.planner_events add column if not exists background_color text;
alter table public.planner_events add column if not exists border_color text;

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  font_scale integer not null default 100 check(font_scale between 80 and 140),
  planner_density text not null default 'default' check(planner_density in ('relaxed','default','compact','custom')),
  monthly_visible_event_count integer not null default 4 check(monthly_visible_event_count between 1 and 20),
  monthly_visible_task_count integer not null default 3 check(monthly_visible_task_count between 1 and 20),
  weekly_visible_task_count integer not null default 8 check(weekly_visible_task_count between 1 and 40),
  calendar_cell_height integer not null default 138 check(calendar_cell_height between 80 and 300),
  event_card_gap integer not null default 3 check(event_card_gap between 0 and 20),
  checklist_row_height integer not null default 36 check(checklist_row_height between 20 and 80),
  event_title_max_lines integer not null default 1 check(event_title_max_lines between 1 and 3),
  memo_section_enabled boolean not null default true, memo_section_height integer not null default 58,
  collapse_completed_tasks boolean not null default false, completed_task_limit integer not null default 5,
  default_text_color text not null default '#252328', default_background_color text not null default '#fbfaf6',
  secondary_background_color text not null default '#fffefa', accent_color text not null default '#74539b',
  calendar_line_color text not null default '#6f6b6f', completed_item_color text not null default '#a54646',
  selected_item_color text not null default '#74539b', auto_contrast_enabled boolean not null default true,
  default_buffer_days integer not null default 0, default_daily_study_minutes integer not null default 180,
  default_study_weekdays integer[] not null default array[1,2,3,4,5,6,0],
  rollover_policy text not null default 'ask' check(rollover_policy in ('none','next-day','reschedule','ask')),
  keep_locked_tasks_on_reschedule boolean not null default true, recent_colors text[] not null default '{}',
  calendar_options jsonb not null default '{}'::jsonb, daily_memos jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);

create table if not exists public.study_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null, title text not null, unit_type text not null check(unit_type in ('page','problem','lecture','chapter','word','minute','hour','custom')),
  custom_unit_label text not null default '', total_amount numeric not null check(total_amount>0), completed_amount numeric not null default 0 check(completed_amount>=0 and completed_amount<=total_amount),
  start_date date not null, deadline date not null check(deadline>=start_date), priority integer not null default 3 check(priority between 1 and 5), difficulty integer not null default 3 check(difficulty between 1 and 5),
  min_daily_amount numeric check(min_daily_amount is null or min_daily_amount>=0), max_daily_amount numeric check(max_daily_amount is null or max_daily_amount>0),
  chunk_size numeric not null default 1 check(chunk_size>0), available_weekdays integer[] not null default array[1,2,3,4,5,6,0], excluded_dates date[] not null default '{}', rest_dates date[] not null default '{}',
  daily_capacity jsonb not null default '{}'::jsonb, estimated_minutes_per_unit numeric check(estimated_minutes_per_unit is null or estimated_minutes_per_unit>=0), buffer_days integer not null default 0 check(buffer_days>=0),
  text_color text not null default '#252328', background_color text not null default '#f1ebf7', border_color text not null default '#74539b', notes text not null default '',
  auto_schedule_enabled boolean not null default true, google_sync_enabled boolean not null default false, apple_feed_enabled boolean not null default true,
  status text not null default 'active' check(status in ('active','paused','completed')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.study_goals(id) on delete cascade, scheduled_date date not null, title text not null,
  start_amount numeric not null default 0 check(start_amount>=0), end_amount numeric not null default 0 check(end_amount>=0),
  planned_amount numeric not null check(planned_amount>0), completed_amount numeric not null default 0 check(completed_amount>=0 and completed_amount<=planned_amount),
  estimated_minutes numeric not null default 0 check(estimated_minutes>=0), status text not null default 'planned' check(status in ('planned','partial','completed')),
  is_locked boolean not null default false, is_auto_generated boolean not null default true, sort_order integer not null default 0,
  text_color text not null default '#252328', background_color text not null default '#f1ebf7', border_color text not null default '#74539b', notes text not null default '', completed_at timestamptz,
  external_provider text, external_calendar_id text, external_event_id text, last_synced_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create index if not exists study_goals_user_deadline_idx on public.study_goals(user_id,deadline) where deleted_at is null;
create index if not exists study_tasks_user_date_idx on public.study_tasks(user_id,scheduled_date) where deleted_at is null;
create index if not exists study_tasks_goal_date_idx on public.study_tasks(goal_id,scheduled_date) where deleted_at is null;
create unique index if not exists study_tasks_external_unique on public.study_tasks(user_id,external_provider,external_calendar_id,external_event_id) where external_event_id is not null;

alter table public.user_preferences enable row level security;
alter table public.study_goals enable row level security;
alter table public.study_tasks enable row level security;
drop policy if exists own_data on public.user_preferences;
drop policy if exists own_data on public.study_goals;
drop policy if exists own_data on public.study_tasks;
create policy own_data on public.user_preferences for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_data on public.study_goals for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_data on public.study_tasks for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

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

-- Optional fixed start time for a single study task (set by dragging it on the
-- weekly timeline, or in the task editor); blank means auto-placed.
alter table public.study_tasks
  add column if not exists start_time text;

-- Per-date diary text (opened from Monthly via Alt+7, archived in Brainstorm's
-- Diary tab) and the brainstorm canvas free-text base layer.
alter table public.user_preferences
  add column if not exists date_diaries jsonb not null default '{}'::jsonb,
  add column if not exists english_font_scale integer not null default 140;
alter table public.brainstorm_boards
  add column if not exists free_text text not null default '';

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
