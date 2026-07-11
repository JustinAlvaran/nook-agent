create or replace function public.nook_claim_free_listing(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := auth.uid(); v_product uuid; v_version uuid; v_entitlement uuid;
begin
  if v_owner is null then raise exception 'authentication required' using errcode='42501'; end if;
  select p.id,pv.id into v_product,v_version
  from public.listings l join public.product_versions pv on pv.id=l.product_version_id
  join public.products p on p.id=pv.product_id join public.prices pr on pr.listing_id=l.id and pr.active
  where l.id=p_listing_id and l.status='published' and p.status='published' and pr.unit_amount=0;
  if v_product is null then raise exception 'free listing unavailable' using errcode='P0002'; end if;
  insert into public.entitlements(owner_id,product_id,product_version_id,grant_key)
  values(v_owner,v_product,v_version,'free:'||v_owner::text||':'||p_listing_id::text)
  on conflict(grant_key) do update set status='active',revoked_at=null
  returning id into v_entitlement;
  return v_entitlement;
end $$;
revoke all on function public.nook_claim_free_listing(uuid) from public, anon;
grant execute on function public.nook_claim_free_listing(uuid) to authenticated;

create or replace function public.nook_create_checkout_order(p_owner_id uuid,p_listing_id uuid)
returns table(order_id uuid,order_item_id uuid,title text,unit_amount bigint,currency text)
language plpgsql security definer set search_path = '' as $$
declare v_product uuid; v_version uuid; v_title text; v_amount bigint; v_currency text; v_order uuid; v_item uuid;
begin
  if not exists(select 1 from public.profiles where id=p_owner_id) then raise exception 'profile unavailable' using errcode='P0002'; end if;
  select p.id,pv.id,p.name,pr.unit_amount,pr.currency into v_product,v_version,v_title,v_amount,v_currency
  from public.listings l join public.product_versions pv on pv.id=l.product_version_id
  join public.products p on p.id=pv.product_id join public.prices pr on pr.listing_id=l.id and pr.active
  where l.id=p_listing_id and l.status='published' and p.status='published' and pr.unit_amount>0;
  if v_product is null then raise exception 'paid listing unavailable' using errcode='P0002'; end if;
  insert into public.orders(owner_id,status,currency,subtotal_amount,total_amount)
    values(p_owner_id,'pending',v_currency,v_amount,v_amount) returning id into v_order;
  insert into public.order_items(order_id,product_id,product_version_id,listing_id,title_snapshot,currency,unit_amount)
    values(v_order,v_product,v_version,p_listing_id,v_title,v_currency,v_amount) returning id into v_item;
  return query select v_order,v_item,v_title,v_amount,v_currency;
end $$;

create or replace function public.nook_store_payment_session(
  p_order_id uuid,p_provider_session_id text,p_idempotency_key text,p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.payment_sessions(order_id,provider_session_id,idempotency_key,expires_at)
  values(p_order_id,p_provider_session_id,p_idempotency_key,p_expires_at)
  on conflict(order_id) do update set provider_session_id=excluded.provider_session_id,
    idempotency_key=excluded.idempotency_key,expires_at=excluded.expires_at,updated_at=now();
end $$;

create or replace function public.nook_process_stripe_webhook(p_event_id text,p_event_type text,p_payload jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare v_order uuid; v_payment text; v_currency text; v_amount bigint; v_existing text;
begin
  select status into v_existing from private.webhook_inbox where provider='stripe' and provider_event_id=p_event_id;
  if v_existing='processed' then return 'duplicate'; end if;
  insert into private.webhook_inbox(provider,provider_event_id,event_type,payload,status,attempts)
    values('stripe',p_event_id,p_event_type,p_payload,'processing',1)
    on conflict(provider,provider_event_id) do update set status='processing',attempts=private.webhook_inbox.attempts+1,updated_at=now();

  if p_event_type='checkout.session.completed' and p_payload#>>'{data,object,payment_status}'='paid' then
    v_order := (p_payload#>>'{data,object,metadata,order_id}')::uuid;
    v_payment := coalesce(p_payload#>>'{data,object,payment_intent}',p_payload#>>'{data,object,id}');
    v_currency := upper(p_payload#>>'{data,object,currency}');
    v_amount := coalesce((p_payload#>>'{data,object,amount_total}')::bigint,0);
    update public.orders set status='paid',paid_at=coalesce(paid_at,now()),updated_at=now() where id=v_order and status in ('pending','paid');
    if not found then raise exception 'order unavailable for payment event' using errcode='P0002'; end if;
    insert into private.payment_records(order_id,provider_payment_id,status,currency,amount)
      values(v_order,v_payment,'paid',v_currency,v_amount)
      on conflict(provider,provider_payment_id) do update set status='paid',updated_at=now();
    insert into public.entitlements(owner_id,product_id,product_version_id,source_order_item_id,grant_key)
      select o.owner_id,oi.product_id,oi.product_version_id,oi.id,'stripe:'||v_payment||':'||oi.id::text
      from public.order_items oi join public.orders o on o.id=oi.order_id where oi.order_id=v_order
      on conflict(grant_key) do nothing;
  elsif p_event_type in ('charge.refunded','refund.updated') then
    v_payment := coalesce(p_payload#>>'{data,object,payment_intent}',p_payload#>>'{data,object,charge}');
    select order_id into v_order from private.payment_records where provider='stripe' and provider_payment_id=v_payment;
    if v_order is not null then
      update public.orders set status='refunded',updated_at=now() where id=v_order;
      update public.entitlements set status='revoked',revoked_at=now() where source_order_item_id in (select id from public.order_items where order_id=v_order);
    end if;
  elsif p_event_type='charge.dispute.created' then
    v_payment := p_payload#>>'{data,object,payment_intent}';
    select order_id into v_order from private.payment_records where provider='stripe' and provider_payment_id=v_payment;
    if v_order is not null then
      update public.orders set status='disputed',updated_at=now() where id=v_order;
      update public.entitlements set status='suspended' where source_order_item_id in (select id from public.order_items where order_id=v_order);
    end if;
  end if;
  update private.webhook_inbox set status='processed',processed_at=now(),updated_at=now()
    where provider='stripe' and provider_event_id=p_event_id;
  return 'processed';
end $$;

revoke all on function public.nook_create_checkout_order(uuid,uuid) from public, anon, authenticated;
revoke all on function public.nook_store_payment_session(uuid,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.nook_process_stripe_webhook(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.nook_create_checkout_order(uuid,uuid) to service_role;
grant execute on function public.nook_store_payment_session(uuid,text,text,timestamptz) to service_role;
grant execute on function public.nook_process_stripe_webhook(text,text,jsonb) to service_role;
