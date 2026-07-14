create index if not exists memory_proposals_review_match_idx
  on public.memory_proposals(owner_id,nook_id,kind,content)
  where status='proposed';

drop policy if exists nook_memories_owner_insert on public.nook_memories;
create policy nook_memories_owner_insert on public.nook_memories
  for insert to authenticated with check (
    (select auth.uid())=owner_id
    and exists(
      select 1 from public.nooks n
      where n.id=nook_id and n.owner_id=(select auth.uid())
    )
    and (
      source='taught'
      or (
        source='task'
        and exists(
          select 1 from public.memory_proposals p
          where p.owner_id=(select auth.uid())
            and p.nook_id=nook_memories.nook_id
            and p.kind=nook_memories.kind
            and p.content=nook_memories.content
            and p.status='proposed'
        )
      )
    )
  );

drop policy if exists nook_memories_owner_update on public.nook_memories;
create policy nook_memories_owner_update on public.nook_memories
  for update to authenticated
  using ((select auth.uid())=owner_id)
  with check (
    (select auth.uid())=owner_id
    and exists(
      select 1 from public.nooks n
      where n.id=nook_id and n.owner_id=(select auth.uid())
    )
    and (
      source='taught'
      or (
        source='task'
        and exists(
          select 1 from public.memory_proposals p
          where p.owner_id=(select auth.uid())
            and p.nook_id=nook_memories.nook_id
            and p.kind=nook_memories.kind
            and p.content=nook_memories.content
            and p.status in ('proposed','active')
        )
      )
    )
  );

create or replace function public.nook_review_memory_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_content text default null
)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  v_owner uuid:=(select auth.uid());
  v_proposal public.memory_proposals;
  v_memory_id uuid;
  v_source text;
begin
  if v_owner is null then raise exception 'authentication_required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'invalid_decision'; end if;
  select * into v_proposal
    from public.memory_proposals
    where id=p_proposal_id and owner_id=v_owner and status='proposed'
    for update;
  if not found then raise exception 'proposal_not_found'; end if;
  if v_proposal.expires_at is not null and v_proposal.expires_at<=now() then
    update public.memory_proposals set status='expired',reviewed_at=now()
      where id=v_proposal.id;
    raise exception 'proposal_expired';
  end if;
  if p_decision='reject' then
    update public.memory_proposals set status='rejected',reviewed_at=now()
      where id=v_proposal.id;
    return null;
  end if;
  if p_content is not null then
    if char_length(trim(p_content)) not between 2 and 500 then
      raise exception 'invalid_content';
    end if;
    update public.memory_proposals set content=trim(p_content)
      where id=v_proposal.id;
    v_proposal.content:=trim(p_content);
  end if;
  v_source:=case when v_proposal.source_task_id is null then 'taught' else 'task' end;
  insert into public.nook_memories(
    owner_id,nook_id,kind,content,source,status,expires_at
  ) values(
    v_owner,v_proposal.nook_id,v_proposal.kind,v_proposal.content,v_source,'active',v_proposal.expires_at
  )
  on conflict(owner_id,nook_id,kind,content) do update
    set status='active',expires_at=excluded.expires_at,updated_at=now()
  returning id into v_memory_id;
  update public.memory_proposals set status='active',reviewed_at=now()
    where id=v_proposal.id;
  return v_memory_id;
end $$;

revoke all on function public.nook_review_memory_proposal(uuid,text,text) from public,anon;
grant execute on function public.nook_review_memory_proposal(uuid,text,text) to authenticated;
