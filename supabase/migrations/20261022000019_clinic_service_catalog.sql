alter table public.services add column price_is_temporary boolean not null default false;

-- Placeholder prices are explicitly marked; existing configured rates are preserved.
insert into public.services (name, category, price, active, price_is_temporary)
select v.name, v.category, 100, true, true
from (values
  ('Normal Deliveries', 'Maternity & newborn'),
  ('Pre-natal Check-up', 'Check-ups'),
  ('Post-natal Check-up', 'Check-ups'),
  ('OB-GYNE Check-up', 'Check-ups'),
  ('Pedia Check-up', 'Check-ups'),
  ('Newborn Care', 'Maternity & newborn'),
  ('BCG Immunization', 'Maternity & newborn'),
  ('Hepa-B Immunization', 'Maternity & newborn'),
  ('Hearing Test', 'Maternity & newborn'),
  ('Newborn Screening', 'Maternity & newborn'),
  ('Ear Piercing', 'Maternity & newborn'),
  ('Pap Smear', 'Women’s health & family planning'),
  ('Family Planning Counseling', 'Women’s health & family planning'),
  ('DMPA (Injectable)', 'Women’s health & family planning'),
  ('Implant', 'Women’s health & family planning'),
  ('IUD', 'Women’s health & family planning'),
  ('Pills', 'Women’s health & family planning')
) as v(name, category)
where not exists (select 1 from public.services s where lower(trim(s.name)) = lower(v.name));
