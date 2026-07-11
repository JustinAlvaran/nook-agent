-- Cover every foreign key reported by the Supabase performance advisor.
create index if not exists payment_records_order_idx on private.payment_records(order_id);
create index if not exists action_receipts_step_task_idx on public.action_receipts(step_id, task_id);
create index if not exists approvals_step_task_idx on public.approvals(step_id, task_id);
create index if not exists approvals_task_idx on public.approvals(task_id);
create index if not exists capability_grants_device_idx on public.capability_grants(device_id);
create index if not exists capability_grants_nook_idx on public.capability_grants(nook_id);
create index if not exists entitlements_product_idx on public.entitlements(product_id);
create index if not exists entitlements_version_idx on public.entitlements(product_version_id);
create index if not exists entitlements_order_item_idx on public.entitlements(source_order_item_id);
create index if not exists nook_loadout_entitlement_idx on public.nook_loadout(entitlement_id);
create index if not exists nooks_active_appearance_idx on public.nooks(active_appearance_id, id);
create index if not exists order_items_listing_idx on public.order_items(listing_id);
create index if not exists order_items_product_idx on public.order_items(product_id);
create index if not exists order_items_version_idx on public.order_items(product_version_id);
create index if not exists product_versions_preview_asset_idx on public.product_versions(preview_asset_id);
create index if not exists product_versions_primary_asset_idx on public.product_versions(primary_asset_id);
create index if not exists tasks_current_step_idx on public.tasks(current_step_id, id);
