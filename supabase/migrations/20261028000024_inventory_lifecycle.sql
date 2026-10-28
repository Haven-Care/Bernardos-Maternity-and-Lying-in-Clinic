-- Keep physical stock, usable stock, and the historical ledger distinct.
begin;

alter table public.medicines
  add column target_stock_level integer,
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles(id) on delete set null,
  add constraint medicine_target_stock check(target_stock_level is null or target_stock_level >= reorder_level);
alter table public.medicine_batches
  add column manufacturer_lot text,
  add column quarantined boolean not null default false,
  add column quarantine_reason text,
  add column closed_reason text check(closed_reason in ('depleted','disposed'));
-- Existing references and notes are retained without guessing their meaning.
create unique index medicine_manufacturer_lot on public.medicine_batches(medicine_id,manufacturer_lot) where manufacturer_lot is not null;
alter table public.stock_movements
  add column reason text not null default 'legacy' check(reason in ('legacy','received','dispensed','disposed','adjustment','reversal')),
  add column quantity_before integer,
  add column quantity_after integer,
  add column reverses_movement_id uuid references public.stock_movements(id) on delete restrict,
  add column created_by_name text,
  add column medicine_snapshot jsonb,
  add column batch_snapshot jsonb;
create unique index stock_movement_single_reversal on public.stock_movements(reverses_movement_id) where reverses_movement_id is not null;

create table public.inventory_batch_events(
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.medicine_batches(id) on delete restrict,
  action text not null check(action in ('quarantined','released')),
  reason text not null check(length(trim(reason))>0),
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  occurred_at timestamptz not null default now()
);
alter table public.inventory_batch_events enable row level security;
create index inventory_batch_events_batch_time_idx on public.inventory_batch_events(batch_id,occurred_at desc,id);
create index stock_movements_batch_time_idx on public.stock_movements(batch_id,occurred_at desc,id);

create or replace view public.medicine_stock with(security_invoker=true) as
select m.id,m.generic_name,m.brand_name,m.category,m.dosage_form,m.dosage,m.unit,m.reorder_level,
  m.unit_cost,m.selling_price,m.supplier_name,m.supplier_contact,m.storage_location,m.active,m.created_at,m.updated_at,
  coalesce(b.available,0) as qty_on_hand,b.nearest_expiry,
  (case when coalesce(b.available,0)=0 then 'out' when b.available <= m.reorder_level then 'low' else 'good' end)::stock_status as stock_status,
  m.target_stock_level,m.archived_at,m.archived_by,
  coalesce(b.physical,0) as physical_qty,coalesce(b.expired,0) as expired_qty,
  coalesce(b.quarantined,0) as quarantined_qty,coalesce(b.batch_count,0) as batch_count
from public.medicines m left join lateral (
  select sum(quantity) as physical,
    coalesce(sum(quantity) filter(where expires_at>=clinic_today() and not quarantined),0) as available,
    coalesce(sum(quantity) filter(where expires_at<clinic_today()),0) as expired,
    coalesce(sum(quantity) filter(where expires_at>=clinic_today() and quarantined),0) as quarantined,
    min(expires_at) filter(where quantity>0 and expires_at>=clinic_today() and not quarantined) as nearest_expiry,
    count(*) as batch_count
  from public.medicine_batches where medicine_id=m.id
) b on true;

create function public.inventory_actor(p_actor uuid) returns void language plpgsql set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from profiles where id=p_actor and status='active') then
    raise exception 'An active staff account is required.' using errcode='HC400';
  end if;
end; $$;

-- Every new movement captures before/after and immutable identity snapshots.
create function public.inventory_log(p_batch medicine_batches,p_type stock_movement_type,p_qty integer,p_before integer,p_reason text,p_note text,p_actor uuid,p_reverses uuid default null)
returns void language plpgsql set search_path=public,pg_temp as $$
begin
  insert into stock_movements(batch_id,medicine_id,type,quantity,note,created_by,reason,quantity_before,quantity_after,reverses_movement_id,created_by_name,medicine_snapshot,batch_snapshot)
  select p_batch.id,p_batch.medicine_id,p_type,p_qty,coalesce(p_note,''),p_actor,p_reason,p_before,p_batch.quantity,p_reverses,(select full_name from profiles where id=p_actor),
    jsonb_build_object('genericName',m.generic_name,'brandName',m.brand_name,'dosage',m.dosage,'dosageForm',m.dosage_form,'unit',m.unit),
    jsonb_build_object('batchNo',p_batch.batch_no,'manufacturerLot',p_batch.manufacturer_lot,'expiresAt',p_batch.expires_at)
  from medicines m where m.id=p_batch.medicine_id;
end; $$;

create or replace function public.record_stock_in(p_medicine_id uuid,p_batch_no text,p_quantity integer,p_expires_at date,p_note text,p_actor uuid)
returns medicine_batches language plpgsql set search_path=public,pg_temp as $$
declare b medicine_batches; before_qty integer; batch_ref text:=coalesce(nullif(trim(p_batch_no),''),'B-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)));
begin
  perform inventory_actor(p_actor);
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero.' using errcode='HC400'; end if;
  if p_expires_at is null or p_expires_at<clinic_today() then raise exception 'Cannot receive expired stock.' using errcode='HC400'; end if;
  if length(batch_ref)>64 or batch_ref !~ '^[A-Za-z0-9#_./ -]+$' or batch_ref !~ '[A-Za-z0-9]' then raise exception 'Invalid batch reference.' using errcode='HC400'; end if;
  perform 1 from medicines where id=p_medicine_id and active for update;
  if not found then raise exception 'Choose an active medicine.' using errcode='HC409'; end if;
  perform pg_advisory_xact_lock(hashtext(p_medicine_id::text||' '||batch_ref)::bigint);
  select * into b from medicine_batches where medicine_id=p_medicine_id and batch_no=batch_ref for update;
  if found then
    if b.expires_at<>p_expires_at then raise exception 'This batch has a different expiry date.' using errcode='HC409'; end if;
    if b.quarantined or b.closed_reason='disposed' then raise exception 'Cannot receive into a quarantined or disposed batch.' using errcode='HC409'; end if;
    before_qty:=b.quantity;
    update medicine_batches set quantity=quantity+p_quantity,closed_reason=null where id=b.id returning * into b;
  else
    before_qty:=0;
    insert into medicine_batches(medicine_id,batch_no,quantity,expires_at) values(p_medicine_id,batch_ref,p_quantity,p_expires_at) returning * into b;
  end if;
  perform inventory_log(b,'stock_in',p_quantity,before_qty,'received',p_note,p_actor);
  return b;
end; $$;

create function public.receive_inventory_stock(p_medicine_id uuid,p_manufacturer_lot text,p_quantity integer,p_expires_at date,p_note text,p_actor uuid,p_batch_id uuid default null)
returns medicine_batches language plpgsql set search_path=public,pg_temp as $$
declare b medicine_batches; lot text:=nullif(trim(p_manufacturer_lot),''); before_qty integer;
begin
  perform inventory_actor(p_actor);
  if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero.' using errcode='HC400'; end if;
  if p_expires_at is null or p_expires_at<clinic_today() then raise exception 'Cannot receive expired stock.' using errcode='HC400'; end if;
  perform 1 from medicines where id=p_medicine_id and active for update;
  if not found then raise exception 'Choose an active medicine.' using errcode='HC409'; end if;
  if lot is not null and (length(lot)>64 or lot !~ '^[A-Za-z0-9#_./ -]+$' or lot !~ '[A-Za-z0-9]') then raise exception 'Invalid manufacturer lot number.' using errcode='HC400'; end if;
  if p_batch_id is not null then
    select * into b from medicine_batches where id=p_batch_id and medicine_id=p_medicine_id for update;
    if not found then raise exception 'Choose a batch belonging to this medicine.' using errcode='HC400'; end if;
    if b.manufacturer_lot is distinct from lot then raise exception 'Manufacturer lot must match the selected batch.' using errcode='HC409'; end if;
  elsif lot is not null then
    select * into b from medicine_batches where medicine_id=p_medicine_id and manufacturer_lot=lot for update;
  end if;
  -- The medicine row lock serializes same-lot receipts, including first receipt.
  if b.id is not null then
    if b.expires_at<>p_expires_at then raise exception 'This lot already has a different expiry date.' using errcode='HC409'; end if;
    if b.quarantined or b.closed_reason='disposed' then raise exception 'Cannot receive into a quarantined or disposed batch.' using errcode='HC409'; end if;
    before_qty:=b.quantity;
    update medicine_batches set quantity=quantity+p_quantity,closed_reason=null where id=b.id returning * into b;
  else
    before_qty:=0;
    insert into medicine_batches(medicine_id,batch_no,manufacturer_lot,quantity,expires_at)
    values(p_medicine_id,'B-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),lot,p_quantity,p_expires_at) returning * into b;
  end if;
  perform inventory_log(b,'stock_in',p_quantity,before_qty,'received',p_note,p_actor);
  return b;
end; $$;

create function public.move_inventory_stock(p_batch_id uuid,p_quantity integer,p_reason text,p_note text,p_actor uuid)
returns medicine_batches language plpgsql set search_path=public,pg_temp as $$
declare b medicine_batches; before_qty integer; amount integer; direction stock_movement_type;
begin
  perform inventory_actor(p_actor);
  if p_quantity is null or p_quantity=0 then raise exception 'Quantity must not be zero.' using errcode='HC400'; end if;
  if p_reason is null or p_reason not in ('dispensed','disposed','adjustment') then raise exception 'Choose a valid movement reason.' using errcode='HC400'; end if;
  if p_reason<>'dispensed' and length(trim(coalesce(p_note,'')))=0 then raise exception 'A reason is required.' using errcode='HC400'; end if;
  if p_reason<>'adjustment' and p_quantity<0 then raise exception 'Enter a positive quantity.' using errcode='HC400'; end if;
  -- All stock writes lock medicine before batch, matching receipts and archive.
  perform 1 from medicines where id=(select medicine_id from medicine_batches where id=p_batch_id) for update;
  select * into b from medicine_batches where id=p_batch_id for update;
  if not found then raise exception 'That batch does not exist.' using errcode='HC404'; end if;
  if not exists(select 1 from medicines where id=b.medicine_id and active) then raise exception 'Restore this medicine before recording stock.' using errcode='HC409'; end if;
  if p_reason='dispensed' and (b.expires_at<clinic_today() or b.quarantined or b.closed_reason='disposed') then raise exception 'Expired, quarantined, or disposed stock cannot be dispensed.' using errcode='HC409'; end if;
  if p_reason='adjustment' and p_quantity>0 and b.closed_reason='disposed' then raise exception 'A disposed batch cannot be replenished. Create a new batch for a different lot.' using errcode='HC409'; end if;
  amount:=case when p_reason='adjustment' then p_quantity else -p_quantity end;
  before_qty:=b.quantity;
  if b.quantity+amount<0 then raise exception 'Only % units remain in this batch.',b.quantity using errcode='HC409'; end if;
  update medicine_batches set quantity=quantity+amount,
    closed_reason=case when quantity+amount=0 then case when p_reason='disposed' then 'disposed' else 'depleted' end else null end
    where id=b.id returning * into b;
  direction:=case when amount>0 then 'stock_in' else 'stock_out' end;
  perform inventory_log(b,direction,abs(amount),before_qty,p_reason,p_note,p_actor);
  return b;
end; $$;

create or replace function public.record_stock_out(p_batch_id uuid,p_quantity integer,p_note text,p_actor uuid)
returns medicine_batches language plpgsql set search_path=public,pg_temp as $$
begin return move_inventory_stock(p_batch_id,p_quantity,'dispensed',p_note,p_actor); end; $$;

create function public.set_inventory_quarantine(p_batch_id uuid,p_quarantined boolean,p_note text,p_actor uuid)
returns medicine_batches language plpgsql set search_path=public,pg_temp as $$
declare b medicine_batches;
begin
  perform inventory_actor(p_actor);
  if p_quarantined is null or length(trim(coalesce(p_note,'')))=0 then raise exception 'A quarantine/release reason is required.' using errcode='HC400'; end if;
  perform 1 from medicines where id=(select medicine_id from medicine_batches where id=p_batch_id) for update;
  select * into b from medicine_batches where id=p_batch_id for update;
  if not found then raise exception 'No such batch.' using errcode='HC404'; end if;
  if b.quantity=0 then raise exception 'This batch is empty.' using errcode='HC409'; end if;
  if not p_quarantined and b.expires_at<clinic_today() then raise exception 'Expired stock cannot be released for dispensing.' using errcode='HC409'; end if;
  if b.quarantined=p_quarantined then raise exception 'This batch already has that availability state.' using errcode='HC409'; end if;
  update medicine_batches set quarantined=p_quarantined,quarantine_reason=case when p_quarantined then trim(p_note) else null end where id=b.id returning * into b;
  insert into inventory_batch_events(batch_id,action,reason,created_by,created_by_name) values(b.id,case when p_quarantined then 'quarantined' else 'released' end,trim(p_note),p_actor,(select full_name from profiles where id=p_actor));
  return b;
end; $$;

create function public.reverse_inventory_movement(p_movement_id uuid,p_note text,p_actor uuid)
returns medicine_batches language plpgsql set search_path=public,pg_temp as $$
declare movement stock_movements; b medicine_batches; delta integer; before_qty integer;
begin
  perform inventory_actor(p_actor);
  if length(trim(coalesce(p_note,'')))=0 then raise exception 'Explain the correction.' using errcode='HC400'; end if;
  select * into movement from stock_movements where id=p_movement_id;
  if not found then raise exception 'No such movement.' using errcode='HC404'; end if;
  perform 1 from medicines where id=movement.medicine_id and active for update;
  if not found then raise exception 'Restore this medicine before recording corrections.' using errcode='HC409'; end if;
  select * into b from medicine_batches where id=movement.batch_id for update;
  if movement.reason not in ('received','dispensed','adjustment') or b.closed_reason='disposed' then raise exception 'This movement cannot be reversed. Disposal and legacy entries remain historical; record a reasoned adjustment for a count correction.' using errcode='HC409'; end if;
  if exists(select 1 from stock_movements where reverses_movement_id=p_movement_id) then raise exception 'This movement has already been reversed.' using errcode='HC409'; end if;
  delta:=case when movement.type='stock_in' then -movement.quantity else movement.quantity end;
  before_qty:=b.quantity;
  if b.quantity+delta<0 then raise exception 'There is insufficient remaining stock to reverse this receipt.' using errcode='HC409'; end if;
  update medicine_batches set quantity=quantity+delta,closed_reason=case when quantity+delta=0 then 'depleted' else null end where id=b.id returning * into b;
  perform inventory_log(b,case when delta>0 then 'stock_in'::stock_movement_type else 'stock_out'::stock_movement_type end,abs(delta),before_qty,'reversal',p_note,p_actor,movement.id);
  return b;
end; $$;

create function public.archive_inventory_medicine(p_medicine_id uuid,p_archive boolean,p_actor uuid)
returns medicines language plpgsql set search_path=public,pg_temp as $$
declare m medicines;
begin
  perform inventory_actor(p_actor);
  if p_archive is null then raise exception 'Choose archive or restore.' using errcode='HC400'; end if;
  select * into m from medicines where id=p_medicine_id for update;
  if not found then raise exception 'No such medicine.' using errcode='HC404'; end if;
  if p_archive and exists(select 1 from medicine_batches where medicine_id=m.id and quantity>0) then raise exception 'Resolve remaining stock through dispensing, disposal, or a documented adjustment before archiving.' using errcode='HC409'; end if;
  update medicines set active=not p_archive,archived_at=case when p_archive then now() else null end,archived_by=case when p_archive then p_actor else null end where id=m.id returning * into m;
  return m;
end; $$;

create function public.protect_inventory_history() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and pg_trigger_depth()>1 and new.created_by is null
    and (to_jsonb(new)-'created_by')=(to_jsonb(old)-'created_by') then return new; end if;
  raise exception 'Inventory history is append-only. Record a correction instead.' using errcode='HC409';
end; $$;
create trigger stock_movement_immutable before update or delete on public.stock_movements for each row execute function public.protect_inventory_history();
create trigger inventory_event_immutable before update or delete on public.inventory_batch_events for each row execute function public.protect_inventory_history();
create function public.protect_inventory_unit() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.unit is distinct from old.unit and exists(select 1 from medicine_batches where medicine_id=old.id) then raise exception 'The inventory unit cannot change after batch history exists. Create a separate medicine entry for a different unit.' using errcode='HC409'; end if;
  return new;
end; $$;
create trigger medicine_unit_history before update of unit on public.medicines for each row execute function public.protect_inventory_unit();

revoke execute on function public.inventory_actor(uuid), public.inventory_log(medicine_batches,stock_movement_type,integer,integer,text,text,uuid,uuid), public.receive_inventory_stock(uuid,text,integer,date,text,uuid,uuid), public.move_inventory_stock(uuid,integer,text,text,uuid), public.set_inventory_quarantine(uuid,boolean,text,uuid), public.reverse_inventory_movement(uuid,text,uuid), public.archive_inventory_medicine(uuid,boolean,uuid), public.protect_inventory_history(),public.protect_inventory_unit() from public,anon,authenticated;
grant execute on function public.inventory_actor(uuid), public.inventory_log(medicine_batches,stock_movement_type,integer,integer,text,text,uuid,uuid), public.receive_inventory_stock(uuid,text,integer,date,text,uuid,uuid), public.move_inventory_stock(uuid,integer,text,text,uuid), public.set_inventory_quarantine(uuid,boolean,text,uuid), public.reverse_inventory_movement(uuid,text,uuid), public.archive_inventory_medicine(uuid,boolean,uuid), public.protect_inventory_history(),public.protect_inventory_unit() to service_role;

-- Update all preset dashboard counts to the same inclusive usable-stock rule.
do $$ declare definition text; begin
  select pg_get_functiondef('public.dashboard_stats(text)'::regprocedure) into definition;
  execute replace(definition,'qty_on_hand < reorder_level','qty_on_hand <= reorder_level');
end; $$;
select public.assert_rls_posture();
notify pgrst, 'reload schema';
commit;
