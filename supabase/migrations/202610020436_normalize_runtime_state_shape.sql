create or replace function public.goc_normalize_state_shape(
  p_account_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private'
as $function$
declare
  v_save private.goc_datapad_saves%rowtype;
  v_state jsonb;
  v_gs jsonb;
  v_combat jsonb;
  v_combatants jsonb;
  v_new_revision bigint;
  v_changed boolean := false;
  k text;
  arr_keys text[] := array[
    'flags','rolls','ships','contacts','decisions','inventory','conditions',
    'objectives','properties','publicNews','turnEvents','discoveries','investments',
    'travelAccess','relationships','milestones','storyDirectives','creatorCanon',
    'legacyAssets','campaignExceptions'
  ];
  combat_arr_keys text[] := array[
    'events','log','turnOrder','initiative','pendingActions','effects'
  ];
begin
  select * into v_save
  from private.goc_datapad_saves
  where account_id = p_account_id
  for update;

  if not found then
    raise exception 'Save not found for account_id %', p_account_id using errcode = 'P0002';
  end if;

  if v_save.revision <> p_expected_revision then
    return jsonb_build_object('ok',false,'error','revision_conflict','revision',v_save.revision);
  end if;

  v_state := coalesce(v_save.snapshot, '{}'::jsonb);

  if jsonb_typeof(v_state->'messages') is distinct from 'array' then
    v_state := jsonb_set(v_state, '{messages}', '[]'::jsonb, true);
    v_changed := true;
  end if;
  if jsonb_typeof(v_state->'comms') is distinct from 'array' then
    v_state := jsonb_set(v_state, '{comms}', '[]'::jsonb, true);
    v_changed := true;
  end if;

  if jsonb_typeof(v_state->'gameState') is distinct from 'object' then
    v_state := jsonb_set(v_state, '{gameState}', '{}'::jsonb, true);
    v_changed := true;
  end if;
  v_gs := v_state->'gameState';

  foreach k in array arr_keys loop
    if jsonb_typeof(v_gs->k) is distinct from 'array' then
      v_gs := jsonb_set(v_gs, array[k], '[]'::jsonb, true);
      v_changed := true;
    end if;
  end loop;

  if jsonb_typeof(v_gs->'combat') is distinct from 'object' then
    v_gs := jsonb_set(
      v_gs,
      '{combat}',
      jsonb_build_object(
        'status','inactive',
        'round',0,
        'activeSide','player',
        'combatants','[]'::jsonb,
        'playerActions',jsonb_build_object('standard',1,'move',1,'swift',1)
      ),
      true
    );
    v_changed := true;
  end if;
  v_combat := v_gs->'combat';

  if jsonb_typeof(v_combat->'combatants') is distinct from 'array' then
    v_combat := jsonb_set(v_combat, '{combatants}', '[]'::jsonb, true);
    v_changed := true;
  end if;
  if jsonb_typeof(v_combat->'playerActions') is distinct from 'object' then
    v_combat := jsonb_set(
      v_combat,
      '{playerActions}',
      jsonb_build_object('standard',1,'move',1,'swift',1),
      true
    );
    v_changed := true;
  end if;

  foreach k in array combat_arr_keys loop
    if jsonb_typeof(v_combat->k) is distinct from 'array' then
      v_combat := jsonb_set(v_combat, array[k], '[]'::jsonb, true);
      v_changed := true;
    end if;
  end loop;

  select coalesce(
    jsonb_agg(
      case when jsonb_typeof(elem)='object' then
        elem
        || case when jsonb_typeof(elem->'conditions')='array' then '{}'::jsonb else jsonb_build_object('conditions','[]'::jsonb) end
        || case when jsonb_typeof(elem->'effects')='array' then '{}'::jsonb else jsonb_build_object('effects','[]'::jsonb) end
      else elem end
    ),
    '[]'::jsonb
  )
  into v_combatants
  from jsonb_array_elements(coalesce(v_combat->'combatants','[]'::jsonb)) elem;

  if v_combatants is distinct from coalesce(v_combat->'combatants','[]'::jsonb) then
    v_combat := jsonb_set(v_combat, '{combatants}', v_combatants, true);
    v_changed := true;
  end if;

  v_gs := jsonb_set(v_gs, '{combat}', v_combat, true);
  v_state := jsonb_set(v_state, '{gameState}', v_gs, true);

  if not v_changed then
    return jsonb_build_object(
      'ok',true,
      'changed',false,
      'revision',v_save.revision,
      'snapshot',v_state
    );
  end if;

  insert into private.goc_datapad_save_backups(
    account_username,account_id,revision,snapshot,
    source_updated_at,source_created_at,reason
  )
  values(
    v_save.account_username,v_save.account_id,v_save.revision,v_save.snapshot,
    v_save.updated_at,v_save.created_at,'pre_runtime_state_shape_normalization'
  );

  v_new_revision := v_save.revision + 1;
  update private.goc_datapad_saves
  set snapshot=v_state, revision=v_new_revision, updated_at=now()
  where account_username=v_save.account_username;

  return jsonb_build_object(
    'ok',true,
    'changed',true,
    'revision',v_new_revision,
    'snapshot',v_state
  );
end;
$function$;

revoke all on function public.goc_normalize_state_shape(text,bigint) from public;
revoke all on function public.goc_normalize_state_shape(text,bigint) from anon;
revoke all on function public.goc_normalize_state_shape(text,bigint) from authenticated;
grant execute on function public.goc_normalize_state_shape(text,bigint) to service_role;
