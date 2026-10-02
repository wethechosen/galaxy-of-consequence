create table if not exists private.goc_web_accounts (
  id text primary key,
  username text unique not null,
  display_name text not null,
  role text not null check (role in ('admin','player')),
  salt text not null,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.goc_bridge_auth_account(p_username text)
returns jsonb
language sql
security definer
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', id,
    'username', username,
    'displayName', display_name,
    'role', role,
    'salt', salt,
    'hash', password_hash
  )
  from private.goc_web_accounts
  where lower(username) = lower(trim(p_username))
  limit 1;
$$;

create or replace function public.goc_bridge_auth_accounts()
returns jsonb
language sql
security definer
set search_path = public, private
as $$  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'username', username,
    'displayName', display_name,
    'role', role
  ) order by username), '[]'::jsonb)
  from private.goc_web_accounts;
$$;

create or replace function public.goc_bridge_get(p_username text)
returns jsonb
language sql
security definer
set search_path = private, public
as $$
  select coalesce(
    (select jsonb_build_object(
      'account_username', s.account_username,
      'account_id', s.account_id,
      'revision', s.revision,
      'snapshot', s.snapshot,
      'updated_at', s.updated_at,
      'auth', case when a.id is not null then jsonb_build_object(
        'id', a.id,
        'username', a.username,
        'displayName', a.display_name,
        'role', a.role,
        'salt', a.salt,
        'hash', a.password_hash
      ) else null end
    )    from private.goc_datapad_saves s
    left join private.goc_web_accounts a on lower(a.username) = lower(s.account_username)
    where lower(s.account_username) = lower(trim(p_username))
    limit 1),
    '{}'::jsonb
  );
$$;

revoke all on function public.goc_bridge_auth_account(text) from public, anon, authenticated;
revoke all on function public.goc_bridge_auth_accounts() from public, anon, authenticated;
revoke all on function public.goc_bridge_get(text) from public, anon, authenticated;
grant execute on function public.goc_bridge_auth_account(text) to service_role;
grant execute on function public.goc_bridge_auth_accounts() to service_role;
grant execute on function public.goc_bridge_get(text) to service_role;

-- Password verifiers are seeded operationally from the existing local account store.
-- Never commit salts/hashes or plaintext credentials to the repository.
