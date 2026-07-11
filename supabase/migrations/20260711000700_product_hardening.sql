create index if not exists nook_memories_nook_id_idx on public.nook_memories(nook_id);

revoke insert,update,delete on public.task_outputs from authenticated;
grant select on public.task_outputs to authenticated;
drop policy if exists task_outputs_owner_insert on public.task_outputs;
drop policy if exists task_outputs_owner_update on public.task_outputs;

drop policy if exists nook_memories_owner_insert on public.nook_memories;
create policy nook_memories_owner_insert on public.nook_memories for insert to authenticated with check (
  (select auth.uid())=owner_id and source='taught' and
  exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid()))
);
drop policy if exists nook_memories_owner_update on public.nook_memories;
create policy nook_memories_owner_update on public.nook_memories for update to authenticated
  using ((select auth.uid())=owner_id)
  with check ((select auth.uid())=owner_id and source='taught' and exists(
    select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid())
  ));

alter table public.nooks drop constraint if exists nooks_behavior_settings_contract;
alter table public.nooks add constraint nooks_behavior_settings_contract check (
  behavior_settings ?& array['initiative','explanationDepth','updateFrequency'] and
  (behavior_settings - array['initiative','explanationDepth','updateFrequency'])='{}'::jsonb and
  behavior_settings->>'initiative' in ('low','balanced','proactive') and
  behavior_settings->>'explanationDepth' in ('brief','clear','deep') and
  behavior_settings->>'updateFrequency' in ('quiet','milestones','frequent')
);

create or replace function public.nook_store_task_output(
  p_task_id uuid, p_summary text, p_result_markdown text, p_model text, p_graph_version text,
  p_prompt_version text, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks; v_output uuid; v_mode text;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if char_length(p_summary) not between 1 and 300 or char_length(p_result_markdown) not between 1 and 20000
     or char_length(p_model) not between 1 and 120 or char_length(p_graph_version) not between 1 and 120
     or char_length(p_prompt_version) not between 1 and 120 or jsonb_typeof(p_metadata)<>'object'
     then raise exception 'invalid task output' using errcode='22023'; end if;
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
  values(p_task_id,v_owner,'system','recorded','task.result.generated','Nook generated and saved a task result.',
    jsonb_build_object('model',p_model,'graph_version',p_graph_version,'mode',v_mode,'output_id',v_output));
  return v_output;
end $$;
