create or replace function public.goc_bridge_upsert(
  p_username text,
  p_account_id text,
  p_expected_revision bigint,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = private, public
as $$
declare
  current_revision bigint;
  next_revision bigint;
  saved_at timestamptz := now();
  v_last_user text := '';
  v_lower text := '';
begin
  select coalesce(elem->>'content','') into v_last_user
  from jsonb_array_elements(coalesce(p_snapshot->'messages','[]'::jsonb)) with ordinality as m(elem, ord)
  where elem->>'role' = 'user'
  order by ord desc
  limit 1;

  v_lower := lower(coalesce(v_last_user,''));

  if v_lower ~ '(out[- ]of[- ]character|(^|[^a-z])ooc([^a-z]|$)|save[ ]+(game|checkpoint|state)|create[ ]+(a[ ]+)?checkpoint|load[ ]+(game|checkpoint|state)|restore[ ]+(a[ ]+)?checkpoint|reconcil(e|iation)|sync[ ]+(state|save)|set[ ]+and[ ]+persist|authoritative[ ]+save|hud)' then
    return jsonb_build_object(
      'ok', false,
      'error', 'control_command_requires_control_action',
      'message', 'Save/load/HUD/reconciliation requests are control operations and cannot be persisted through the gameplay turn writer.',
      'useOperation', case
        when v_lower ~ '(load[ ]+(game|checkpoint|state)|restore[ ]+(a[ ]+)?checkpoint)' then 'loadCheckpoint'
        when v_lower ~ '(save[ ]+(game|checkpoint|state)|create[ ]+(a[ ]+)?checkpoint)' then 'saveCheckpoint'
        when v_lower ~ 'hud' then 'getCampaignHUD'
        else 'reconcileCampaignState'
      end,
      'revision', coalesce((select revision from private.goc_datapad_saves where account_username = p_username), 0)
    );
  end if;

  select revision into current_revision
  from private.goc_datapad_saves
  where account_username = p_username
  for update;

  if current_revision is null then
    if p_expected_revision <> 0 then
      return jsonb_build_object('ok',false,'error','revision_conflict','revision',0);
    end if;
    next_revision := 1;
    insert into private.goc_datapad_saves(account_username,account_id,revision,snapshot,updated_at)
    values(p_username,p_account_id,next_revision,p_snapshot,saved_at);
  else
    if current_revision <> p_expected_revision then
      return jsonb_build_object('ok',false,'error','revision_conflict','revision',current_revision);
    end if;
    next_revision := current_revision + 1;
    update private.goc_datapad_saves
      set account_id=p_account_id, revision=next_revision, snapshot=p_snapshot, updated_at=saved_at
      where account_username=p_username;
  end if;

  return jsonb_build_object(
    'ok',true,
    'account_username',p_username,
    'account_id',p_account_id,
    'revision',next_revision,
    'snapshot',p_snapshot,
    'updated_at',saved_at
  );
end;
$$;

revoke all on function public.goc_bridge_upsert(text,text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.goc_bridge_upsert(text,text,bigint,jsonb) to service_role;
