alter table public.tasks add column if not exists active_run_mode text check (active_run_mode in ('work','draft_only'));
alter table public.task_outputs add column if not exists metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object');

drop function if exists public.nook_store_task_output(uuid,text,text,text,text,text,text,boolean);

create or replace function public.nook_claim_task_run(p_task_id uuid)
returns table(task_id uuid, run_mode text) language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_status text; v_mode text;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  select status into v_status from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_status is null then raise exception 'task unavailable' using errcode='P0002'; end if;
  if v_status not in ('ready','awaiting_approval','failed') then raise exception 'task cannot be worked in its current state' using errcode='55000'; end if;
  v_mode:=case when v_status='awaiting_approval' then 'draft_only' else 'work' end;
  update public.tasks set status='running',active_run_mode=v_mode,updated_at=now() where id=p_task_id;
  return query select p_task_id,v_mode;
end $$;

create or replace function public.nook_store_task_output(
  p_task_id uuid,
  p_summary text,
  p_result_markdown text,
  p_model text,
  p_graph_version text,
  p_prompt_version text,
  p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks; v_output uuid; v_mode text;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if char_length(p_summary) not between 1 and 300 or char_length(p_result_markdown) not between 1 and 20000
     or jsonb_typeof(p_metadata)<>'object' then raise exception 'invalid task output' using errcode='22023'; end if;
  select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_task.id is null then raise exception 'task unavailable' using errcode='P0002'; end if;
  if v_task.status<>'running' or v_task.active_run_mode is null then raise exception 'task run was not claimed' using errcode='55000'; end if;
  v_mode:=v_task.active_run_mode;
  insert into public.task_outputs(task_id,owner_id,summary,result_markdown,model,graph_version,prompt_version,mode,metadata)
  values(p_task_id,v_owner,p_summary,p_result_markdown,p_model,p_graph_version,p_prompt_version,v_mode,p_metadata)
  on conflict(task_id) do nothing returning id into v_output;
  if v_output is null then raise exception 'task output already exists' using errcode='23505'; end if;
  update public.tasks set status=case when v_mode='draft_only' then 'awaiting_approval' else 'completed' end,
    completed_at=case when v_mode='draft_only' then completed_at else now() end,active_run_mode=null,updated_at=now()
    where id=p_task_id;
  insert into public.action_receipts(task_id,owner_id,stage,status,event_type,summary,metadata)
  values(p_task_id,v_owner,'system','confirmed','task.work.completed','Nook produced a saved task result.',
    jsonb_build_object('model',p_model,'graph_version',p_graph_version,'mode',v_mode));
  return v_output;
end $$;

revoke all on function public.nook_claim_task_run(uuid) from public,anon;
grant execute on function public.nook_claim_task_run(uuid) to authenticated;
revoke all on function public.nook_store_task_output(uuid,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.nook_store_task_output(uuid,text,text,text,text,text,jsonb) to authenticated;
