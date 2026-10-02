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
alter table private.goc_rag_documents enable row level security;

create table if not exists private.goc_rag_chunks (
  document_id text not null references private.goc_rag_documents(document_id) on delete cascade,
  page integer not null check (page > 0),
  chunk_index integer not null default 0 check (chunk_index >= 0),
  content text not null,
  extraction text not null default 'text',
  reviewed boolean not null default false,
  token_count integer check (token_count is null or token_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('english'::regconfig, coalesce(content, ''::text))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (document_id, page, chunk_index)
);
alter table private.goc_rag_chunks enable row level security;
create index if not exists goc_rag_chunks_search_idx on private.goc_rag_chunks using gin(search_vector);
create index if not exists goc_rag_chunks_document_page_idx on private.goc_rag_chunks(document_id, page);

create or replace function public.goc_rag_upsert_document(p_document jsonb)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_id text := trim(coalesce(p_document->>'documentId', ''));
begin
  if v_id = '' then raise exception 'documentId is required'; end if;
  insert into private.goc_rag_documents (
    document_id, title, authority, namespace, source_hash, pages, indexed_pages, ocr_pages, metadata, updated_at
  ) values (
    v_id, left(coalesce(nullif(trim(p_document->>'title'), ''), v_id), 200),
    left(coalesce(nullif(trim(p_document->>'authority'), ''), 'setting'), 64),
    left(coalesce(nullif(trim(p_document->>'namespace'), ''), 'other'), 64),
    nullif(trim(p_document->>'sourceHash'), ''),
    greatest(coalesce((p_document->>'pages')::integer, 0), 0),
    greatest(coalesce((p_document->>'indexedPages')::integer, 0), 0),
    greatest(coalesce((p_document->>'ocrPages')::integer, 0), 0),
    coalesce(p_document->'metadata', '{}'::jsonb), now()
  ) on conflict (document_id) do update set
    title = excluded.title, authority = excluded.authority,
    namespace = excluded.namespace, source_hash = excluded.source_hash,
    pages = excluded.pages, indexed_pages = excluded.indexed_pages,
    ocr_pages = excluded.ocr_pages, metadata = excluded.metadata, updated_at = now();
  return jsonb_build_object('ok', true, 'documentId', v_id);
end;
$$;

create or replace function public.goc_rag_upsert_chunks(p_document_id text, p_chunks jsonb)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare v_count integer := 0;
begin
  if not exists (select 1 from private.goc_rag_documents where document_id = p_document_id) then
    raise exception 'RAG document does not exist';
  end if;
  if jsonb_typeof(p_chunks) <> 'array' then raise exception 'chunks must be an array'; end if;
  insert into private.goc_rag_chunks (
    document_id, page, chunk_index, content, extraction, reviewed, token_count, metadata, updated_at
  )
  select p_document_id, x.page, coalesce(x.chunk_index, 0),
    left(coalesce(x.content, ''), 25000),
    left(coalesce(nullif(x.extraction, ''), 'text'), 32),
    coalesce(x.reviewed, false), x.token_count,
    coalesce(x.metadata, '{}'::jsonb), now()
  from jsonb_to_recordset(p_chunks) as x(
    page integer, chunk_index integer, content text, extraction text,
    reviewed boolean, token_count integer, metadata jsonb
  )
  where x.page > 0 and length(trim(coalesce(x.content, ''))) > 20
  on conflict (document_id, page, chunk_index) do update set
    content = excluded.content, extraction = excluded.extraction,
    reviewed = excluded.reviewed, token_count = excluded.token_count,
    metadata = excluded.metadata, updated_at = now();
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'documentId', p_document_id, 'upserted', v_count);
end;
$$;

create or replace function public.goc_rag_search(p_query text, p_limit integer default 6)
returns jsonb
language sql
security definer
set search_path = private, public
as $$
  with tokens as (
    select distinct regexp_replace(lower(t), '[^a-z0-9''-]+', '', 'g') as token
    from regexp_split_to_table(coalesce(p_query, ''), E'\\s+') as t
    where length(t) >= 3
  ), filtered as (
    select token from tokens
    where token <> '' and token not in
      ('the','and','for','with','this','that','from','into','your','you','dmir','game','player','action','turn')
    limit 16
  ), q as (
    select case when count(*) = 0 then null::tsquery
      else to_tsquery('english', string_agg(replace(token, '''', ''), ' | ')) end as query
    from filtered
  ), ranked as (
    select c.document_id, d.title, d.authority, d.namespace,
      c.page, c.chunk_index, c.extraction, c.reviewed,
      left(c.content, 3500) as content,
      ts_rank_cd(c.search_vector, q.query) as rank,
      (case d.authority when 'saga_core' then 3.0 when 'saga_supplement' then 2.0 else 1.0 end)
        + (case when c.reviewed then 0.75 else 0 end)
        + ts_rank_cd(c.search_vector, q.query) as weighted_rank
    from private.goc_rag_chunks c
    join private.goc_rag_documents d on d.document_id = c.document_id
    cross join q
    where q.query is not null and c.search_vector @@ q.query
    order by weighted_rank desc, d.title, c.page
    limit greatest(1, least(coalesce(p_limit, 6), 12))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'documentId', document_id, 'title', title,
    'authority', authority, 'namespace', namespace,
    'page', page, 'chunkIndex', chunk_index,
    'extraction', extraction, 'reviewed', reviewed,
    'content', content, 'rank', rank
  ) order by weighted_rank desc), '[]'::jsonb)
  from ranked;
$$;

create or replace function public.goc_rag_stats()
returns jsonb
language sql
security definer
set search_path = private, public
as $$
  select jsonb_build_object(
    'documents', (select count(*) from private.goc_rag_documents),
    'chunks', (select count(*) from private.goc_rag_chunks),
    'reviewedChunks', (select count(*) from private.goc_rag_chunks where reviewed),
    'ocrChunks', (select count(*) from private.goc_rag_chunks where upper(extraction) = 'OCR')
  );
$$;

revoke all on function public.goc_rag_upsert_document(jsonb) from public, anon, authenticated;
revoke all on function public.goc_rag_upsert_chunks(text, jsonb) from public, anon, authenticated;
revoke all on function public.goc_rag_search(text, integer) from public, anon, authenticated;
revoke all on function public.goc_rag_stats() from public, anon, authenticated;
grant execute on function public.goc_rag_upsert_document(jsonb) to service_role;
grant execute on function public.goc_rag_upsert_chunks(text, jsonb) to service_role;
grant execute on function public.goc_rag_search(text, integer) to service_role;
grant execute on function public.goc_rag_stats() to service_role;
