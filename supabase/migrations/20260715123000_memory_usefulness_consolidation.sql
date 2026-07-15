create or replace function private.nook_consolidate_memory_usefulness()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.nook_memories
  set usefulness_count = usefulness_count + 1,
      updated_at = now()
  where id = new.memory_id
    and owner_id = new.owner_id
    and status = 'active';
  return new;
end;
$$;

drop trigger if exists task_memory_usage_consolidate on public.task_memory_usage;
create trigger task_memory_usage_consolidate
after insert on public.task_memory_usage
for each row execute function private.nook_consolidate_memory_usefulness();

comment on function private.nook_consolidate_memory_usefulness() is
  'Consolidates demonstrated memory use into a bounded retrieval signal; it never creates or activates memory.';
