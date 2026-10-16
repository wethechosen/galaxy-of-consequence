-- One shared production budget across keys, roles, users and server workers.
create table if not exists private.goc_provider_budget (
  scope text primary key,
  next_slot_ms bigint not null default 0,
  cooldown_ms bigint not null default 0
);
