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
  on private.goc_checkpoints (account_id, created_at desc);

alter table private.goc_checkpoints enable row level security;
revoke all on table private.goc_checkpoints from anon, authenticated;

create or replace function public.goc_checkpoint_save(p_account_id text, p_label text default 'Manual checkpoint')
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_save private.goc_datapad_saves%rowtype;
  v_id uuid;
begin
  select * into v_save from private.goc_datapad_saves where account_id = p_account_id;
  if not found then raise exception 'Save not found for account_id %', p_account_id using errcode = 'P0002'; end if;

  insert into private.goc_checkpoints(account_id, account_username, label, source_revision, snapshot)
  values (
    v_save.account_id,
    v_save.account_username,
    coalesce(nullif(trim(p_label), ''), 'Manual checkpoint'),
    v_save.revision,
    v_save.snapshot
  )
  returning checkpoint_id into v_id;

  return jsonb_build_object(
    'ok', true,
    'checkpointId', v_id,
    'label', coalesce(nullif(trim(p_label), ''), 'Manual checkpoint'),
    'sourceRevision', v_save.revision,
    'createdAt', now()
  );
end;
$$;

create or replace function public.goc_checkpoint_list(p_account_id text)
returns jsonb
language sql
security definer
set search_path = public, private
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'checkpointId', checkpoint_id,
    'label', label,
    'sourceRevision', source_revision,
    'createdAt', created_at
  ) order by created_at desc), '[]'::jsonb)
  from (
    select checkpoint_id, label, source_revision, created_at
    from private.goc_checkpoints
    where account_id = p_account_id
    order by created_at desc
    limit 25
  ) q;
$$;

create or replace function public.goc_checkpoint_load(
  p_account_id text,
  p_checkpoint_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_save private.goc_datapad_saves%rowtype;
  v_checkpoint private.goc_checkpoints%rowtype;
  v_new_revision bigint;
begin
  select * into v_save
  from private.goc_datapad_saves
  where account_id = p_account_id
  for update;

  if not found then raise exception 'Save not found for account_id %', p_account_id using errcode = 'P0002'; end if;
  if v_save.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'error', 'revision_conflict', 'revision', v_save.revision);
  end if;

  select * into v_checkpoint
  from private.goc_checkpoints
  where checkpoint_id = p_checkpoint_id and account_id = p_account_id;
  if not found then raise exception 'Checkpoint not found' using errcode = 'P0002'; end if;

  insert into private.goc_datapad_save_backups(
    account_username, account_id, revision, snapshot, source_updated_at, source_created_at, reason
  ) values (
    v_save.account_username, v_save.account_id, v_save.revision, v_save.snapshot,
    v_save.updated_at, v_save.created_at,
    'pre_checkpoint_load:' || p_checkpoint_id::text
  );

  v_new_revision := v_save.revision + 1;
  update private.goc_datapad_saves
  set snapshot = v_checkpoint.snapshot, revision = v_new_revision, updated_at = now()
  where account_username = v_save.account_username;

  return jsonb_build_object(
    'ok', true,
    'revision', v_new_revision,
    'checkpointId', v_checkpoint.checkpoint_id,
    'label', v_checkpoint.label,
    'snapshot', v_checkpoint.snapshot,
    'updatedAt', now()
  );
end;
$$;

create or replace function public.goc_reconcile_patch(
  p_account_id text,
  p_expected_revision bigint,
  p_patch jsonb,
  p_reason text default 'OOC reconciliation'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_save private.goc_datapad_saves%rowtype;
  v_state jsonb;
  v_new_revision bigint;
  v_keys text[] := array[]::text[];
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;

  select * into v_save
  from private.goc_datapad_saves
  where account_id = p_account_id
  for update;

  if not found then raise exception 'Save not found for account_id %', p_account_id using errcode = 'P0002'; end if;
  if v_save.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'error', 'revision_conflict', 'revision', v_save.revision);
  end if;

  v_state := v_save.snapshot;

  if p_patch ? 'level' then v_state := jsonb_set(v_state, '{character,level}', p_patch->'level', true); v_keys := array_append(v_keys, 'level'); end if;
  if p_patch ? 'experience' then v_state := jsonb_set(v_state, '{character,experience}', p_patch->'experience', true); v_keys := array_append(v_keys, 'experience'); end if;
  if p_patch ? 'health' then v_state := jsonb_set(v_state, '{gameState,health}', p_patch->'health', true); v_keys := array_append(v_keys, 'health'); end if;
  if p_patch ? 'credits' then v_state := jsonb_set(v_state, '{gameState,credits}', p_patch->'credits', true); v_keys := array_append(v_keys, 'credits'); end if;
  if p_patch ? 'location' then v_state := jsonb_set(v_state, '{gameState,location}', p_patch->'location', true); v_keys := array_append(v_keys, 'location'); end if;
  if p_patch ? 'inventory' then
    if jsonb_typeof(p_patch->'inventory') <> 'array' then raise exception 'inventory must be an array' using errcode = '22023'; end if;
    v_state := jsonb_set(v_state, '{gameState,inventory}', p_patch->'inventory', true);
    v_keys := array_append(v_keys, 'inventory');
  end if;
  if p_patch ? 'combat' then
    if jsonb_typeof(p_patch->'combat') <> 'object' then raise exception 'combat must be an object' using errcode = '22023'; end if;
    v_state := jsonb_set(v_state, '{gameState,combat}', p_patch->'combat', true);
    v_keys := array_append(v_keys, 'combat');
  end if;
  if p_patch ? 'conditionTrack' then v_state := jsonb_set(v_state, '{gameState,conditionTrack}', p_patch->'conditionTrack', true); v_keys := array_append(v_keys, 'conditionTrack'); end if;

  if cardinality(v_keys) = 0 then
    raise exception 'patch contains no supported reconciliation fields' using errcode = '22023';
  end if;

  insert into private.goc_datapad_save_backups(
    account_username, account_id, revision, snapshot, source_updated_at, source_created_at, reason
  ) values (
    v_save.account_username, v_save.account_id, v_save.revision, v_save.snapshot,
    v_save.updated_at, v_save.created_at,
    'pre_reconcile:' || left(coalesce(p_reason, 'OOC reconciliation'), 180)
  );

  v_new_revision := v_save.revision + 1;
  update private.goc_datapad_saves
  set snapshot = v_state, revision = v_new_revision, updated_at = now()
  where account_username = v_save.account_username;

  return jsonb_build_object(
    'ok', true,
    'revision', v_new_revision,
    'changedKeys', to_jsonb(v_keys),
    'snapshot', v_state,
    'updatedAt', now()
  );
end;
$$;

create or replace function public.goc_hud_get(p_account_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_save private.goc_datapad_saves%rowtype;
  v_gs jsonb;
begin
  select * into v_save from private.goc_datapad_saves where account_id = p_account_id;
  if not found then raise exception 'Save not found for account_id %', p_account_id using errcode = 'P0002'; end if;

  v_gs := coalesce(v_save.snapshot->'gameState', '{}'::jsonb);
  return jsonb_build_object(
    'ok', true,
    'revision', v_save.revision,
    'updatedAt', v_save.updated_at,
    'character', coalesce(v_save.snapshot->'character', '{}'::jsonb),
    'hud', jsonb_build_object(
      'health', v_gs->'health',
      'credits', v_gs->'credits',
      'location', v_gs->'location',
      'inventory', coalesce(v_gs->'inventory', '[]'::jsonb),
      'inventoryCount', jsonb_array_length(coalesce(v_gs->'inventory', '[]'::jsonb)),
      'conditionTrack', v_gs->'conditionTrack',
      'forcePoints', v_gs->'forcePoints',
      'destinyPoints', v_gs->'destinyPoints',
      'darkSideScore', v_gs->'darkSideScore',
      'notoriety', v_gs->'notoriety',
      'combat', v_gs->'combat',
      'conditions', coalesce(v_gs->'conditions', '[]'::jsonb),
      'objectives', coalesce(v_gs->'objectives', '[]'::jsonb),
      'relationships', coalesce(v_gs->'relationships', '[]'::jsonb),
      'properties', coalesce(v_gs->'properties', '[]'::jsonb),
      'investments', coalesce(v_gs->'investments', '[]'::jsonb),
      'travelAccess', coalesce(v_gs->'travelAccess', '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.goc_checkpoint_save(text,text) from public, anon, authenticated;
revoke all on function public.goc_checkpoint_list(text) from public, anon, authenticated;
revoke all on function public.goc_checkpoint_load(text,uuid,bigint) from public, anon, authenticated;
revoke all on function public.goc_reconcile_patch(text,bigint,jsonb,text) from public, anon, authenticated;
revoke all on function public.goc_hud_get(text) from public, anon, authenticated;
grant execute on function public.goc_checkpoint_save(text,text) to service_role;
grant execute on function public.goc_checkpoint_list(text) to service_role;
grant execute on function public.goc_checkpoint_load(text,uuid,bigint) to service_role;
grant execute on function public.goc_reconcile_patch(text,bigint,jsonb,text) to service_role;
grant execute on function public.goc_hud_get(text) to service_role;
