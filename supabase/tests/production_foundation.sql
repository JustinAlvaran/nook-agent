-- Run against a disposable local Supabase database after migrations:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/production_foundation.sql
begin;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','nooks','appearance_versions','tasks','task_steps','approvals','action_receipts','task_events','task_executions','nook_memories','task_outputs',
    'devices','device_pairings','capability_grants','products','product_versions','listings','prices',
    'orders','order_items','entitlements','nook_loadout','integration_connection_summaries'
  ] loop
    if to_regclass('public.' || t) is null then raise exception 'missing table public.%',t; end if;
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.' || t)) then raise exception 'RLS disabled on public.%',t; end if;
  end loop;
  foreach t in array array['integration_connections','payment_sessions','payment_records','webhook_inbox','security_events','runtime_secrets'] loop
    if to_regclass('private.' || t) is null then raise exception 'missing table private.%',t; end if;
    if has_table_privilege('anon','private.' || t,'select') or has_table_privilege('authenticated','private.' || t,'select') then
      raise exception 'private.% exposed to client role',t;
    end if;
  end loop;
  if not exists(select 1 from pg_class where oid='public.catalog_items'::regclass and relkind='v') then raise exception 'catalog view missing'; end if;
  if (select count(*) from public.catalog_items where product_id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')) <> 2 then
    raise exception 'starter catalog items missing';
  end if;
  if has_function_privilege('authenticated','public.nook_get_google_connection_secret(uuid)','execute') then raise exception 'secret RPC exposed'; end if;
  if has_function_privilege('anon','public.nook_redeem_device_pairing(text,text,text,text)','execute') then raise exception 'pairing RPC exposed'; end if;
  if has_column_privilege('authenticated','public.devices','token_hash','select') then raise exception 'device token hash exposed'; end if;
  if has_table_privilege('authenticated','public.tasks','insert') then raise exception 'browser can forge tasks'; end if;
  if has_table_privilege('authenticated','public.task_outputs','insert') then raise exception 'browser can forge outputs'; end if;
  if has_function_privilege('authenticated','public.nook_claim_task_run(uuid)','execute') then raise exception 'old claim RPC exposed'; end if;
  if has_function_privilege('authenticated','public.nook_store_task_output(uuid,text,text,text,text,text,jsonb)','execute') then raise exception 'old output RPC exposed'; end if;
  if not has_function_privilege('authenticated','public.nook_create_supervised_task(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb,bigint,text)','execute') then raise exception 'signed task RPC unavailable'; end if;
  if not has_function_privilege('authenticated','public.nook_claim_supervised_run(uuid,bigint,text)','execute') then raise exception 'signed claim RPC unavailable'; end if;
  if not has_function_privilege('authenticated','public.nook_decide_approval(uuid,text,text)','execute') then raise exception 'decision RPC unavailable'; end if;
  if not has_function_privilege('service_role','public.nook_store_google_connection(uuid,text,text,text[],text,text,integer,timestamp with time zone)','execute') then raise exception 'service role cannot store Google connection'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='integration_connection_summaries' and policyname='integration_summaries_owner_select') then raise exception 'connection summary owner policy missing'; end if;
end $$;

-- Append-only enforcement must reject mutation.
do $$
begin
  begin
    update public.product_versions set content_hash='tampered' where id='20000000-0000-4000-8000-000000000001';
    raise exception 'product version mutation unexpectedly succeeded';
  exception when sqlstate '55000' then null;
  end;
end $$;

rollback;
