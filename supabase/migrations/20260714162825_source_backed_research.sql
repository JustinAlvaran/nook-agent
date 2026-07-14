create table public.research_runs(
 id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id) on delete cascade,owner_id uuid not null references public.profiles(id) on delete cascade,
 query text not null check(char_length(query) between 1 and 500),freshness text not null check(freshness in('any','recent','current')),provider text not null,status text not null check(status in('running','succeeded','failed')),
 searched_at timestamptz not null default now(),metadata jsonb not null default '{}'::jsonb
);
create index research_runs_task_idx on public.research_runs(task_id,searched_at desc);create index research_runs_owner_idx on public.research_runs(owner_id,searched_at desc);
create table public.research_sources(
 id uuid primary key default gen_random_uuid(),research_run_id uuid not null references public.research_runs(id) on delete cascade,title text not null,url text not null,source_name text not null,
 published_at timestamptz,retrieved_at timestamptz not null,snippet text not null check(char_length(snippet)<=1000),content_hash text not null,unique(research_run_id,url)
);
create index research_sources_run_idx on public.research_sources(research_run_id);
alter table public.research_runs enable row level security;alter table public.research_sources enable row level security;
revoke all on public.research_runs,public.research_sources from public,anon,authenticated;grant select,insert,update on public.research_runs to authenticated;grant select,insert on public.research_sources to authenticated;grant all on public.research_runs,public.research_sources to service_role;
create policy research_runs_owner_select on public.research_runs for select to authenticated using((select auth.uid())=owner_id);
create policy research_runs_owner_insert on public.research_runs for insert to authenticated with check((select auth.uid())=owner_id and exists(select 1 from public.tasks t where t.id=task_id and t.owner_id=(select auth.uid())));
create policy research_runs_owner_update on public.research_runs for update to authenticated using((select auth.uid())=owner_id) with check((select auth.uid())=owner_id);
create policy research_sources_owner_select on public.research_sources for select to authenticated using(exists(select 1 from public.research_runs r where r.id=research_run_id and r.owner_id=(select auth.uid())));
create policy research_sources_owner_insert on public.research_sources for insert to authenticated with check(exists(select 1 from public.research_runs r where r.id=research_run_id and r.owner_id=(select auth.uid())));
