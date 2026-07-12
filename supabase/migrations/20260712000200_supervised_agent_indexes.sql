create index if not exists task_events_owner_idx on public.task_events(owner_id,created_at desc);
create index if not exists task_executions_step_idx on public.task_executions(step_id,attempt desc);
