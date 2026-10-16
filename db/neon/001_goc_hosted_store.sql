-- The production campaign is stored in these private tables.  The Next.js
-- server is the only database client; no browser-facing Data API is enabled.
-- Names and column types match the live source so its records can be copied
-- without reshaping game state or losing historical IDs and timestamps.

create schema if not exists private;

create table if not exists private.goc_datapad_saves (
  account_username text primary key,
  account_id text not null,
  revision bigint not null default 0 check (revision >= 0),
  snapshot jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- Each account has one canonical save. The source currently has no duplicate
-- account IDs; enforce that invariant at the new persistence boundary.
create unique index if not exists goc_datapad_saves_account_id_key
  on private.goc_datapad_saves(account_id);
create index if not exists goc_datapad_saves_updated_at_idx
  on private.goc_datapad_saves(updated_at desc);

create table if not exists private.goc_datapad_save_backups (
  backup_id uuid primary key default gen_random_uuid(),
  account_username text not null,
  account_id text not null,
  revision bigint not null check (revision >= 0),
  snapshot jsonb not null,
  source_updated_at timestamptz not null,
  source_created_at timestamptz not null,
  reason text not null default 'manual checkpoint',
  backed_up_at timestamptz not null default now()
);
create index if not exists goc_datapad_save_backups_account_revision_idx
  on private.goc_datapad_save_backups(account_id, revision, backed_up_at desc);

create table if not exists private.goc_datapad_configs (
  account_id text primary key,
  revision bigint not null default 0 check (revision >= 0),
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists private.goc_checkpoints (
  checkpoint_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  account_username text not null,
  label text not null,
  source_revision bigint not null check (source_revision >= 0),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists goc_checkpoints_account_created_idx
  on private.goc_checkpoints(account_id, created_at desc);

create table if not exists private.goc_web_accounts (
  id text primary key,
  username text unique not null,
  display_name text not null,
  role text not null check (role in ('admin', 'player')),
  salt text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.goc_rag_documents (
  document_id text primary key,
  title text not null,
  authority text not null default 'setting',
  namespace text not null default 'other',
  source_hash text,
  pages integer not null default 0 check (pages >= 0),
  indexed_pages integer not null default 0 check (indexed_pages >= 0),
  ocr_pages integer not null default 0 check (ocr_pages >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.goc_rag_chunks (
  document_id text not null references private.goc_rag_documents(document_id) on delete cascade,
  page integer not null check (page > 0),
  chunk_index integer not null default 0 check (chunk_index >= 0),
  content text not null,
  extraction text not null default 'text',
  reviewed boolean not null default false,
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as
    (to_tsvector('english'::regconfig, coalesce(content, ''::text))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (document_id, page, chunk_index)
);
create index if not exists goc_rag_chunks_search_idx
  on private.goc_rag_chunks using gin(search_vector);
create index if not exists goc_rag_chunks_document_page_idx
  on private.goc_rag_chunks(document_id, page);

-- No SELECT privileges are granted to a browser or anonymous role. The
-- application connects with a server-side credential and checks account
-- ownership before reading or changing any of these records.
