create extension if not exists pgcrypto;

create type public.campaign_role as enum ('gm', 'player', 'observer');
create type public.ledger_currency as enum ('galactic', 'underworld');
create type public.trade_kind as enum ('purchase', 'sale');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 120),
  era text not null default '155 ABY',
  directive text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.campaign_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  species text not null default 'Human',
  level integer not null default 1 check (level between 1 and 20),
  experience integer not null default 0 check (experience >= 0),
  dossier jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create table public.campaign_state (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  revision bigint not null default 0 check (revision >= 0),
  state jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.turns (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'roll', 'system')),
  content text not null check (char_length(content) <= 24000),
  provider text,
  state_delta jsonb,
  created_at timestamptz not null default now()
);

create table public.dice_rolls (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  turn_id uuid references public.turns(id) on delete set null,
  die integer not null check (die between 1 and 20),
  modifier integer not null default 0 check (modifier between -50 and 100),
  total integer generated always as (die + modifier) stored,
  target integer check (target between 1 and 100),
  target_visible boolean not null default true,
  success boolean not null,
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.locations (
  id text primary key check (id ~ '^[a-z0-9-]{1,80}$'),
  name text not null,
  region text not null,
  era text not null default '155 ABY',
  public_route boolean not null default false,
  base_fare integer not null default 0 check (base_fare >= 0),
  minimum_level integer not null default 1 check (minimum_level between 1 and 20),
  access_policy jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table public.travel_clearances (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  granted_by uuid references auth.users(id) on delete set null,
  reason text not null,
  granted_at timestamptz not null default now(),
  primary key (campaign_id, character_id, location_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind public.trade_kind not null,
  item_id text not null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  amount integer not null check (amount >= 0),
  currency public.ledger_currency not null default 'galactic',
  location_id text references public.locations(id) on delete set null,
  committed_state_revision bigint not null check (committed_state_revision >= 0),
  created_at timestamptz not null default now()
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  headline text not null check (char_length(headline) between 1 and 240),
  facts text not null check (char_length(facts) between 1 and 4000),
  location text not null,
  source text not null,
  public boolean not null default true,
  created_at timestamptz not null default now()
);

create index campaign_members_user_idx on public.campaign_members (user_id, campaign_id);
create index characters_campaign_idx on public.characters (campaign_id);
create index turns_campaign_created_idx on public.turns (campaign_id, created_at);
create index dice_rolls_campaign_created_idx on public.dice_rolls (campaign_id, created_at);
create index transactions_campaign_created_idx on public.transactions (campaign_id, created_at);
create index news_items_campaign_created_idx on public.news_items (campaign_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
alter table public.campaign_state enable row level security;
alter table public.turns enable row level security;
alter table public.dice_rolls enable row level security;
alter table public.locations enable row level security;
alter table public.travel_clearances enable row level security;
alter table public.transactions enable row level security;
alter table public.news_items enable row level security;

create policy "profiles read own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles update own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "campaigns visible to owner" on public.campaigns for select to authenticated using ((select auth.uid()) = owner_id);
create policy "campaigns visible to members" on public.campaigns for select to authenticated
  using (exists (select 1 from public.campaign_members m where m.campaign_id = campaigns.id and m.user_id = (select auth.uid())));
create policy "campaigns created by owner" on public.campaigns for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "campaigns updated by owner" on public.campaigns for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "campaigns deleted by owner" on public.campaigns for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "members read own membership" on public.campaign_members for select to authenticated using ((select auth.uid()) = user_id);
create policy "members managed by campaign owner" on public.campaign_members for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "characters read own" on public.characters for select to authenticated using ((select auth.uid()) = user_id);
create policy "characters create own" on public.characters for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "characters update own" on public.characters for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "gm manages characters" on public.characters for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "members read campaign state" on public.campaign_state for select to authenticated
  using (exists (select 1 from public.campaign_members m where m.campaign_id = campaign_state.campaign_id and m.user_id = (select auth.uid())));
create policy "gm writes campaign state" on public.campaign_state for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "members read turns" on public.turns for select to authenticated
  using (exists (select 1 from public.campaign_members m where m.campaign_id = turns.campaign_id and m.user_id = (select auth.uid())));
create policy "players create own turns" on public.turns for insert to authenticated
  with check (actor_id = (select auth.uid()) and exists (select 1 from public.campaign_members m where m.campaign_id = turns.campaign_id and m.user_id = (select auth.uid())));
create policy "gm manages turns" on public.turns for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "members read dice" on public.dice_rolls for select to authenticated
  using (exists (select 1 from public.campaign_members m where m.campaign_id = dice_rolls.campaign_id and m.user_id = (select auth.uid())));
create policy "gm writes dice" on public.dice_rolls for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "authenticated read locations" on public.locations for select to authenticated using (active = true);
create policy "app admins manage locations" on public.locations for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

create policy "members read clearances" on public.travel_clearances for select to authenticated
  using (exists (select 1 from public.campaign_members m where m.campaign_id = travel_clearances.campaign_id and m.user_id = (select auth.uid())));
create policy "gm manages clearances" on public.travel_clearances for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "members read transactions" on public.transactions for select to authenticated
  using (exists (select 1 from public.campaign_members m where m.campaign_id = transactions.campaign_id and m.user_id = (select auth.uid())));
create policy "gm writes transactions" on public.transactions for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

create policy "members read public news" on public.news_items for select to authenticated
  using (public and exists (select 1 from public.campaign_members m where m.campaign_id = news_items.campaign_id and m.user_id = (select auth.uid())));
create policy "gm manages news" on public.news_items for all to authenticated
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.owner_id = (select auth.uid())));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.campaigns, public.campaign_members, public.characters, public.campaign_state, public.turns, public.dice_rolls, public.locations, public.travel_clearances, public.transactions, public.news_items to authenticated;
revoke all on public.profiles, public.campaigns, public.campaign_members, public.characters, public.campaign_state, public.turns, public.dice_rolls, public.locations, public.travel_clearances, public.transactions, public.news_items from anon;
