create or replace function public.goc_reconcile_patch(
  p_account_id text,
  p_expected_revision bigint,
  p_patch jsonb,
  p_reason text default 'OOC reconciliation'
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private'
as $function$
declare
  v_save private.goc_datapad_saves%rowtype;
  v_state jsonb;
  v_new_revision bigint;
  v_keys text[] := array[]::text[];
  v_messages jsonb;
  v_last_assistant_index integer;
  v_value bigint;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a JSON object' using errcode = '22023';
  end if;

  select * into v_save
  from private.goc_datapad_saves
  where account_id = p_account_id
  for update;

  if not found then
    raise exception 'Save not found for account_id %', p_account_id using errcode = 'P0002';
  end if;

  if v_save.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'error', 'revision_conflict', 'revision', v_save.revision);
  end if;

  v_state := v_save.snapshot;

  if p_patch ? 'level' then
    v_state := jsonb_set(v_state, '{character,level}', p_patch->'level', true);
    v_keys := array_append(v_keys, 'level');
  end if;
  if p_patch ? 'experience' then
    v_state := jsonb_set(v_state, '{character,experience}', p_patch->'experience', true);
    v_keys := array_append(v_keys, 'experience');
  end if;
  if p_patch ? 'health' then
    v_state := jsonb_set(v_state, '{gameState,health}', p_patch->'health', true);
    v_keys := array_append(v_keys, 'health');
  end if;
  if p_patch ? 'credits' then
    v_state := jsonb_set(v_state, '{gameState,credits}', p_patch->'credits', true);
    v_keys := array_append(v_keys, 'credits');
  end if;
  if p_patch ? 'creditsCriminal' then
    v_state := jsonb_set(v_state, '{gameState,creditsCriminal}', p_patch->'creditsCriminal', true);
    v_keys := array_append(v_keys, 'creditsCriminal');
  end if;
  if p_patch ? 'location' then
    if jsonb_typeof(p_patch->'location') <> 'string' then
      raise exception 'location must be a string' using errcode = '22023';
    end if;
    v_state := jsonb_set(v_state, '{gameState,location}', p_patch->'location', true);
    v_keys := array_append(v_keys, 'location');
  end if;
  if p_patch ? 'inventory' then
    if jsonb_typeof(p_patch->'inventory') <> 'array' then
      raise exception 'inventory must be an array' using errcode = '22023';
    end if;
    v_state := jsonb_set(v_state, '{gameState,inventory}', p_patch->'inventory', true);
    v_keys := array_append(v_keys, 'inventory');
  end if;
  if p_patch ? 'objectives' then
    if jsonb_typeof(p_patch->'objectives') <> 'array' then
      raise exception 'objectives must be an array' using errcode = '22023';
    end if;
    v_state := jsonb_set(v_state, '{gameState,objectives}', p_patch->'objectives', true);
    v_keys := array_append(v_keys, 'objectives');
  end if;
  if p_patch ? 'combat' then
    if jsonb_typeof(p_patch->'combat') <> 'object' then
      raise exception 'combat must be an object' using errcode = '22023';
    end if;
    v_state := jsonb_set(v_state, '{gameState,combat}', p_patch->'combat', true);
    v_keys := array_append(v_keys, 'combat');
  end if;
  if p_patch ? 'conditionTrack' then
    v_state := jsonb_set(v_state, '{gameState,conditionTrack}', p_patch->'conditionTrack', true);
    v_keys := array_append(v_keys, 'conditionTrack');
  end if;
  if p_patch ? 'campaignTimeMinutes' then
    if jsonb_typeof(p_patch->'campaignTimeMinutes') <> 'number' then
      raise exception 'campaignTimeMinutes must be a nonnegative integer' using errcode = '22023';
    end if;
    v_value := (p_patch->>'campaignTimeMinutes')::bigint;
    if v_value < 0 then
      raise exception 'campaignTimeMinutes must be a nonnegative integer' using errcode = '22023';
    end if;
    v_state := jsonb_set(v_state, '{gameState,campaignTimeMinutes}', to_jsonb(v_value), true);
    v_keys := array_append(v_keys, 'campaignTimeMinutes');
  end if;
  if p_patch ? 'lastNarration' then
    if jsonb_typeof(p_patch->'lastNarration') <> 'string' then
      raise exception 'lastNarration must be a string' using errcode = '22023';
    end if;
    v_messages := coalesce(v_state->'messages', '[]'::jsonb);
    if jsonb_typeof(v_messages) <> 'array' then
      raise exception 'messages is not an array' using errcode = '22023';
    end if;
    select max(ord::integer - 1)
      into v_last_assistant_index
      from jsonb_array_elements(v_messages) with ordinality as m(elem, ord)
      where elem->>'role' = 'assistant';
    if v_last_assistant_index is null then
      v_messages := v_messages || jsonb_build_array(jsonb_build_object(
        'role', 'assistant',
        'content', p_patch->>'lastNarration',
        'administrative', true
      ));
    else
      v_messages := jsonb_set(
        v_messages,
        array[v_last_assistant_index::text, 'content'],
        to_jsonb(p_patch->>'lastNarration'),
        true
      );
    end if;
    v_state := jsonb_set(v_state, '{messages}', v_messages, true);
    v_keys := array_append(v_keys, 'lastNarration');
  end if;

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
  set snapshot = v_state,
      revision = v_new_revision,
      updated_at = now()
  where account_username = v_save.account_username;

  return jsonb_build_object(
    'ok', true,
    'revision', v_new_revision,
    'changedKeys', to_jsonb(v_keys),
    'updatedAt', now()
  );
end;
$function$;
