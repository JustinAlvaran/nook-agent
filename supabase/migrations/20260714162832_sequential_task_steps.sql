alter table public.task_steps add column dependency_step_id uuid references public.task_steps(id) on delete set null;
alter table public.task_steps add column attempt integer not null default 0 check(attempt between 0 and 5);
alter table public.task_steps add column verification jsonb;
alter table public.task_steps add column output jsonb;
create index task_steps_dependency_idx on public.task_steps(dependency_step_id) where dependency_step_id is not null;

create or replace function public.nook_create_supervised_task(p_task_id uuid,p_nook_id uuid,p_input text,p_status text,p_risk_class integer,p_plan jsonb,p_steps jsonb,p_approval jsonb,p_expires_at bigint,p_signature text)
returns table(task_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid());v_step_id uuid;v_has_approval boolean:=p_approval is not null and p_approval<>'null'::jsonb;
begin
 if v_owner is null then raise exception 'authentication required' using errcode='42501';end if;
 if not private.nook_verify_server_signature('create_task',v_owner,p_task_id::text,p_expires_at,p_signature) then raise exception 'invalid server authorization' using errcode='42501';end if;
 if char_length(p_input) not between 1 and 1200 or p_status not in('ready','awaiting_approval','blocked') or p_risk_class not between 0 and 3 or jsonb_typeof(p_plan)<>'object' or jsonb_typeof(p_steps)<>'array' or jsonb_array_length(p_steps) not between 1 and 3 then raise exception 'invalid supervised task' using errcode='22023';end if;
 if (p_status='awaiting_approval')<>v_has_approval then raise exception 'approval state mismatch' using errcode='22023';end if;
 if not exists(select 1 from public.nooks where id=p_nook_id and owner_id=v_owner)then raise exception 'Nook not found' using errcode='P0002';end if;
 v_step_id:=(p_steps->0->>'id')::uuid;
 insert into public.tasks(id,owner_id,nook_id,input,status,risk_class,plan,current_step_id)values(p_task_id,v_owner,p_nook_id,p_input,p_status,p_risk_class,p_plan,v_step_id);
 insert into public.task_steps(id,task_id,ordinal,title,detail,kind,status,requires_approval,action_id,action_hash,tool_name,tool_version,tool_input,dependency_step_id)
 select x.id,p_task_id,x.ordinal,x.title,x.detail,x.kind,x.status,x.requires_approval,x.action_id,x.action_hash,x.tool_name,x.tool_version,x.tool_input,x.dependency_step_id
 from jsonb_to_recordset(p_steps)as x(id uuid,ordinal integer,title text,detail text,kind text,status text,requires_approval boolean,action_id text,action_hash text,tool_name text,tool_version text,tool_input jsonb,dependency_step_id uuid);
 if exists(select 1 from public.task_steps s left join public.task_steps d on d.id=s.dependency_step_id and d.task_id=s.task_id where s.task_id=p_task_id and s.dependency_step_id is not null and(d.id is null or d.ordinal>=s.ordinal))then raise exception 'invalid step dependency' using errcode='22023';end if;
 if v_has_approval then insert into public.approvals(id,task_id,step_id,owner_id,action_id,action_hash,risk_class,status,intent,expires_at)values((p_approval->>'id')::uuid,p_task_id,(p_approval->>'step_id')::uuid,v_owner,p_approval->>'action_id',p_approval->>'action_hash',(p_approval->>'risk_class')::smallint,'pending',p_approval->'intent',(p_approval->>'expires_at')::timestamptz);end if;
 insert into public.task_events(task_id,owner_id,event_type,message,metadata)values(p_task_id,v_owner,'task.planned','Nook saved a policy-checked sequential plan.',jsonb_build_object('risk_class',p_risk_class,'status',p_status,'step_count',jsonb_array_length(p_steps)));
 return query select p_task_id,p_status;
end $$;

create or replace function public.nook_finish_supervised_run(p_task_id uuid,p_run_id uuid,p_summary text,p_result_markdown text,p_model text,p_graph_version text,p_prompt_version text,p_metadata jsonb,p_verification jsonb,p_expires_at bigint,p_signature text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=(select auth.uid());v_task public.tasks;v_step public.task_steps;v_next public.task_steps;v_output uuid;
begin
 if v_owner is null or not private.nook_verify_server_signature('finish_task',v_owner,concat(p_task_id::text,':',p_run_id::text),p_expires_at,p_signature)then raise exception 'invalid server authorization' using errcode='42501';end if;
 if char_length(p_summary)not between 1 and 300 or char_length(p_result_markdown)not between 1 and 20000 or jsonb_typeof(p_metadata)<>'object' or jsonb_typeof(p_verification)<>'object' then raise exception 'invalid result' using errcode='22023';end if;
 select * into v_task from public.tasks where id=p_task_id and owner_id=v_owner for update;if v_task.status<>'running' or v_task.active_run_id is distinct from p_run_id then raise exception 'run changed' using errcode='55000';end if;
 select * into v_step from public.task_steps where id=v_task.current_step_id and task_id=p_task_id for update;
 update public.task_executions set status='succeeded',verification=p_verification,completed_at=now()where id=p_run_id;
 update public.task_steps set status='succeeded',attempt=attempt+1,verification=p_verification,output=jsonb_build_object('summary',p_summary,'result_markdown',p_result_markdown,'metadata',p_metadata),updated_at=now()where id=v_step.id;
 select * into v_next from public.task_steps where task_id=p_task_id and dependency_step_id=v_step.id and status='queued' order by ordinal limit 1;
 if found then
  update public.tasks set status='ready',current_step_id=v_next.id,active_run_mode=null,active_run_id=null,updated_at=now()where id=p_task_id;
  insert into public.task_events(task_id,owner_id,event_type,message,metadata)values(p_task_id,v_owner,'task.step.verified','A plan step was verified; its dependent step is now ready.',jsonb_build_object('step_id',v_step.id,'next_step_id',v_next.id));return null;
 end if;
 insert into public.task_outputs(task_id,owner_id,summary,result_markdown,model,graph_version,prompt_version,mode,metadata)values(p_task_id,v_owner,p_summary,p_result_markdown,p_model,p_graph_version,p_prompt_version,'work',p_metadata)returning id into v_output;
 update public.tasks set status='completed',active_run_mode=null,active_run_id=null,completed_at=now(),updated_at=now()where id=p_task_id;
 insert into public.task_events(task_id,owner_id,event_type,message,metadata)values(p_task_id,v_owner,'task.completed','Nook completed every dependent step and verified the final result.',jsonb_build_object('step_id',v_step.id,'output_id',v_output));return v_output;
end $$;
