alter table public.nooks
  add column if not exists behavior_settings jsonb not null default '{"initiative":"balanced","explanationDepth":"clear","updateFrequency":"milestones"}'::jsonb
  check (jsonb_typeof(behavior_settings) = 'object');

create table if not exists public.nook_memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nook_id uuid not null references public.nooks(id) on delete cascade,
  kind text not null check (kind in ('preference','instruction','context')),
  content text not null check (char_length(content) between 2 and 500),
  source text not null default 'taught' check (source in ('taught','task','onboarding')),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id,nook_id,kind,content)
);
create index if not exists nook_memories_owner_nook_idx on public.nook_memories(owner_id,nook_id,status,updated_at desc);

create table if not exists public.task_outputs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 300),
  result_markdown text not null check (char_length(result_markdown) between 1 and 20000),
  model text not null,
  graph_version text not null,
  prompt_version text not null,
  mode text not null default 'work' check (mode in ('work','draft_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists task_outputs_owner_idx on public.task_outputs(owner_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array['nook_memories','task_outputs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('grant select,insert,update,delete on public.%I to service_role',t);
  end loop;
end $$;

drop policy if exists nook_memories_owner_select on public.nook_memories;
create policy nook_memories_owner_select on public.nook_memories for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists nook_memories_owner_insert on public.nook_memories;
create policy nook_memories_owner_insert on public.nook_memories for insert to authenticated with check (
  (select auth.uid())=owner_id and exists(select 1 from public.nooks n where n.id=nook_id and n.owner_id=(select auth.uid()))
);
drop policy if exists nook_memories_owner_update on public.nook_memories;
create policy nook_memories_owner_update on public.nook_memories for update to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
drop policy if exists nook_memories_owner_delete on public.nook_memories;
create policy nook_memories_owner_delete on public.nook_memories for delete to authenticated using ((select auth.uid())=owner_id);

drop policy if exists task_outputs_owner_select on public.task_outputs;
create policy task_outputs_owner_select on public.task_outputs for select to authenticated using ((select auth.uid())=owner_id);
drop policy if exists task_outputs_owner_insert on public.task_outputs;
create policy task_outputs_owner_insert on public.task_outputs for insert to authenticated with check (
  (select auth.uid())=owner_id and exists(select 1 from public.tasks t where t.id=task_id and t.owner_id=(select auth.uid()))
);
drop policy if exists task_outputs_owner_update on public.task_outputs;
create policy task_outputs_owner_update on public.task_outputs for update to authenticated
  using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

drop trigger if exists nook_memories_touch_updated_at on public.nook_memories;
create trigger nook_memories_touch_updated_at before update on public.nook_memories for each row execute function private.touch_updated_at();
drop trigger if exists task_outputs_touch_updated_at on public.task_outputs;
create trigger task_outputs_touch_updated_at before update on public.task_outputs for each row execute function private.touch_updated_at();
