/** Clinic-supplied services and rates. Null means no price was supplied. */
export const clinicServices = [
  { name: 'Normal Deliveries (with PhilHealth)', category: 'Maternity & newborn', price: 2500, available: true, top: true },
  { name: 'Normal Deliveries (without PhilHealth)', category: 'Maternity & newborn', price: 10000, available: true, top: true },
  { name: 'Pre-natal Check-up (first visit)', category: 'Check-ups', price: 100, available: true, top: true },
  { name: 'Pre-natal Check-up (subsequent visit)', category: 'Check-ups', price: 50, available: true, top: true },
  { name: 'OB-GYNE Check-up', category: 'Check-ups', price: 400, available: true, top: true },
  { name: 'Pedia Check-up', category: 'Check-ups', price: 400, available: true, top: true },
  { name: 'BCG Immunization', category: 'Maternity & newborn', price: 450, available: true, top: false },
  { name: 'Hearing Test', category: 'Maternity & newborn', price: 650, available: false, top: false },
  { name: 'Newborn Screening', category: 'Maternity & newborn', price: 1800, available: true, top: false },
  { name: 'Ear Piercing', category: 'Maternity & newborn', price: 250, available: true, top: false },
  { name: 'DMPA (Injectable)', category: 'Women’s health & family planning', price: 250, available: true, top: false },
  { name: 'Norifam', category: 'Women’s health & family planning', price: null, available: true, top: false },
  { name: 'Implant', category: 'Women’s health & family planning', price: 1500, available: true, top: false },
  { name: 'IUD', category: 'Women’s health & family planning', price: 1500, available: true, top: false },
  { name: 'Pap Smear', category: 'Women’s health & family planning', price: 350, available: true, top: false },
  { name: 'Pills', category: 'Women’s health & family planning', price: 150, available: true, top: false },
] as const

export const clinicServiceCategories = [
  'All',
  'Top services',
  'Check-ups',
  'Maternity & newborn',
  'Women’s health & family planning',
] as const

export const clinicServiceGroups = clinicServiceCategories.slice(2).map((category) => ({
  category,
  services: clinicServices.filter((service) => service.category === category),
}))
