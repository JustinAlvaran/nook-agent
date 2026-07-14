alter table public.nook_memories drop constraint if exists nook_memories_kind_check;
alter table public.nook_memories add constraint nook_memories_kind_check
  check (kind in ('profile','preference','project','workflow','correction','temporary','instruction','context'));
alter table public.nook_memories add column if not exists expires_at timestamptz;
alter table public.nook_memories add column if not exists pinned boolean not null default false;
alter table public.nook_memories add column if not exists usefulness_count integer not null default 0 check (usefulness_count >= 0);

create table public.memory_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nook_id uuid not null references public.nooks(id) on delete cascade,
  source_task_id uuid references public.tasks(id) on delete set null,
  kind text not null check (kind in ('profile','preference','project','workflow','correction')),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 2 and 500),
  reason text not null check (char_length(reason) between 1 and 300),
  confidence double precision not null check (confidence between 0 and 1),
  status text not null default 'proposed' check (status in ('proposed','active','rejected','expired','deleted')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index memory_proposals_owner_status_idx on public.memory_proposals(owner_id,status,created_at desc);
create index memory_proposals_task_idx on public.memory_proposals(source_task_id) where source_task_id is not null;

create table public.task_memory_usage (
  task_id uuid not null references public.tasks(id) on delete cascade,
  memory_id uuid not null references public.nook_memories(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 300),
  created_at timestamptz not null default now(),
  primary key(task_id,memory_id)
);
create index task_memory_usage_owner_idx on public.task_memory_usage(owner_id,created_at desc);

alter table public.memory_proposals enable row level security;
alter table public.task_memory_usage enable row level security;
revoke all on public.memory_proposals,public.task_memory_usage from public,anon,authenticated;
grant select,insert,update,delete on public.memory_proposals to authenticated;
grant select,insert on public.task_memory_usage to authenticated;
grant all on public.memory_proposals,public.task_memory_usage to service_role;

create policy memory_proposals_owner_select on public.memory_proposals for select to authenticated using ((select auth.uid())=owner_id);
create policy memory_proposals_owner_insert on public.memory_proposals for insert to authenticated with check (
  (select auth.uid())=owner_id and status='proposed'
  and exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid()))
  and (source_task_id is null or exists(select 1 from public.tasks t where t.id=source_task_id and t.owner_id=(select auth.uid())))
);
create policy memory_proposals_owner_update on public.memory_proposals for update to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy memory_proposals_owner_delete on public.memory_proposals for delete to authenticated using ((select auth.uid())=owner_id);
create policy task_memory_usage_owner_select on public.task_memory_usage for select to authenticated using ((select auth.uid())=owner_id);
create policy task_memory_usage_owner_insert on public.task_memory_usage for insert to authenticated with check (
  (select auth.uid())=owner_id
  and exists(select 1 from public.tasks t where t.id=task_id and t.owner_id=(select auth.uid()))
  and exists(select 1 from public.nook_memories m where m.id=memory_id and m.owner_id=(select auth.uid()) and m.status='active' and (m.expires_at is null or m.expires_at>now()))
);

create trigger memory_proposals_touch_updated_at before update on public.memory_proposals for each row execute function private.touch_updated_at();

create or replace function public.nook_review_memory_proposal(p_proposal_id uuid,p_decision text,p_content text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_owner uuid:=(select auth.uid());v_proposal public.memory_proposals;v_memory_id uuid;
begin
  if v_owner is null then raise exception 'authentication_required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid_decision'; end if;
  select * into v_proposal from public.memory_proposals where id=p_proposal_id and owner_id=v_owner and status='proposed' for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.expires_at is not null and v_proposal.expires_at<=now() then
    update public.memory_proposals set status='expired',reviewed_at=now() where id=v_proposal.id;raise exception 'proposal_expired';
  end if;
  if p_decision='reject' then update public.memory_proposals set status='rejected',reviewed_at=now() where id=v_proposal.id;return null;end if;
  if p_content is not null then
    if char_length(trim(p_content)) not between 2 and 500 then raise exception 'invalid_content';end if;
    update public.memory_proposals set content=trim(p_content) where id=v_proposal.id;
    v_proposal.content:=trim(p_content);
  end if;
  insert into public.nook_memories(owner_id,nook_id,kind,content,source,status,expires_at)
  values(v_owner,v_proposal.nook_id,v_proposal.kind,v_proposal.content,'task','active',v_proposal.expires_at)
  on conflict(owner_id,nook_id,kind,content) do update set status='active',expires_at=excluded.expires_at,updated_at=now()
  returning id into v_memory_id;
  update public.memory_proposals set status='active',reviewed_at=now() where id=v_proposal.id;
  return v_memory_id;
end $$;
revoke all on function public.nook_review_memory_proposal(uuid,text,text) from public,anon;
grant execute on function public.nook_review_memory_proposal(uuid,text,text) to authenticated;
