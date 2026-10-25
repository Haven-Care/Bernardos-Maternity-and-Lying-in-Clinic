-- Repair projects that already applied migration 20.
-- Generate a batch number when omitted and validate new stock receipts.
create or replace function record_stock_in(
  p_medicine_id uuid,
  p_batch_no text,
  p_quantity integer,
  p_expires_at date,
  p_note text,
  p_actor uuid
)
returns medicine_batches
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_batch medicine_batches;
  v_batch_no text := coalesce(nullif(trim(p_batch_no), ''), 'B-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)));
begin
  if length(v_batch_no) > 64 or v_batch_no !~ '^[A-Za-z0-9#_./ -]+$' or v_batch_no !~ '[A-Za-z0-9]' then
    raise exception 'Invalid batch number. Use letters, numbers, spaces, -, #, _, /, or .' using errcode = 'HC400';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.' using errcode = 'HC400';
  end if;

  if not exists (select 1 from medicines where id = p_medicine_id) then
    raise exception 'That medicine does not exist.' using errcode = 'HC400';
  end if;

  -- The conflict row is locked before this predicate is evaluated, including
  -- when a concurrent receipt inserted a row absent from our initial snapshot.
  insert into medicine_batches (medicine_id, batch_no, quantity, expires_at)
  values (p_medicine_id, v_batch_no, p_quantity, p_expires_at)
  on conflict (medicine_id, batch_no) do update
    set quantity = medicine_batches.quantity + excluded.quantity
    where medicine_batches.expires_at = excluded.expires_at
  returning * into v_batch;

  if not found then
    raise exception
      'Batch % already exists with a different expiry date. Check the batch number.',
      v_batch_no
      using errcode = 'HC409';
  end if;

  insert into stock_movements
    (batch_id, medicine_id, type, quantity, note, created_by)
  values
    (v_batch.id, p_medicine_id, 'stock_in', p_quantity, coalesce(p_note, ''), p_actor);

  return v_batch;
end;
$$;
