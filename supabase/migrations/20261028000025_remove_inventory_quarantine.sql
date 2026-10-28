-- Retire quarantine without rewriting existing quantities or append-only history.
begin;

-- Keep the legacy columns for compatibility and historical metadata only.
-- Available stock now includes every unexpired batch with remaining units.
create or replace view public.medicine_stock with(security_invoker=true) as
select m.id,m.generic_name,m.brand_name,m.category,m.dosage_form,m.dosage,m.unit,m.reorder_level,
  m.unit_cost,m.selling_price,m.supplier_name,m.supplier_contact,m.storage_location,m.active,m.created_at,m.updated_at,
  coalesce(b.available,0) as qty_on_hand,b.nearest_expiry,
  (case when coalesce(b.available,0)=0 then 'out' when b.available <= m.reorder_level then 'low' else 'good' end)::stock_status as stock_status,
  m.target_stock_level,m.archived_at,m.archived_by,
  coalesce(b.physical,0) as physical_qty,coalesce(b.expired,0) as expired_qty,
  0::bigint as quarantined_qty,coalesce(b.batch_count,0) as batch_count
from public.medicines m left join lateral (
  select sum(quantity) as physical,
    coalesce(sum(quantity) filter(where expires_at>=clinic_today()),0) as available,
    coalesce(sum(quantity) filter(where expires_at<clinic_today()),0) as expired,
    min(expires_at) filter(where quantity>0 and expires_at>=clinic_today()) as nearest_expiry,
    count(*) as batch_count
  from public.medicine_batches where medicine_id=m.id
) b on true;


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
    if b.closed_reason='disposed' then raise exception 'Cannot receive into a disposed batch.' using errcode='HC409'; end if;
    before_qty:=b.quantity;
    update medicine_batches set quantity=quantity+p_quantity,closed_reason=null where id=b.id returning * into b;
  else
    before_qty:=0;
    insert into medicine_batches(medicine_id,batch_no,quantity,expires_at) values(p_medicine_id,batch_ref,p_quantity,p_expires_at) returning * into b;
  end if;
  perform inventory_log(b,'stock_in',p_quantity,before_qty,'received',p_note,p_actor);
  return b;
end; $$;

create or replace function public.receive_inventory_stock(p_medicine_id uuid,p_manufacturer_lot text,p_quantity integer,p_expires_at date,p_note text,p_actor uuid,p_batch_id uuid default null)
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
    if b.closed_reason='disposed' then raise exception 'Cannot receive into a disposed batch.' using errcode='HC409'; end if;
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

create or replace function public.move_inventory_stock(p_batch_id uuid,p_quantity integer,p_reason text,p_note text,p_actor uuid)
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
  if p_reason='dispensed' and (b.expires_at<clinic_today() or b.closed_reason='disposed') then raise exception 'Expired or disposed stock cannot be dispensed.' using errcode='HC409'; end if;
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


drop function public.set_inventory_quarantine(uuid,boolean,text,uuid);
comment on column public.medicine_batches.quarantined is 'Retired historical flag; does not affect stock availability.';
comment on column public.medicine_batches.quarantine_reason is 'Retired historical metadata; see inventory_batch_events for the immutable audit trail.';
select public.assert_rls_posture();
notify pgrst, 'reload schema';
commit;
