-- Rates supplied by the clinic on 28 October 2026. Keep service IDs and
-- appointment snapshots; retired offerings remain available to staff as inactive.
begin;

alter table public.services alter column price drop not null;

-- Reuse the original rows for the first rate rather than orphaning references.
update public.services s
set name = v.new_name
from (values
  ('Normal Deliveries', 'Normal Deliveries (with PhilHealth)'),
  ('Pre-natal Check-up', 'Pre-natal Check-up (first visit)')
) v(old_name, new_name)
where lower(trim(s.name)) = lower(v.old_name)
  and not exists (select 1 from public.services existing where lower(trim(existing.name)) = lower(v.new_name));

update public.services
set active = false, price_is_temporary = false
where lower(trim(name)) in (
  'normal deliveries', 'pre-natal check-up', 'post-natal check-up',
  'newborn care', 'hepa-b immunization', 'family planning counseling',
  'consultation', 'ultrasound', 'follow-up', 'other'
);

do $$
declare
  entry record;
begin
  for entry in
    select * from (values
    ('Normal Deliveries (with PhilHealth)', 'Maternity & newborn', 2500, true),
    ('Normal Deliveries (without PhilHealth)', 'Maternity & newborn', 10000, true),
    ('Pre-natal Check-up (first visit)', 'Check-ups', 100, true),
    ('Pre-natal Check-up (subsequent visit)', 'Check-ups', 50, true),
    ('OB-GYNE Check-up', 'Check-ups', 400, true),
    ('Pedia Check-up', 'Check-ups', 400, true),
    ('BCG Immunization', 'Maternity & newborn', 450, true),
    ('Hearing Test', 'Maternity & newborn', 650, false),
    ('Newborn Screening', 'Maternity & newborn', 1800, true),
    ('Ear Piercing', 'Maternity & newborn', 250, true),
    ('DMPA (Injectable)', 'Women’s health & family planning', 250, true),
    ('Norifam', 'Women’s health & family planning', null, true),
    ('Implant', 'Women’s health & family planning', 1500, true),
    ('IUD', 'Women’s health & family planning', 1500, true),
    ('Pap Smear', 'Women’s health & family planning', 350, true),
    ('Pills', 'Women’s health & family planning', 150, true)
    ) as rates(name, category, price, active)
  loop
    update public.services s
    set name = entry.name, category = entry.category, price = entry.price,
        price_is_temporary = false,
        -- Preserve staff deactivation; the hearing test must stay unavailable.
        active = s.active and entry.active
    where lower(trim(s.name)) = lower(entry.name);

    if not found then
      insert into public.services (name, category, price, active, price_is_temporary)
      values (entry.name, entry.category, entry.price, entry.active, false);
    end if;
  end loop;
end;
$$;

commit;
