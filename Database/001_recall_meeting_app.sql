create extension if not exists pgcrypto;

do $$ begin
  create type public.meeting_platform as enum ('zoom', 'google_meet', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.meeting_status as enum (
    'pending',
    'scheduled',
    'bot_queued',
    'bot_joining',
    'bot_joined',
    'transcript_streaming',
    'processing_summary',
    'complete',
    'failed',
    'skipped'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google',
  account_email text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  sync_token text,
  auto_join_enabled boolean not null default true,
  auto_join_rules jsonb not null default '{"accepted_only": true, "external_attendees_only": false, "manual_approval_required": false}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_email)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_connection_id uuid references public.calendar_connections(id) on delete set null,
  external_calendar_id text,
  title text not null default 'Untitled meeting',
  description text,
  meeting_url text,
  platform public.meeting_platform not null default 'unknown',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text,
  organizer_email text,
  status public.meeting_status not null default 'pending',
  auto_join_enabled boolean not null default true,
  requires_approval boolean not null default false,
  approved_at timestamptz,
  raw_event jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_calendar_id)
);

create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  name text,
  email text,
  response_status text,
  is_organizer boolean not null default false,
  created_at timestamptz not null default now(),
  unique (meeting_id, email)
);

create table if not exists public.recall_bots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  recall_bot_id text not null unique,
  status text not null default 'created',
  bot_name text,
  join_at timestamptz,
  recording_config jsonb not null default '{}'::jsonb,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ingestion_events (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings(id) on delete cascade,
  recall_bot_id text,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (event_type, idempotency_key)
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  recall_bot_id text,
  external_segment_id text,
  speaker_name text,
  speaker_id text,
  text text not null,
  starts_at_ms integer,
  ends_at_ms integer,
  is_final boolean not null default true,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (meeting_id, external_segment_id)
);

create table if not exists public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  provider text not null,
  model text not null,
  summary_markdown text not null,
  summary_json jsonb not null,
  transcript_hash text not null,
  created_at timestamptz not null default now(),
  unique (meeting_id, transcript_hash)
);

create index if not exists meetings_user_starts_at_idx on public.meetings(user_id, starts_at);
create index if not exists meetings_status_starts_at_idx on public.meetings(status, starts_at);
create index if not exists meetings_calendar_connection_id_idx on public.meetings(calendar_connection_id);
create index if not exists recall_bots_meeting_id_idx on public.recall_bots(meeting_id);
create index if not exists transcript_segments_meeting_order_idx on public.transcript_segments(meeting_id, starts_at_ms nulls last, created_at);
create index if not exists ingestion_events_meeting_idx on public.ingestion_events(meeting_id, received_at desc);

alter table public.profiles enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.recall_bots enable row level security;
alter table public.ingestion_events enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.meeting_summaries enable row level security;

create policy "profiles self access" on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "calendar connections self access" on public.calendar_connections
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "meetings self access" on public.meetings
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "participants via meeting owner" on public.meeting_participants
  for all using (
    exists (
      select 1 from public.meetings
      where meetings.id = meeting_participants.meeting_id
      and meetings.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.meetings
      where meetings.id = meeting_participants.meeting_id
      and meetings.user_id = (select auth.uid())
    )
  );

create policy "recall bots via meeting owner" on public.recall_bots
  for select using (
    exists (
      select 1 from public.meetings
      where meetings.id = recall_bots.meeting_id
      and meetings.user_id = (select auth.uid())
    )
  );

create policy "ingestion events via meeting owner" on public.ingestion_events
  for select using (
    exists (
      select 1 from public.meetings
      where meetings.id = ingestion_events.meeting_id
      and meetings.user_id = (select auth.uid())
    )
  );

create policy "transcript segments via meeting owner" on public.transcript_segments
  for select using (
    exists (
      select 1 from public.meetings
      where meetings.id = transcript_segments.meeting_id
      and meetings.user_id = (select auth.uid())
    )
  );

create policy "summaries via meeting owner" on public.meeting_summaries
  for select using (
    exists (
      select 1 from public.meetings
      where meetings.id = meeting_summaries.meeting_id
      and meetings.user_id = (select auth.uid())
    )
  );

do $$ begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end $$;
