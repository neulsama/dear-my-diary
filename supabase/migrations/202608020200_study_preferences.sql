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
