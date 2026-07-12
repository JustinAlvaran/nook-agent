create or replace function private.nook_verify_server_signature(
  p_operation text,p_owner uuid,p_resource text,p_expires_at bigint,p_signature text
) returns boolean language plpgsql security definer set search_path='' stable as $$
declare v_secret text; v_expected text; v_now bigint:=extract(epoch from now())::bigint;
begin
  if p_expires_at < v_now or p_expires_at > v_now+120 or p_signature !~ '^[a-f0-9]{64}$' then return false; end if;
  select secret into v_secret from private.runtime_secrets where key='task_execution_hmac';
  if v_secret is null then return false; end if;
  v_expected:=encode(extensions.hmac(convert_to(concat_ws(':',p_operation,p_owner::text,p_resource,p_expires_at::text),'UTF8'),convert_to(v_secret,'UTF8'),'sha256'),'hex');
  return v_expected=p_signature;
end $$;
revoke all on function private.nook_verify_server_signature(text,uuid,text,bigint,text) from public,anon,authenticated;
