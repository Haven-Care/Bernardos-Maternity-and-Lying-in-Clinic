-- Disposable migrated database only. All synthetic records roll back.
begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
('11111111-1111-4111-8111-111111111117','inventory-staff@example.test','{"user_type":"staff"}','{"full_name":"Inventory Test Staff"}');
do $$
declare
  actor uuid:='11111111-1111-4111-8111-111111111117'; med uuid; original uuid; movement uuid; receipt uuid;
  a medicine_batches; b medicine_batches; expired medicine_batches; stock medicine_stock; n integer;
begin
  insert into medicines(generic_name,brand_name,dosage_form,dosage,unit,reorder_level,target_stock_level)
    values('Inventory Test Medicine','Test Brand','Tablet','100mg','pcs',40,80) returning id into med;
  a:=receive_inventory_stock(med,'LOT-A',30,clinic_today()+90,'Delivery 1',actor);
  original:=a.id;
  assert a.manufacturer_lot='LOT-A' and a.batch_no ~ '^B-[A-F0-9]{16}$';
  select id into receipt from stock_movements where batch_id=a.id;
  assert (select quantity_before=0 and quantity_after=30 and reason='received' and created_by_name='Inventory Test Staff' and batch_snapshot->>'manufacturerLot'='LOT-A' and medicine_snapshot->>'unit'='pcs' from stock_movements where id=receipt), 'First receipt must snapshot actual manufacturer lot and initial balance';
  a:=receive_inventory_stock(med,'LOT-A',10,clinic_today()+90,'Delivery 2',actor);
  assert a.id=original and a.quantity=40, 'Matching lots must top up without duplicating batches';
  begin
    perform receive_inventory_stock(med,'LOT-A',1,clinic_today()+91,'Wrong expiry',actor);
    raise exception 'A matching lot cannot change expiry';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform receive_inventory_stock(med,'LOT-X',1,clinic_today()+90,'Wrong lot',actor,a.id);
    raise exception 'A selected batch must retain its manufacturer lot';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform receive_inventory_stock(med,'OLD',1,clinic_today()-1,'Expired receipt',actor);
    raise exception 'Expired receipts must fail';
  exception when sqlstate 'HC400' then null; end;
  b:=receive_inventory_stock(med,'LOT-B',20,clinic_today()+60,'Delivery B',actor);
  b:=set_inventory_quarantine(b.id,true,'Packaging under review',actor);
  -- Simulate an existing expired lot and legacy movement without inventing balances.
  insert into medicine_batches(medicine_id,batch_no,quantity,expires_at) values(med,'OLD-REF',5,clinic_today()-1) returning * into expired;
  insert into stock_movements(batch_id,medicine_id,type,quantity,note,created_by) values(expired.id,med,'stock_in',5,'Original legacy note',actor);
  select * into stock from medicine_stock where id=med;
  assert stock.physical_qty=65 and stock.qty_on_hand=40 and stock.expired_qty=5 and stock.quarantined_qty=20, 'Availability must exclude expired and quarantined quantities exactly once';
  assert stock.stock_status='low' and stock.nearest_expiry=clinic_today()+90, 'Reorder equality triggers low stock; nearest usable expiry excludes held lots';
  begin
    perform record_stock_out(b.id,1,'Attempt held dispense',actor);
    raise exception 'Quarantined stock cannot be dispensed';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform record_stock_out(expired.id,1,'Attempt expired dispense',actor);
    raise exception 'Legacy stock-out must enforce expiry too';
  exception when sqlstate 'HC409' then null; end;
  expired:=set_inventory_quarantine(expired.id,true,'Expired hold',actor);
  begin
    perform set_inventory_quarantine(expired.id,false,'Release expired',actor);
    raise exception 'Expired stock cannot be released';
  exception when sqlstate 'HC409' then null; end;
  select * into stock from medicine_stock where id=med;
  assert stock.expired_qty=5 and stock.quarantined_qty=20, 'Expired quarantine must not double-count held units';
  b:=set_inventory_quarantine(b.id,false,'Packaging cleared',actor);
  assert (select count(*) from inventory_batch_events where batch_id=b.id)=2, 'Quarantine and release must both remain recorded';
  a:=move_inventory_stock(a.id,-4,'adjustment','Verified count correction',actor);
  a:=move_inventory_stock(a.id,4,'adjustment','Verified recount',actor);
  assert a.quantity=40;
  a:=move_inventory_stock(a.id,10,'dispensed','Dispensing reference',actor);
  select id into movement from stock_movements where batch_id=a.id and reason='dispensed';
  assert (select quantity_before=40 and quantity_after=30 from stock_movements where id=movement);
  update medicines set generic_name='Renamed Test Medicine' where id=med;
  assert (select medicine_snapshot->>'genericName'='Inventory Test Medicine' from stock_movements where id=movement), 'Historical identity survives a catalogue rename';
  a:=reverse_inventory_movement(movement,'Wrong dispensing entry',actor);
  assert a.quantity=40 and (select count(*) from stock_movements where reverses_movement_id=movement)=1;
  begin
    perform reverse_inventory_movement(movement,'Again',actor);
    raise exception 'An entry may only be reversed once';
  exception when sqlstate 'HC409' then null; end;
  begin
    update stock_movements set note='Rewritten' where id=movement;
    raise exception 'Movement history cannot be rewritten';
  exception when sqlstate 'HC409' then null; end;
  begin
    delete from inventory_batch_events where batch_id=b.id;
    raise exception 'Availability history cannot be deleted';
  exception when sqlstate 'HC409' then null; end;
  begin
    update medicines set unit='Boxes' where id=med;
    raise exception 'Historical quantities cannot silently change unit';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform archive_inventory_medicine(med,true,actor);
    raise exception 'Remaining physical stock must block archive';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform move_inventory_stock(a.id,41,'dispensed','Overdraw',actor);
    raise exception 'Overdrawing must not change stock or history';
  exception when sqlstate 'HC409' then null; end;
  assert (select count(*) from stock_movements where batch_id=a.id and note='Overdraw')=0;
  begin
    perform move_inventory_stock(a.id,1,'adjustment','',actor);
    raise exception 'Corrections require reasons';
  exception when sqlstate 'HC400' then null; end;
  expired:=move_inventory_stock(expired.id,2,'disposed','Completed physical disposal part 1',actor);
  assert expired.quantity=3, 'Partial disposal keeps the remainder visible';
  expired:=move_inventory_stock(expired.id,3,'disposed','Completed physical disposal part 2',actor);
  assert expired.quantity=0 and expired.closed_reason='disposed';
  select id into movement from stock_movements where batch_id=expired.id and reason='disposed' limit 1;
  begin
    perform reverse_inventory_movement(movement,'Cannot undo actual disposal',actor);
    raise exception 'Physical disposal cannot be reversed';
  exception when sqlstate 'HC409' then null; end;
  begin
    perform receive_inventory_stock(med,'',1,clinic_today()+90,'Cannot refill a disposed batch',actor,expired.id);
    raise exception 'Disposed batches cannot receive stock';
  exception when sqlstate 'HC409' then null; end;
  a:=move_inventory_stock(a.id,40,'dispensed','Final dispense',actor);
  assert a.quantity=0 and a.closed_reason='depleted';
  begin
    perform reverse_inventory_movement(receipt,'Receipt stock already consumed',actor);
    raise exception 'Reversal cannot create a negative balance';
  exception when sqlstate 'HC409' then null; end;
  b:=move_inventory_stock(b.id,20,'disposed','Completed physical disposal B',actor);
  perform archive_inventory_medicine(med,true,actor);
  assert (select not active and archived_at is not null from medicines where id=med);
  assert (select count(*) from medicine_batches where medicine_id=med)=3, 'All lots remain after archive';
  assert (select reason='legacy' and quantity_before is null and quantity_after is null and note='Original legacy note' from stock_movements where batch_id=expired.id and reason='legacy'), 'Legacy facts remain unclassified and unmodified';
  begin
    perform receive_inventory_stock(med,'NEW',1,clinic_today()+90,'Archived',actor);
    raise exception 'Archived medicines cannot receive stock';
  exception when sqlstate 'HC409' then null; end;
  perform archive_inventory_medicine(med,false,actor);
  select * into stock from medicine_stock where id=med;
  assert stock.active and stock.physical_qty=0 and stock.qty_on_hand=0 and stock.stock_status='out';
  select count(*) into n from stock_movements where medicine_id=med;
  assert n>=10, 'Archive must retain the full ledger';
  delete from auth.users where id=actor;
  assert not exists(select 1 from stock_movements where medicine_id=med and created_by is not null), 'Staff removal should anonymize the reference without rewriting the ledger';
  assert exists(select 1 from stock_movements where medicine_id=med and created_by_name='Inventory Test Staff'), 'Recorded staff identity survives profile removal';
  assert (select count(*) from inventory_batch_events where created_by_name='Inventory Test Staff' and created_by is null)>=2;
end $$;
rollback;
