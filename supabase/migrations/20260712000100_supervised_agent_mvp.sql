-- Nook supervised-agent MVP: immutable tool plans, durable events, verified runs.
create extension if not exists pgcrypto;

create table if not exists private.runtime_secrets (
  key text primary key,
  secret text not null check (char_length(secret) >= 32),
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);
revoke all on private.runtime_secrets from public, anon, authenticated;

alter table public.tasks add column if not exists active_run_id uuid;
alter table public.task_steps add column if not exists tool_name text;
alter table public.task_steps add column if not exists tool_version text;
alter table public.task_steps add column if not exists tool_input jsonb;
alter table public.task_steps drop constraint if exists task_steps_tool_contract;
alter table public.task_steps add constraint task_steps_tool_contract check (
  (tool_name is null and tool_version is null and tool_input is null) or
  (tool_name in ('create_draft','open_supported_url','guided_workflow','save_nook_preference') and
   tool_version='1' and jsonb_typeof(tool_input)='object')
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  sequence bigint generated always as identity,
  task_id uuid not null references public.tasks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 100),
  message text not null check (char_length(message) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index if not exists task_events_task_sequence_idx on public.task_events(task_id,sequence);
alter table public.task_events enable row level security;
revoke all on public.task_events from public,anon,authenticated;
grant select on public.task_events to authenticated;
grant all on public.task_events to service_role;
drop policy if exists task_events_owner_select on public.task_events;
create policy task_events_owner_select on public.task_events for select to authenticated using ((select auth.uid())=owner_id);

create table if not exists public.task_executions (
  id uuid primary key,
  task_id uuid not null references public.tasks(id) on delete cascade,
  step_id uuid not null references public.task_steps(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  action_hash text not null check (char_length(action_hash)=64),
  attempt integer not null check (attempt between 1 and 3),
  status text not null check (status in ('prepared','running','verifying','succeeded','failed')),
  verification jsonb not null default '{}'::jsonb check (jsonb_typeof(verification)='object'),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(action_hash,attempt),
  unique(task_id,id)
);
create index if not exists task_executions_owner_task_idx on public.task_executions(owner_id,task_id,attempt desc);
alter table public.task_executions enable row level security;
revoke all on public.task_executions from public,anon,authenticated;
grant select on public.task_executions to authenticated;
grant all on public.task_executions to service_role;
drop policy if exists task_executions_owner_select on public.task_executions;
create policy task_executions_owner_select on public.task_executions for select to authenticated using ((select auth.uid())=owner_id);

create or replace function private.nook_verify_server_signature(
  p_operation text,p_owner uuid,p_resource text,p_expires_at bigint,p_signature text
) returns boolean language plpgsql security definer set search_path='' stable as $$
declare v_secret text; v_expected text; v_now bigint:=extract(epoch from now())::bigint;
begin
  if p_expires_at < v_now or p_expires_at > v_now+120 or p_signature !~ '^[a-f0-9]{64}$' then return false; end if;
  select secret into v_secret from private.runtime_secrets where key='task_execution_hmac';
  if v_secret is null then return false; end if;
  v_expected:=encode(extensions.hmac(convert_to(concat_ws(':',p_operation,p_owner::text,p_resource,p_expires_at::text),'UTF8'),convert_to(v_secret,'UTF8'),'sha256'),'hex');
  return v_expected=p_signature;
end $$;
revoke all on function private.nook_verify_server_signature(text,uuid,text,bigint,text) from public,anon,authenticated;

revoke insert on public.tasks,public.task_steps,public.approvals from authenticated;
revoke execute on function public.nook_create_planned_task(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb) from authenticated;
revoke execute on function public.nook_claim_task_run(uuid) from authenticated;
revoke execute on function public.nook_store_task_output(uuid,text,text,text,text,text,jsonb) from authenticated;
revoke execute on function public.nook_decide_simulated_approval(uuid,text,text) from authenticated;

create or replace function public.nook_create_supervised_task(
  p_task_id uuid,p_nook_id uuid,p_input text,p_status text,p_risk_class integer,
  p_plan jsonb,p_steps jsonb,p_approval jsonb,p_expires_at bigint,p_signature text
) returns table(task_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_step_id uuid; v_has_approval boolean:=p_approval is not null and p_approval<>'null'::jsonb;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.nook_verify_server_signature('create_task',v_owner,p_task_id::text,p_expires_at,p_signature)
    then raise exception 'invalid server authorization' using errcode='42501'; end if;
  if char_length(p_input) not between 1 and 1200 or p_status not in ('ready','awaiting_approval','blocked')
    or p_risk_class not between 0 and 3 or jsonb_typeof(p_plan)<>'object' or jsonb_typeof(p_steps)<>'array'
    or jsonb_array_length(p_steps)<>1 then raise exception 'invalid supervised task' using errcode='22023'; end if;
  if (p_status='awaiting_approval')<>v_has_approval then raise exception 'approval state mismatch' using errcode='22023'; end if;
  if not exists(select 1 from public.nooks where id=p_nook_id and owner_id=v_owner) then raise exception 'Nook not found' using errcode='P0002'; end if;
  v_step_id:=(p_steps->0->>'id')::uuid;
  insert into public.tasks(id,owner_id,nook_id,input,status,risk_class,plan,current_step_id)
    values(p_task_id,v_owner,p_nook_id,p_input,p_status,p_risk_class,p_plan,v_step_id);
  insert into public.task_steps(id,task_id,ordinal,title,detail,kind,status,requires_approval,action_id,action_hash,tool_name,tool_version,tool_input)
  select x.id,p_task_id,x.ordinal,x.title,x.detail,x.kind,x.status,x.requires_approval,x.action_id,x.action_hash,x.tool_name,x.tool_version,x.tool_input
  from jsonb_to_recordset(p_steps) as x(id uuid,ordinal integer,title text,detail text,kind text,status text,requires_approval boolean,action_id text,action_hash text,tool_name text,tool_version text,tool_input jsonb);
  if v_has_approval then
    if not exists(select 1 from public.task_steps where id=v_step_id and task_id=p_task_id and requires_approval and action_hash=p_approval->>'action_hash')
      then raise exception 'approval does not match immutable tool action' using errcode='22023'; end if;
    insert into public.approvals(id,task_id,step_id,owner_id,action_id,action_hash,risk_class,status,intent,expires_at)
    values((p_approval->>'id')::uuid,p_task_id,v_step_id,v_owner,p_approval->>'action_id',p_approval->>'action_hash',
      (p_approval->>'risk_class')::smallint,'pending',p_approval->'intent',(p_approval->>'expires_at')::timestamptz);
  end if;
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(p_task_id,v_owner,'task.planned','Nook saved a policy-checked plan.',jsonb_build_object('risk_class',p_risk_class,'status',p_status));
  insert into public.action_receipts(task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
    values(p_task_id,v_step_id,v_owner,'plan','recorded','task.plan.saved','A deterministic tool plan was saved; no tool ran.',jsonb_build_object('tool_name',p_steps->0->>'tool_name','tool_version',p_steps->0->>'tool_version'));
  return query select p_task_id,p_status;
end $$;
revoke all on function public.nook_create_supervised_task(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb,bigint,text) from public,anon;
grant execute on function public.nook_create_supervised_task(uuid,uuid,text,text,integer,jsonb,jsonb,jsonb,bigint,text) to authenticated;

create or replace function public.nook_claim_supervised_run(p_task_id uuid,p_expires_at bigint,p_signature text)
returns table(run_id uuid,run_mode text,tool_name text,tool_version text,tool_input jsonb,action_hash text) language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks; v_step public.task_steps; v_run uuid:=gen_random_uuid(); v_attempt integer;
begin
  if v_owner is null or not private.nook_verify_server_signature('claim_task',v_owner,p_task_id::text,p_expires_at,p_signature)
    then raise exception 'invalid server authorization' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_task.id is null then raise exception 'task unavailable' using errcode='P0002'; end if;
  if v_task.status<>'ready' or v_task.active_run_id is not null then raise exception 'task is not ready' using errcode='55000'; end if;
  if exists(select 1 from public.task_outputs where task_id=p_task_id) then raise exception 'task output already exists' using errcode='23505'; end if;
  select * into v_step from public.task_steps where id=v_task.current_step_id and task_id=p_task_id for update;
  if v_step.tool_name is null or v_step.status not in ('queued','approved','failed') then raise exception 'tool step unavailable' using errcode='55000'; end if;
  select coalesce(max(attempt),0)+1 into v_attempt from public.task_executions where task_id=p_task_id;
  if v_attempt>3 then raise exception 'retry limit reached' using errcode='54000'; end if;
  insert into public.task_executions(id,task_id,step_id,owner_id,action_hash,attempt,status)
    values(v_run,p_task_id,v_step.id,v_owner,v_step.action_hash,v_attempt,'running');
  update public.tasks set status='running',active_run_mode='work',active_run_id=v_run,started_at=coalesce(started_at,now()),updated_at=now() where id=p_task_id;
  update public.task_steps set status='running',updated_at=now() where id=v_step.id;
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(p_task_id,v_owner,'task.execution.started','Nook started the approved allowlisted tool.',jsonb_build_object('run_id',v_run,'attempt',v_attempt,'tool_name',v_step.tool_name));
  return query select v_run,'work'::text,v_step.tool_name,v_step.tool_version,v_step.tool_input,v_step.action_hash;
end $$;
revoke all on function public.nook_claim_supervised_run(uuid,bigint,text) from public,anon;
grant execute on function public.nook_claim_supervised_run(uuid,bigint,text) to authenticated;

create or replace function public.nook_finish_supervised_run(
  p_task_id uuid,p_run_id uuid,p_summary text,p_result_markdown text,p_model text,p_graph_version text,
  p_prompt_version text,p_metadata jsonb,p_verification jsonb,p_expires_at bigint,p_signature text
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks; v_step public.task_steps; v_output uuid; v_field text; v_value text;
begin
  if v_owner is null or not private.nook_verify_server_signature('finish_task',v_owner,concat(p_task_id::text,':',p_run_id::text),p_expires_at,p_signature)
    then raise exception 'invalid server authorization' using errcode='42501'; end if;
  if char_length(p_summary) not between 1 and 300 or char_length(p_result_markdown) not between 1 and 20000
    or jsonb_typeof(p_metadata)<>'object' or jsonb_typeof(p_verification)<>'object' then raise exception 'invalid result' using errcode='22023'; end if;
  select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_task.status<>'running' or v_task.active_run_id is distinct from p_run_id then raise exception 'run changed' using errcode='55000'; end if;
  select * into v_step from public.task_steps where id=v_task.current_step_id and task_id=p_task_id for update;
  update public.task_executions set status='verifying' where id=p_run_id and status='running';
  if v_step.tool_name='save_nook_preference' then
    v_field:=v_step.tool_input->>'field'; v_value:=v_step.tool_input->>'value';
    if (v_field='initiative' and v_value in ('low','balanced','proactive')) or
       (v_field='explanationDepth' and v_value in ('brief','clear','deep')) or
       (v_field='updateFrequency' and v_value in ('quiet','milestones','frequent')) then
      update public.nooks set behavior_settings=jsonb_set(behavior_settings,array[v_field],to_jsonb(v_value),true),updated_at=now()
        where id=v_task.nook_id and owner_id=v_owner;
      if not exists(select 1 from public.nooks where id=v_task.nook_id and behavior_settings->>v_field=v_value)
        then raise exception 'preference verification failed' using errcode='55000'; end if;
    else raise exception 'invalid preference action' using errcode='22023'; end if;
  end if;
  insert into public.task_outputs(task_id,owner_id,summary,result_markdown,model,graph_version,prompt_version,mode,metadata)
    values(p_task_id,v_owner,p_summary,p_result_markdown,p_model,p_graph_version,p_prompt_version,'work',p_metadata)
    returning id into v_output;
  update public.task_executions set status='succeeded',verification=p_verification,completed_at=now() where id=p_run_id;
  update public.task_steps set status='succeeded',updated_at=now() where id=v_step.id;
  update public.tasks set status='completed',active_run_mode=null,active_run_id=null,completed_at=now(),updated_at=now() where id=p_task_id;
  insert into public.action_receipts(task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
    values(p_task_id,v_step.id,v_owner,'execution','succeeded','task.tool.verified','The allowlisted tool completed and its result was verified.',jsonb_build_object('run_id',p_run_id,'action_hash',v_step.action_hash,'tool_name',v_step.tool_name,'output_id',v_output));
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(p_task_id,v_owner,'task.completed','Nook completed and verified the saved result.',jsonb_build_object('run_id',p_run_id,'output_id',v_output));
  return v_output;
end $$;
revoke all on function public.nook_finish_supervised_run(uuid,uuid,text,text,text,text,text,jsonb,jsonb,bigint,text) from public,anon;
grant execute on function public.nook_finish_supervised_run(uuid,uuid,text,text,text,text,text,jsonb,jsonb,bigint,text) to authenticated;

create or replace function public.nook_fail_supervised_run(
  p_task_id uuid,p_run_id uuid,p_error_code text,p_expires_at bigint,p_signature text
) returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks;
begin
  if v_owner is null or not private.nook_verify_server_signature('fail_task',v_owner,concat(p_task_id::text,':',p_run_id::text),p_expires_at,p_signature)
    then raise exception 'invalid server authorization' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_task.status<>'running' or v_task.active_run_id is distinct from p_run_id then raise exception 'run changed' using errcode='55000'; end if;
  update public.task_executions set status='failed',error_code=left(p_error_code,80),completed_at=now() where id=p_run_id and status in ('running','verifying');
  update public.task_steps set status='failed',updated_at=now() where id=v_task.current_step_id;
  update public.tasks set status='failed',active_run_mode=null,active_run_id=null,updated_at=now() where id=p_task_id;
  insert into public.action_receipts(task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
    values(p_task_id,v_task.current_step_id,v_owner,'execution','failed','task.tool.failed','The allowlisted tool failed without claiming success.',jsonb_build_object('run_id',p_run_id,'error_code',left(p_error_code,80)));
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(p_task_id,v_owner,'task.failed','Nook stopped safely; the task can be retried.',jsonb_build_object('run_id',p_run_id));
end $$;
revoke all on function public.nook_fail_supervised_run(uuid,uuid,text,bigint,text) from public,anon;
grant execute on function public.nook_fail_supervised_run(uuid,uuid,text,bigint,text) to authenticated;

create or replace function public.nook_decide_approval(p_approval_id uuid,p_action_hash text,p_decision text)
returns table(task_id uuid,status text,receipt_id uuid) language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); a public.approvals; v_task_status text; v_step_status text; v_receipt uuid:=gen_random_uuid();
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid decision' using errcode='22023'; end if;
  select * into a from public.approvals where id=p_approval_id and owner_id=v_owner and action_hash=p_action_hash and status='pending' for update;
  if a.id is null then raise exception 'approval unavailable or already decided' using errcode='P0002'; end if;
  if a.expires_at<=now() then
    update public.approvals set status='expired',decided_at=now() where id=a.id;
    update public.task_steps set status='expired',updated_at=now() where id=a.step_id;
    update public.tasks set status='expired',updated_at=now() where id=a.task_id;
    v_task_status:='expired'; v_step_status:='expired';
  else
    v_task_status:=case p_decision when 'approve' then 'ready' else 'blocked' end;
    v_step_status:=case p_decision when 'approve' then 'approved' else 'rejected' end;
    update public.approvals set status=case p_decision when 'approve' then 'approved' else 'rejected' end,decision=p_decision,decided_at=now() where id=a.id;
    update public.task_steps set status=v_step_status,updated_at=now() where id=a.step_id;
    update public.tasks set status=v_task_status,updated_at=now() where id=a.task_id and status='awaiting_approval';
  end if;
  insert into public.action_receipts(id,task_id,step_id,owner_id,stage,status,event_type,summary,metadata)
    values(v_receipt,a.task_id,a.step_id,v_owner,'approval',case when v_task_status='ready' then 'confirmed' else 'rejected' end,
      'task.approval.'||v_step_status,case when v_task_status='ready' then 'The exact hash-bound tool action was approved once.' when v_task_status='expired' then 'The approval expired; no tool ran.' else 'The tool action was rejected; no tool ran.' end,
      jsonb_build_object('decision',p_decision,'action_hash',a.action_hash));
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(a.task_id,v_owner,'task.approval.'||v_step_status,case when v_task_status='ready' then 'Approval recorded; the tool is ready to run.' when v_task_status='expired' then 'Approval expired.' else 'Approval rejected; task stopped.' end,jsonb_build_object('approval_id',a.id));
  return query select a.task_id,v_task_status,v_receipt;
end $$;
revoke all on function public.nook_decide_approval(uuid,text,text) from public,anon;
grant execute on function public.nook_decide_approval(uuid,text,text) to authenticated;

create or replace function public.nook_transition_task(p_task_id uuid,p_action text)
returns table(task_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks; v_next text;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_task.id is null then raise exception 'task unavailable' using errcode='P0002'; end if;
  if p_action='cancel' and v_task.status in ('draft','planning','policy_review','ready','running','awaiting_approval','retry_wait') then
    v_next:='cancelled';
    update public.approvals set status='cancelled',decided_at=now() where task_id=p_task_id and status='pending';
    update public.task_steps set status='cancelled',updated_at=now() where task_id=p_task_id and status not in ('succeeded','rejected','failed','expired');
    update public.task_executions set status='failed',error_code='cancelled',completed_at=now() where task_id=p_task_id and status in ('prepared','running','verifying');
  elsif p_action='retry' and v_task.status='failed' and not exists(select 1 from public.task_outputs where task_id=p_task_id) and
    (select count(*) from public.task_executions where task_id=p_task_id)<3 then
    v_next:='ready';
    update public.task_steps set status='queued',updated_at=now() where id=v_task.current_step_id and status='failed';
  else raise exception 'task transition unavailable' using errcode='55000'; end if;
  update public.tasks set status=v_next,active_run_mode=null,active_run_id=null,updated_at=now() where id=p_task_id;
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)
    values(p_task_id,v_owner,'task.'||v_next,case v_next when 'cancelled' then 'Task cancelled; pending work stopped.' else 'Task reset for a bounded retry.' end,'{}');
  return query select p_task_id,v_next;
end $$;
revoke all on function public.nook_transition_task(uuid,text) from public,anon;
grant execute on function public.nook_transition_task(uuid,text) to authenticated;
