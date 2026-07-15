-- Nook Browser Hand: a least-privilege, device-authenticated command lane.
-- The browser receives data-only commands; executable code is packaged in MV3.

create table if not exists public.browser_commands (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  run_id uuid not null references public.task_executions(id) on delete cascade,
  step_id uuid not null,
  action_hash text not null check (char_length(action_hash) between 32 and 128),
  command jsonb not null check (jsonb_typeof(command) = 'object'),
  status text not null default 'queued' check (status in ('queued','claimed','succeeded','failed','expired')),
  claimed_device_id uuid references public.devices(id) on delete set null,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  receipt_signature text,
  expires_at timestamptz not null,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint browser_commands_step_task_fk foreign key(step_id,task_id) references public.task_steps(id,task_id),
  check (expires_at > created_at)
);

create index if not exists browser_commands_owner_status_idx
  on public.browser_commands(owner_id,status,created_at);
create index if not exists browser_commands_task_idx
  on public.browser_commands(task_id,created_at desc);
create unique index if not exists browser_commands_live_action_idx
  on public.browser_commands(action_hash)
  where status in ('queued','claimed','succeeded');

alter table public.browser_commands enable row level security;
revoke all on public.browser_commands from public,anon;
grant select on public.browser_commands to authenticated;

drop policy if exists browser_commands_owner_select on public.browser_commands;
create policy browser_commands_owner_select on public.browser_commands
  for select to authenticated using ((select auth.uid()) = owner_id);

create or replace function public.nook_redeem_browser_pairing(
  p_code_hash text,
  p_device_name text,
  p_public_key text,
  p_token_hash text
) returns table(device_id uuid)
language plpgsql security definer set search_path = '' as $$
declare pairing public.device_pairings; new_device_id uuid;
begin
  select * into pairing from public.device_pairings
    where code_hash=p_code_hash and consumed_at is null and expires_at>now()
    for update;
  if pairing.id is null then
    raise exception 'pairing code invalid or expired' using errcode='P0002';
  end if;
  insert into public.devices(owner_id,name,platform,status,public_key,token_hash,last_seen_at)
    values(pairing.owner_id,left(p_device_name,80),'browser','active',p_public_key,p_token_hash,now())
    returning id into new_device_id;
  insert into public.capability_grants(owner_id,device_id,capability,scope,status)
    values(pairing.owner_id,new_device_id,'browser.tab.open',jsonb_build_object('providers',jsonb_build_array('youtube','google','bing','wikipedia','github')),'active');
  update public.device_pairings set consumed_at=now() where id=pairing.id;
  insert into private.security_events(owner_id,actor_type,event_type,metadata)
    values(pairing.owner_id,'service','browser.paired',jsonb_build_object('device_id',new_device_id));
  return query select new_device_id;
end $$;
revoke all on function public.nook_redeem_browser_pairing(text,text,text,text) from public,anon,authenticated;
grant execute on function public.nook_redeem_browser_pairing(text,text,text,text) to service_role;

create or replace function public.nook_claim_browser_command(p_token_hash text)
returns table(command_id uuid,command jsonb,action_hash text,expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_device public.devices; v_command public.browser_commands;
begin
  select * into v_device from public.devices
    where token_hash=p_token_hash and platform='browser' and status='active'
    for update;
  if v_device.id is null then
    raise exception 'browser device unauthorized' using errcode='42501';
  end if;
  update public.devices set last_seen_at=now(),updated_at=now() where id=v_device.id;
  update public.browser_commands set status='expired',completed_at=now()
    where owner_id=v_device.owner_id and status='queued' and expires_at<=now();
  select * into v_command from public.browser_commands
    where owner_id=v_device.owner_id and status='queued' and expires_at>now()
    order by created_at for update skip locked limit 1;
  if v_command.id is null then return; end if;
  update public.browser_commands
    set status='claimed',claimed_device_id=v_device.id,claimed_at=now()
    where id=v_command.id;
  return query select v_command.id,v_command.command,v_command.action_hash,v_command.expires_at;
end $$;
revoke all on function public.nook_claim_browser_command(text) from public,anon,authenticated;
grant execute on function public.nook_claim_browser_command(text) to service_role;

create or replace function public.nook_finish_browser_command(
  p_token_hash text,
  p_command_id uuid,
  p_status text,
  p_result jsonb,
  p_receipt_signature text
) returns table(task_id uuid,task_status text,output_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_device public.devices;
  v_command public.browser_commands;
  v_task public.tasks;
  v_output uuid;
  v_provider text;
  v_query text;
  v_url text;
  v_summary text;
  v_markdown text;
begin
  if p_status not in ('succeeded','failed') or jsonb_typeof(p_result)<>'object'
    or char_length(p_receipt_signature) not between 32 and 2048 then
    raise exception 'invalid browser receipt' using errcode='22023';
  end if;
  select * into v_device from public.devices
    where token_hash=p_token_hash and platform='browser' and status='active';
  if v_device.id is null then raise exception 'browser device unauthorized' using errcode='42501'; end if;
  select * into v_command from public.browser_commands
    where id=p_command_id and owner_id=v_device.owner_id and claimed_device_id=v_device.id
      and status='claimed' and expires_at>now() for update;
  if v_command.id is null then raise exception 'browser command unavailable' using errcode='P0002'; end if;
  select * into v_task from public.tasks
    where id=v_command.task_id and owner_id=v_device.owner_id and status='running'
      and active_run_id=v_command.run_id for update;
  if v_task.id is null then raise exception 'browser task run changed' using errcode='55000'; end if;
  if p_result->>'actionHash' is distinct from v_command.action_hash then
    raise exception 'browser action hash changed' using errcode='22023';
  end if;

  update public.devices set last_seen_at=now(),updated_at=now() where id=v_device.id;
  update public.browser_commands set status=p_status,result=p_result,
    receipt_signature=p_receipt_signature,completed_at=now() where id=v_command.id;

  if p_status='failed' then
    update public.task_executions set status='failed',error_code='BROWSER_HAND_FAILED',completed_at=now()
      where id=v_command.run_id and status in ('running','verifying');
    update public.task_steps set status='failed',updated_at=now() where id=v_command.step_id;
    update public.tasks set status='failed',active_run_mode=null,active_run_id=null,updated_at=now()
      where id=v_command.task_id;
    insert into public.action_receipts(task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
      values(v_command.task_id,v_command.step_id,v_device.owner_id,'execution','failed','browser.command.failed',
        'The paired browser rejected or failed the exact tab command.',
        jsonb_build_object('command_id',v_command.id,'device_id',v_device.id,'action_hash',v_command.action_hash));
    insert into public.task_events(task_id,owner_id,event_type,message,metadata)
      values(v_command.task_id,v_device.owner_id,'task.failed','Browser Hand failed safely.',jsonb_build_object('command_id',v_command.id));
    return query select v_command.task_id,'failed'::text,null::uuid;
    return;
  end if;

  v_provider:=v_command.command#>>'{action,provider}';
  v_query:=v_command.command#>>'{action,query}';
  v_url:=v_command.command#>>'{action,url}';
  v_summary:=case when coalesce(v_query,'')<>'' then
    concat('Browser Hand opened ',initcap(v_provider),' search for “',left(v_query,180),'”.')
    else concat('Browser Hand opened ',initcap(v_provider),' in a new tab.') end;
  v_markdown:=concat('## Browser receipt',E'\n\n','- Action: ',v_summary,E'\n','- Opened URL: [',v_url,'](',v_url,')',E'\n','- Device receipt: signed and verified',E'\n','- Page contents read: no',E'\n','- Forms submitted: no');
  insert into public.task_outputs(task_id,owner_id,summary,result_markdown,model,graph_version,prompt_version,mode,metadata)
    values(v_command.task_id,v_device.owner_id,v_summary,v_markdown,'nook/browser-hand','nook-manager@2','browser-hand@1','work',
      jsonb_build_object('title','Browser tab opened','whatChanged',jsonb_build_array(v_summary,'Saved a signed device receipt'),'nextSuggestedAction','Continue in the opened tab, or give Nook another bounded browser task.','toolName','browser_tab','deviceId',v_device.id,'commandId',v_command.id))
    returning id into v_output;
  update public.task_executions set status='succeeded',verification=jsonb_build_object(
      'verdict','pass','method','device-signed-browser-receipt','actionHash',v_command.action_hash,
      'deviceId',v_device.id,'commandId',v_command.id),completed_at=now()
    where id=v_command.run_id and status='running';
  update public.task_steps set status='succeeded',updated_at=now() where id=v_command.step_id;
  update public.tasks set status='completed',active_run_mode=null,active_run_id=null,completed_at=now(),updated_at=now()
    where id=v_command.task_id;
  insert into public.action_receipts(task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
    values(v_command.task_id,v_command.step_id,v_device.owner_id,'execution','succeeded','browser.command.verified',
      'The paired browser executed the exact hash-bound tab command and signed its receipt.',
      jsonb_build_object('command_id',v_command.id,'device_id',v_device.id,'action_hash',v_command.action_hash,'output_id',v_output,'receipt_signature',p_receipt_signature));
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(v_command.task_id,v_device.owner_id,'task.completed','Browser Hand completed and verified the tab action.',jsonb_build_object('command_id',v_command.id,'output_id',v_output));
  return query select v_command.task_id,'completed'::text,v_output;
end $$;
revoke all on function public.nook_finish_browser_command(text,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.nook_finish_browser_command(text,uuid,text,jsonb,text) to service_role;

create or replace function public.nook_expire_browser_command(p_owner_id uuid,p_command_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_command public.browser_commands; v_task public.tasks;
begin
  select * into v_command from public.browser_commands
    where id=p_command_id and owner_id=p_owner_id and status in ('queued','claimed','expired') for update;
  if v_command.id is null then return false; end if;
  update public.browser_commands set status='expired',completed_at=coalesce(completed_at,now()) where id=v_command.id;
  select * into v_task from public.tasks where id=v_command.task_id and owner_id=p_owner_id for update;
  if v_task.status='running' and v_task.active_run_id=v_command.run_id then
    update public.task_executions set status='failed',error_code='BROWSER_RECEIPT_TIMEOUT',completed_at=now()
      where id=v_command.run_id and status in ('running','verifying');
    update public.task_steps set status='failed',updated_at=now() where id=v_command.step_id;
    update public.tasks set status='failed',active_run_mode=null,active_run_id=null,updated_at=now()
      where id=v_command.task_id;
    insert into public.action_receipts(task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
      values(v_command.task_id,v_command.step_id,p_owner_id,'execution','failed','browser.command.timeout',
        'Browser Hand did not return a signed receipt. The tab action is not claimed as successful.',
        jsonb_build_object('command_id',v_command.id,'action_hash',v_command.action_hash,'outcome_uncertain',v_command.status='claimed'));
    insert into public.task_events(task_id,owner_id,event_type,message,metadata)
      values(v_command.task_id,p_owner_id,'task.failed','Browser receipt timed out; success was not claimed.',jsonb_build_object('command_id',v_command.id));
  end if;
  return true;
end $$;
revoke all on function public.nook_expire_browser_command(uuid,uuid) from public,anon,authenticated;
grant execute on function public.nook_expire_browser_command(uuid,uuid) to service_role;
