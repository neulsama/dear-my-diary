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
