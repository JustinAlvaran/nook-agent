grant update(behavior_settings) on public.nooks to authenticated;

create or replace function public.nook_store_task_output(
  p_task_id uuid,
  p_summary text,
  p_result_markdown text,
  p_model text,
  p_graph_version text,
  p_prompt_version text,
  p_mode text,
  p_keep_approval boolean default false
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid(); v_task public.tasks; v_output uuid;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  if char_length(p_summary) not between 1 and 300 or char_length(p_result_markdown) not between 1 and 20000
     or p_mode not in ('work','draft_only') then raise exception 'invalid task output' using errcode='22023'; end if;
  select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;
  if v_task.id is null then raise exception 'task unavailable' using errcode='P0002'; end if;
  if v_task.status not in ('ready','awaiting_approval','failed') then raise exception 'task cannot be worked in its current state' using errcode='55000'; end if;
  insert into public.task_outputs(task_id,owner_id,summary,result_markdown,model,graph_version,prompt_version,mode)
  values(p_task_id,v_owner,p_summary,p_result_markdown,p_model,p_graph_version,p_prompt_version,p_mode)
  on conflict(task_id) do update set summary=excluded.summary,result_markdown=excluded.result_markdown,
    model=excluded.model,graph_version=excluded.graph_version,prompt_version=excluded.prompt_version,mode=excluded.mode,updated_at=now()
  returning id into v_output;
  update public.tasks set status=case when p_keep_approval and v_task.status='awaiting_approval' then 'awaiting_approval' else 'completed' end,
    completed_at=case when p_keep_approval and v_task.status='awaiting_approval' then completed_at else now() end,updated_at=now()
    where id=p_task_id;
  insert into public.action_receipts(task_id,owner_id,stage,status,event_type,summary,metadata)
  values(p_task_id,v_owner,'system','confirmed','task.work.completed','Nook produced a saved task result.',
    jsonb_build_object('model',p_model,'graph_version',p_graph_version,'mode',p_mode));
  return v_output;
end $$;
revoke all on function public.nook_store_task_output(uuid,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.nook_store_task_output(uuid,text,text,text,text,text,text,boolean) to authenticated;
