-- Galaxy of Consequence production persistence schema.
-- Apply this to a private PostgreSQL database before replacing the demo store.

create table if not exists app_user (
  id uuid primary key,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists campaign (
  id uuid primary key,
  owner_id uuid not null references app_user(id),
  title text not null,
  era text not null check (era = '200 ABY'),
  continuity text not null check (continuity = 'Legends-first'),
  current_location text not null,
  current_scene text not null,
  rules_status text not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaign_event (
  id uuid primary key,
  campaign_id uuid not null references campaign(id) on delete cascade,
  kind text not null,
  summary text not null,
  player_visible boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists campaign_checkpoint (
  id uuid primary key,
  campaign_id uuid not null references campaign(id) on delete cascade,
  label text not null,
  branch_state jsonb not null,
  event_count integer not null,
  created_at timestamptz not null default now()
);

create table if not exists lore_fact (
  id uuid primary key,
  campaign_id uuid references campaign(id) on delete cascade,
  label text not null,
  classification text not null check (classification in ('established_lore', 'compatible_adaptation', 'campaign_event')),
  source_citation text not null,
  verified boolean not null default false,
  player_visible boolean not null default true,
  detail text not null,
  created_at timestamptz not null default now()
);

create index if not exists campaign_event_timeline on campaign_event (campaign_id, created_at desc);
create index if not exists lore_fact_campaign on lore_fact (campaign_id, classification);
