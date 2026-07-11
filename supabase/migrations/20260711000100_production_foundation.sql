-- Nook production foundation. Supabase Postgres is the system of record.
-- Safe to re-run in a disposable/local database; seed rows use fixed IDs.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create or replace function private.reject_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Permit referential actions during an account/parent deletion, but reject direct mutation.
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end;
$$;
revoke all on function private.reject_mutation() from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text,
  display_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free','pro','creator')),
  onboarding_state text not null default 'new' check (onboarding_state in ('new','active','complete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (handle is null or handle ~ '^[a-z0-9_]{3,30}$')
);
create unique index if not exists profiles_handle_lower_uidx on public.profiles(lower(handle)) where handle is not null;

create table if not exists public.nooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  base_species text not null default 'orbit-v1',
  working_style text not null default 'calm' check (working_style in ('calm','quick','curious')),
  status text not null default 'ready' check (status in ('ready','busy','paused','archived')),
  memory_policy text not null default 'ask' check (memory_policy in ('off','ask','on')),
  appearance_version integer not null default 0 check (appearance_version >= 0),
  active_appearance_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);
create index if not exists nooks_owner_idx on public.nooks(owner_id, created_at desc);

create table if not exists public.appearance_versions (
  id uuid primary key default gen_random_uuid(),
  nook_id uuid not null references public.nooks(id) on delete cascade,
  version integer not null check (version > 0),
  rig_version text not null default 'nook-rig@1',
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  face_glow text not null check (face_glow ~ '^#[0-9A-Fa-f]{6}$'),
  outfit_id text,
  accessory_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(accessory_ids) = 'array'),
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  unique(nook_id, version),
  unique(id, nook_id)
);
create index if not exists appearance_versions_nook_idx on public.appearance_versions(nook_id, version desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'nooks_active_appearance_fk') then
    alter table public.nooks add constraint nooks_active_appearance_fk
      foreign key(active_appearance_id, id) references public.appearance_versions(id, nook_id) deferrable initially deferred;
  end if;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nook_id uuid not null references public.nooks(id) on delete cascade,
  input text not null check (char_length(input) between 1 and 12000),
  source text not null default 'web',
  status text not null default 'draft' check (status in ('draft','planning','policy_review','ready','running','awaiting_approval','retry_wait','completed','blocked','cancelled','failed','expired')),
  risk_class smallint not null default 0 check (risk_class between 0 and 3),
  plan jsonb check (plan is null or jsonb_typeof(plan) = 'object'),
  current_step_id uuid,
  workflow_instance_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id, owner_id)
);
create index if not exists tasks_owner_status_idx on public.tasks(owner_id, status, created_at desc);
create index if not exists tasks_nook_idx on public.tasks(nook_id, created_at desc);

create table if not exists public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  ordinal integer not null check (ordinal >= 0),
  title text not null check (char_length(title) between 1 and 160),
  detail text not null default '',
  kind text not null check (kind in ('explain','research','draft','open_link','api_call','desktop_action','external_effect')),
  status text not null default 'queued' check (status in ('queued','running','awaiting_approval','approved','rejected','dispatching','verifying','retry_wait','succeeded','blocked','cancelled','failed','expired')),
  requires_approval boolean not null default false,
  action_id text,
  action_hash text check (action_hash is null or char_length(action_hash) between 32 and 256),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(task_id, ordinal),
  unique(id, task_id)
);
create index if not exists task_steps_task_idx on public.task_steps(task_id, ordinal);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_current_step_fk') then
    alter table public.tasks add constraint tasks_current_step_fk
      foreign key(current_step_id, id) references public.task_steps(id, task_id) deferrable initially deferred;
  end if;
end $$;

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  step_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  action_id text,
  action_hash text not null check (char_length(action_hash) between 32 and 256),
  risk_class smallint not null default 0 check (risk_class between 0 and 3),
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  decision text check (decision is null or decision in ('approve','reject')),
  intent jsonb not null default '{}'::jsonb check (jsonb_typeof(intent) = 'object'),
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint approvals_step_task_fk foreign key(step_id, task_id) references public.task_steps(id, task_id) on delete cascade,
  check ((status = 'pending' and decision is null and decided_at is null) or status <> 'pending')
);
create index if not exists approvals_owner_pending_idx on public.approvals(owner_id, status, expires_at);
create unique index if not exists approvals_one_pending_step_uidx on public.approvals(step_id) where status = 'pending';

create table if not exists public.action_receipts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  step_id uuid,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  stage text not null check (stage in ('plan','approval','execution','rollback','system','simulated')),
  status text not null default 'recorded' check (status in ('recorded','confirmed','rejected','succeeded','failed')),
  event_type text not null check (char_length(event_type) between 1 and 100),
  summary text not null check (char_length(summary) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint action_receipts_step_task_fk foreign key(step_id, task_id) references public.task_steps(id, task_id)
);
create index if not exists action_receipts_task_idx on public.action_receipts(task_id, created_at);
create index if not exists action_receipts_owner_idx on public.action_receipts(owner_id, created_at desc);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  platform text not null default 'windows' check (platform in ('windows','macos','linux','browser')),
  status text not null default 'active' check (status in ('active','offline','revoked')),
  last_seen_at timestamptz,
  public_key text not null check (char_length(public_key) between 32 and 8192),
  token_hash text not null check (char_length(token_hash) between 32 and 512),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, public_key)
);
create index if not exists devices_owner_status_idx on public.devices(owner_id, status, last_seen_at desc);

create table if not exists public.device_pairings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null unique check (char_length(code_hash) between 32 and 512),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index if not exists device_pairings_owner_idx on public.device_pairings(owner_id, created_at desc);

create table if not exists public.capability_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nook_id uuid references public.nooks(id) on delete cascade,
  device_id uuid references public.devices(id) on delete cascade,
  capability text not null check (char_length(capability) between 1 and 100),
  scope jsonb not null default '{}'::jsonb check (jsonb_typeof(scope) = 'object'),
  status text not null default 'active' check (status in ('active','suspended','revoked','expired')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (nook_id is not null or device_id is not null)
);
create index if not exists capability_grants_owner_idx on public.capability_grants(owner_id, status);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  storage_key text not null unique,
  public_url text,
  content_hash text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  visibility text not null default 'private' check (visibility in ('private','public')),
  moderation_status text not null default 'quarantine' check (moderation_status in ('quarantine','processing','approved','rejected')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists assets_owner_idx on public.assets(owner_id, created_at desc);
create index if not exists assets_public_idx on public.assets(moderation_status, visibility) where visibility = 'public';

create table if not exists public.creator_profiles (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  bio text not null default '',
  status text not null default 'draft' check (status in ('draft','pending','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creator_profiles(owner_id) on delete restrict,
  owner_kind text not null default 'creator' check (owner_kind in ('platform','creator')),
  kind text not null check (kind in ('companion','cosmetic','skill')),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft','review','published','archived','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((owner_kind = 'platform' and creator_id is null) or (owner_kind = 'creator' and creator_id is not null))
);
create index if not exists products_creator_idx on public.products(creator_id, status);
create index if not exists products_catalog_idx on public.products(kind, status, created_at desc);

create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  version integer not null check (version > 0),
  manifest jsonb not null default '{}'::jsonb check (jsonb_typeof(manifest) = 'object'),
  compatibility jsonb not null default '{}'::jsonb check (jsonb_typeof(compatibility) = 'object'),
  primary_asset_id uuid references public.assets(id) on delete restrict,
  preview_asset_id uuid references public.assets(id) on delete set null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique(product_id, version)
);
create index if not exists product_versions_product_idx on public.product_versions(product_id, version desc);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  product_version_id uuid not null unique references public.product_versions(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','review','published','paused','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);
create index if not exists listings_status_idx on public.listings(status, published_at desc);

create table if not exists public.prices (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_amount bigint not null check (unit_amount >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists prices_one_active_currency_uidx on public.prices(listing_id, currency) where active;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','paid','partially_refunded','refunded','disputed','cancelled','failed')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_amount bigint not null default 0 check (subtotal_amount >= 0),
  total_amount bigint not null default 0 check (total_amount >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_owner_idx on public.orders(owner_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_version_id uuid not null references public.product_versions(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  title_snapshot text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_amount bigint not null check (unit_amount >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_version_id uuid not null references public.product_versions(id) on delete restrict,
  source_order_item_id uuid references public.order_items(id) on delete restrict,
  grant_key text not null unique,
  status text not null default 'active' check (status in ('active','suspended','revoked','expired')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz
);
create index if not exists entitlements_owner_idx on public.entitlements(owner_id, status, granted_at desc);

create table if not exists public.nook_loadout (
  nook_id uuid not null references public.nooks(id) on delete cascade,
  slot text not null check (char_length(slot) between 1 and 50),
  entitlement_id uuid not null references public.entitlements(id) on delete restrict,
  equipped_at timestamptz not null default now(),
  primary key(nook_id, slot)
);

create table if not exists public.integration_connection_summaries (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  account_email text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  last_used_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(owner_id, provider)
);

create table if not exists private.integration_connections (
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  refresh_token_ciphertext text,
  refresh_token_iv text,
  key_version integer not null check (key_version > 0),
  status text not null default 'active' check (status in ('active','expired','revoked','error')),
  access_token_expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id, provider),
  unique(provider, provider_subject)
);

create table if not exists private.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  provider text not null default 'stripe',
  provider_session_id text not null unique,
  idempotency_key text not null unique,
  status text not null default 'created',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists private.payment_records (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null default 'stripe',
  provider_payment_id text not null,
  status text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_payment_id)
);

create table if not exists private.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received','processing','processed','failed','ignored')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);
create index if not exists webhook_inbox_pending_idx on private.webhook_inbox(status, received_at) where status in ('received','failed');

create table if not exists private.security_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  actor_type text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists security_events_owner_idx on private.security_events(owner_id, occurred_at desc);
create index if not exists security_events_severity_idx on private.security_events(severity, occurred_at desc);

-- Standard timestamp triggers.
do $$ declare t text; begin
  foreach t in array array['profiles','nooks','tasks','task_steps','devices','capability_grants','creator_profiles','products','listings','orders','integration_connection_summaries'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function private.touch_updated_at()', t || '_touch_updated_at', t);
  end loop;
  foreach t in array array['integration_connections','payment_sessions','payment_records','webhook_inbox'] loop
    execute format('drop trigger if exists %I on private.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on private.%I for each row execute function private.touch_updated_at()', t || '_touch_updated_at', t);
  end loop;
end $$;

drop trigger if exists action_receipts_append_only on public.action_receipts;
create trigger action_receipts_append_only before update or delete on public.action_receipts for each row execute function private.reject_mutation();
drop trigger if exists product_versions_append_only on public.product_versions;
create trigger product_versions_append_only before update or delete on public.product_versions for each row execute function private.reject_mutation();
drop trigger if exists order_items_append_only on public.order_items;
create trigger order_items_append_only before update or delete on public.order_items for each row execute function private.reject_mutation();
drop trigger if exists security_events_append_only on private.security_events;
create trigger security_events_append_only before update or delete on private.security_events for each row execute function private.reject_mutation();

-- Create a profile without trusting user-editable metadata for authorization.
create or replace function private.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values(new.id) on conflict(id) do nothing; return new; end;
$$;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists nook_create_profile on auth.users;
create trigger nook_create_profile after insert on auth.users for each row execute function private.handle_new_auth_user();
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;

-- RLS is mandatory for every Data API table.
do $$ declare t text; begin
  foreach t in array array[
    'profiles','nooks','appearance_versions','tasks','task_steps','approvals','action_receipts',
    'devices','device_pairings','capability_grants','assets','creator_profiles','products',
    'product_versions','listings','prices','orders','order_items','entitlements','nook_loadout',
    'integration_connection_summaries'
  ] loop execute format('alter table public.%I enable row level security', t); end loop;
  foreach t in array array['integration_connections','payment_sessions','payment_records','webhook_inbox','security_events'] loop
    execute format('alter table private.%I enable row level security', t);
  end loop;
end $$;

-- Reset grants before assigning the least privilege needed by browser clients.
revoke all on all tables in schema private from public, anon, authenticated;
grant all on all tables in schema private to service_role;
do $$ declare t text; begin
  foreach t in array array[
    'profiles','nooks','appearance_versions','tasks','task_steps','approvals','action_receipts',
    'devices','device_pairings','capability_grants','assets','creator_profiles','products',
    'product_versions','listings','prices','orders','order_items','entitlements','nook_loadout',
    'integration_connection_summaries'
  ] loop
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant select on public.profiles, public.nooks, public.appearance_versions, public.tasks, public.task_steps,
  public.approvals, public.action_receipts, public.device_pairings, public.capability_grants,
  public.assets, public.creator_profiles, public.products, public.product_versions, public.listings, public.prices,
  public.orders, public.order_items, public.entitlements, public.nook_loadout,
  public.integration_connection_summaries to authenticated;
grant select on public.assets, public.products, public.product_versions, public.listings, public.prices to anon;
grant select(id,owner_id,name,platform,status,last_seen_at,public_key,revoked_at,created_at,updated_at) on public.devices to authenticated;
grant update(status,revoked_at) on public.devices to authenticated;
grant insert(id,display_name,avatar_url,onboarding_state), update(handle,display_name,avatar_url,onboarding_state) on public.profiles to authenticated;
grant insert(owner_id,name,base_species,working_style,memory_policy), update(name,working_style,memory_policy,appearance_version,active_appearance_id), delete on public.nooks to authenticated;
grant insert(nook_id,version,rig_version,primary_color,secondary_color,face_glow,outfit_id,accessory_ids,configuration) on public.appearance_versions to authenticated;
grant insert(id,owner_id,nook_id,input,source,status,risk_class,plan,current_step_id) on public.tasks to authenticated;
grant insert(task_id,ordinal,title,detail,kind,status,requires_approval,action_id,action_hash) on public.task_steps to authenticated;
grant insert(task_id,step_id,owner_id,action_id,action_hash,risk_class,status,intent,expires_at) on public.approvals to authenticated;
grant insert(owner_id,code_hash,expires_at) on public.device_pairings to authenticated;
grant insert(creator_id,kind,slug,name,description), update(slug,name,description), delete on public.products to authenticated;
grant insert(product_id,version,manifest,compatibility,primary_asset_id,preview_asset_id,content_hash) on public.product_versions to authenticated;
grant insert(nook_id,slot,entitlement_id), update(entitlement_id,equipped_at), delete on public.nook_loadout to authenticated;

-- Owner policies.
drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists nooks_owner_all on public.nooks;
create policy nooks_owner_all on public.nooks for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists appearance_owner_select on public.appearance_versions;
create policy appearance_owner_select on public.appearance_versions for select to authenticated using (exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid())));
drop policy if exists appearance_owner_insert on public.appearance_versions;
create policy appearance_owner_insert on public.appearance_versions for insert to authenticated with check (exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid())));

drop policy if exists tasks_owner_select on public.tasks;
create policy tasks_owner_select on public.tasks for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists tasks_owner_insert on public.tasks;
create policy tasks_owner_insert on public.tasks for insert to authenticated with check (
  (select auth.uid()) = owner_id and status in ('planned','ready','awaiting_approval','blocked') and
  exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid()))
);
drop policy if exists task_steps_owner_select on public.task_steps;
create policy task_steps_owner_select on public.task_steps for select to authenticated using (exists(select 1 from public.tasks t where t.id=task_id and t.owner_id=(select auth.uid())));
drop policy if exists task_steps_owner_insert on public.task_steps;
create policy task_steps_owner_insert on public.task_steps for insert to authenticated with check (
  status in ('pending','queued','ready','awaiting_approval') and exists(select 1 from public.tasks t where t.id=task_id and t.owner_id=(select auth.uid()))
);
drop policy if exists approvals_owner_select on public.approvals;
create policy approvals_owner_select on public.approvals for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists approvals_owner_insert on public.approvals;
create policy approvals_owner_insert on public.approvals for insert to authenticated with check (
  (select auth.uid()) = owner_id and status='pending' and decision is null and
  exists(select 1 from public.tasks t where t.id=task_id and t.owner_id=(select auth.uid()))
);
drop policy if exists receipts_owner_select on public.action_receipts;
create policy receipts_owner_select on public.action_receipts for select to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists devices_owner_select on public.devices;
create policy devices_owner_select on public.devices for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists devices_owner_revoke on public.devices;
create policy devices_owner_revoke on public.devices for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id and status='revoked' and revoked_at is not null);
drop policy if exists pairings_owner_select on public.device_pairings;
create policy pairings_owner_select on public.device_pairings for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists pairings_owner_insert on public.device_pairings;
create policy pairings_owner_insert on public.device_pairings for insert to authenticated with check ((select auth.uid()) = owner_id and consumed_at is null);
drop policy if exists grants_owner_select on public.capability_grants;
create policy grants_owner_select on public.capability_grants for select to authenticated using ((select auth.uid()) = owner_id);
drop policy if exists integration_summaries_owner_select on public.integration_connection_summaries;
create policy integration_summaries_owner_select on public.integration_connection_summaries for select to authenticated using ((select auth.uid()) = owner_id);

-- Creator and public catalog policies.
drop policy if exists assets_owner_or_public_select on public.assets;
create policy assets_owner_or_public_select on public.assets for select to anon, authenticated using ((owner_id=(select auth.uid())) or (visibility='public' and moderation_status='approved'));
drop policy if exists creators_self_or_approved_select on public.creator_profiles;
create policy creators_self_or_approved_select on public.creator_profiles for select to authenticated using (owner_id=(select auth.uid()) or status='approved');
drop policy if exists products_public_or_owner_select on public.products;
create policy products_public_or_owner_select on public.products for select to anon, authenticated using (status='published' or creator_id=(select auth.uid()));
drop policy if exists products_creator_insert on public.products;
create policy products_creator_insert on public.products for insert to authenticated with check (creator_id=(select auth.uid()) and owner_kind='creator' and status='draft');
drop policy if exists products_creator_update on public.products;
create policy products_creator_update on public.products for update to authenticated using (creator_id=(select auth.uid()) and status='draft') with check (creator_id=(select auth.uid()) and owner_kind='creator' and status='draft');
drop policy if exists products_creator_delete on public.products;
create policy products_creator_delete on public.products for delete to authenticated using (creator_id=(select auth.uid()) and status='draft');
drop policy if exists versions_public_or_owner_select on public.product_versions;
create policy versions_public_or_owner_select on public.product_versions for select to anon, authenticated using (
  exists(select 1 from public.products p where p.id=product_id and (p.status='published' or p.creator_id=(select auth.uid())))
);
drop policy if exists versions_creator_insert on public.product_versions;
create policy versions_creator_insert on public.product_versions for insert to authenticated with check (exists(select 1 from public.products p where p.id=product_id and p.creator_id=(select auth.uid()) and p.status='draft'));
drop policy if exists listings_public_or_owner_select on public.listings;
create policy listings_public_or_owner_select on public.listings for select to anon, authenticated using (
  status='published' or exists(select 1 from public.product_versions v join public.products p on p.id=v.product_id where v.id=product_version_id and p.creator_id=(select auth.uid()))
);
drop policy if exists prices_public_or_owner_select on public.prices;
create policy prices_public_or_owner_select on public.prices for select to anon, authenticated using (
  exists(select 1 from public.listings l where l.id=listing_id and (l.status='published' or exists(select 1 from public.product_versions v join public.products p on p.id=v.product_id where v.id=l.product_version_id and p.creator_id=(select auth.uid()))))
);

drop policy if exists orders_owner_select on public.orders;
create policy orders_owner_select on public.orders for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists order_items_owner_select on public.order_items;
create policy order_items_owner_select on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.owner_id=(select auth.uid())));
drop policy if exists entitlements_owner_select on public.entitlements;
create policy entitlements_owner_select on public.entitlements for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists loadout_owner_all on public.nook_loadout;
create policy loadout_owner_all on public.nook_loadout for all to authenticated using (
  exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid()))
) with check (
  exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid())) and
  exists(select 1 from public.entitlements e where e.id=entitlement_id and e.owner_id=(select auth.uid()) and e.status='active' and (e.expires_at is null or e.expires_at > now()))
);

-- User-scoped task creation is one transaction, including its checkpoint.
create or replace function public.nook_create_planned_task(
  p_task_id uuid,p_nook_id uuid,p_input text,p_status text,p_risk_class integer,
  p_plan jsonb,p_steps jsonb,p_approval jsonb default null
) returns table(task_id uuid,status text) language plpgsql security invoker set search_path = '' as $$
declare v_owner uuid := auth.uid(); first_step_id uuid; approval_step_id uuid;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_status not in ('ready','awaiting_approval','blocked') then raise exception 'invalid initial task status' using errcode='22023'; end if;
  if p_risk_class not between 0 and 3 or jsonb_typeof(p_plan)<>'object' or jsonb_typeof(p_steps)<>'array'
     or jsonb_array_length(p_steps) not between 1 and 20 then raise exception 'invalid task plan' using errcode='22023'; end if;
  if not exists(select 1 from public.nooks n where n.id=p_nook_id and n.owner_id=v_owner) then raise exception 'Nook not found' using errcode='P0002'; end if;
  first_step_id := (p_steps->0->>'id')::uuid;
  insert into public.tasks(id,owner_id,nook_id,input,status,risk_class,plan,current_step_id)
    values(p_task_id,v_owner,p_nook_id,p_input,p_status,p_risk_class,p_plan,first_step_id);
  insert into public.task_steps(id,task_id,ordinal,title,detail,kind,status,requires_approval,action_id,action_hash)
  select x.id,p_task_id,x.ordinal,x.title,x.detail,x.kind,x.status,x.requires_approval,x.action_id,x.action_hash
  from jsonb_to_recordset(p_steps) as x(id uuid,ordinal integer,title text,detail text,kind text,status text,requires_approval boolean,action_id text,action_hash text);
  if p_approval is not null and p_approval <> 'null'::jsonb then
    if jsonb_typeof(p_approval)<>'object' then raise exception 'invalid approval checkpoint' using errcode='22023'; end if;
    approval_step_id := (p_approval->>'step_id')::uuid;
    if not exists(select 1 from public.task_steps s where s.id=approval_step_id and s.task_id=p_task_id
      and s.requires_approval and s.action_hash=p_approval->>'action_hash'
      and s.action_id is not distinct from p_approval->>'action_id') then
      raise exception 'approval does not match a planned step' using errcode='22023';
    end if;
    insert into public.approvals(id,task_id,step_id,owner_id,action_id,action_hash,risk_class,status,intent,expires_at)
    values((p_approval->>'id')::uuid,p_task_id,approval_step_id,v_owner,p_approval->>'action_id',p_approval->>'action_hash',
      coalesce((p_approval->>'risk_class')::smallint,p_risk_class::smallint),'pending',coalesce(p_approval->'intent','{}'::jsonb),(p_approval->>'expires_at')::timestamptz);
  end if;
  return query select p_task_id,p_status;
end $$;
revoke all on function public.nook_create_planned_task(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.nook_create_planned_task(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb) to authenticated;

-- Simulated checkpoint decisions are exactly-once and hash-bound.
create or replace function public.nook_decide_simulated_approval(p_approval_id uuid,p_action_hash text,p_decision text)
returns table(task_id uuid,status text,receipt_id uuid) language plpgsql security definer set search_path = '' as $$
declare a public.approvals; next_task_status text; next_step_status text; new_receipt_id uuid := gen_random_uuid();
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid decision' using errcode='22023'; end if;
  select * into a from public.approvals
    where id=p_approval_id and owner_id=auth.uid() and action_hash=p_action_hash
      and status='pending' and expires_at>now() for update;
  if a.id is null then raise exception 'approval unavailable, expired, or already decided' using errcode='P0002'; end if;
  next_task_status := case p_decision when 'approve' then 'completed' else 'blocked' end;
  next_step_status := case p_decision when 'approve' then 'succeeded' else 'rejected' end;
  update public.approvals set status=case p_decision when 'approve' then 'approved' else 'rejected' end,
    decision=p_decision,decided_at=now() where id=a.id;
  update public.task_steps set status=next_step_status where id=a.step_id and task_id=a.task_id;
  update public.tasks set status=next_task_status,completed_at=case when p_decision='approve' then now() else completed_at end
    where id=a.task_id and owner_id=a.owner_id;
  insert into public.action_receipts(id,task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
    values(new_receipt_id,a.task_id,a.step_id,a.owner_id,'simulated',case p_decision when 'approve' then 'confirmed' else 'rejected' end,
      case p_decision when 'approve' then 'simulation.confirmed' else 'simulation.rejected' end,
      case p_decision when 'approve' then 'Simulated action confirmed; no external effect occurred.' else 'Simulated action rejected; no external effect occurred.' end,
      jsonb_build_object('decision',p_decision,'action_id',a.action_id,'action_hash',a.action_hash));
  return query select a.task_id,next_task_status,new_receipt_id;
end $$;
revoke all on function public.nook_decide_simulated_approval(uuid,text,text) from public, anon;
grant execute on function public.nook_decide_simulated_approval(uuid,text,text) to authenticated;

-- Service-role-only Google Workspace credential RPCs. Ciphertext is encrypted in the Worker.
create or replace function public.nook_store_google_connection(
  p_owner_id uuid, p_provider_subject text, p_account_email text, p_scopes text[],
  p_refresh_token_ciphertext text, p_refresh_token_iv text, p_key_version integer,
  p_access_token_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner_id is null or p_provider_subject is null or p_account_email is null or
     p_refresh_token_ciphertext is null or p_refresh_token_iv is null or p_key_version < 1 then
    raise exception 'invalid Google connection envelope' using errcode='22023';
  end if;
  insert into private.integration_connections(owner_id,provider,provider_subject,refresh_token_ciphertext,refresh_token_iv,key_version,status,access_token_expires_at,revoked_at)
  values(p_owner_id,'google_workspace',p_provider_subject,p_refresh_token_ciphertext,p_refresh_token_iv,p_key_version,'active',p_access_token_expires_at,null)
  on conflict(owner_id,provider) do update set provider_subject=excluded.provider_subject,
    refresh_token_ciphertext=excluded.refresh_token_ciphertext,refresh_token_iv=excluded.refresh_token_iv,
    key_version=excluded.key_version,status='active',access_token_expires_at=excluded.access_token_expires_at,revoked_at=null;
  insert into public.integration_connection_summaries(owner_id,provider,account_email,scopes,status,expires_at)
  values(p_owner_id,'google_workspace',lower(p_account_email),coalesce(p_scopes,'{}'),'active',p_access_token_expires_at)
  on conflict(owner_id,provider) do update set account_email=excluded.account_email,scopes=excluded.scopes,status='active',expires_at=excluded.expires_at;
  insert into private.security_events(owner_id,actor_type,event_type,metadata)
  values(p_owner_id,'service','integration.google.connected',jsonb_build_object('scopes',coalesce(p_scopes,'{}')));
end $$;

create or replace function public.nook_get_google_connection_secret(p_owner_id uuid)
returns table(refresh_token_ciphertext text,refresh_token_iv text,key_version integer)
language sql security definer set search_path = '' stable as $$
  select c.refresh_token_ciphertext,c.refresh_token_iv,c.key_version
  from private.integration_connections c
  where c.owner_id=p_owner_id and c.provider='google_workspace' and c.status='active';
$$;

create or replace function public.nook_revoke_google_connection(p_owner_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update private.integration_connections set status='revoked',refresh_token_ciphertext=null,
    refresh_token_iv=null,revoked_at=now() where owner_id=p_owner_id and provider='google_workspace';
  update public.integration_connection_summaries set status='revoked',expires_at=null
    where owner_id=p_owner_id and provider='google_workspace';
  insert into private.security_events(owner_id,actor_type,event_type) values(p_owner_id,'service','integration.google.revoked');
end $$;

revoke all on function public.nook_store_google_connection(uuid,text,text,text[],text,text,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.nook_get_google_connection_secret(uuid) from public, anon, authenticated;
revoke all on function public.nook_revoke_google_connection(uuid) from public, anon, authenticated;
grant execute on function public.nook_store_google_connection(uuid,text,text,text[],text,text,integer,timestamptz) to service_role;
grant execute on function public.nook_get_google_connection_secret(uuid) to service_role;
grant execute on function public.nook_revoke_google_connection(uuid) to service_role;

create or replace function public.nook_redeem_device_pairing(p_code_hash text,p_device_name text,p_public_key text,p_token_hash text)
returns table(device_id uuid) language plpgsql security definer set search_path = '' as $$
declare pairing public.device_pairings; new_device_id uuid;
begin
  select * into pairing from public.device_pairings
    where code_hash=p_code_hash and consumed_at is null and expires_at>now() for update;
  if pairing.id is null then raise exception 'pairing code invalid or expired' using errcode='P0002'; end if;
  insert into public.devices(owner_id,name,platform,status,public_key,token_hash)
    values(pairing.owner_id,p_device_name,'windows','active',p_public_key,p_token_hash) returning id into new_device_id;
  update public.device_pairings set consumed_at=now() where id=pairing.id;
  insert into private.security_events(owner_id,actor_type,event_type,metadata)
    values(pairing.owner_id,'service','device.paired',jsonb_build_object('device_id',new_device_id));
  return query select new_device_id;
end $$;
revoke all on function public.nook_redeem_device_pairing(text,text,text,text) from public, anon, authenticated;
grant execute on function public.nook_redeem_device_pairing(text,text,text,text) to service_role;

-- Public catalog projection. security_invoker preserves underlying RLS.
create or replace view public.catalog_items with (security_invoker=true) as
select l.id as listing_id,p.id as product_id,v.id as product_version_id,p.slug,p.name,p.description,p.kind,
  pr.unit_amount as price_amount,pr.currency,v.compatibility,a.public_url as preview_asset_url
from public.listings l
join public.product_versions v on v.id=l.product_version_id
join public.products p on p.id=v.product_id
join public.prices pr on pr.listing_id=l.id and pr.active
left join public.assets a on a.id=v.preview_asset_id
where l.status='published' and p.status='published';
revoke all on public.catalog_items from public;
grant select on public.catalog_items to anon, authenticated, service_role;

-- Safe, platform-owned starter catalog. No creator/auth user is impersonated.
insert into public.products(id,creator_id,owner_kind,kind,slug,name,description,status) values
('10000000-0000-4000-8000-000000000001',null,'platform','companion','orbit-starter','Orbit','The calm starter Nook companion.','published'),
('10000000-0000-4000-8000-000000000002',null,'platform','cosmetic','starter-hoodie','Starter Hoodie','A permission-free hoodie for nook-rig@1.','published')
on conflict(id) do nothing;
insert into public.product_versions(id,product_id,version,manifest,compatibility,content_hash) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'{"builtin":"orbit-v1"}','{"rig":"nook-rig@1"}','builtin:orbit-v1'),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',1,'{"builtin":"hoodie","slot":"outfit"}','{"rig":"nook-rig@1","slot":"outfit"}','builtin:starter-hoodie')
on conflict(id) do nothing;
insert into public.listings(id,product_version_id,status,published_at) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','published','2026-07-11T00:00:00Z'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','published','2026-07-11T00:00:00Z')
on conflict(id) do nothing;
insert into public.prices(id,listing_id,currency,unit_amount,active) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','USD',0,true),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','USD',0,true)
on conflict(id) do nothing;

-- Future objects in private remain closed by default.
alter default privileges in schema private revoke all on tables from public, anon, authenticated;
alter default privileges in schema private revoke all on functions from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
