/** The clinic's printed services-offered poster. Top services follows its first column, not usage data. */
export const clinicServices = [
  { name: 'Normal Deliveries', category: 'Maternity & newborn', top: true },
  { name: 'Pre-natal Check-up', category: 'Check-ups', top: true },
  { name: 'Post-natal Check-up', category: 'Check-ups', top: true },
  { name: 'OB-GYNE Check-up', category: 'Check-ups', top: true },
  { name: 'Pedia Check-up', category: 'Check-ups', top: true },
  { name: 'Newborn Care', category: 'Maternity & newborn', top: false },
  { name: 'BCG Immunization', category: 'Maternity & newborn', top: false },
  { name: 'Hepa-B Immunization', category: 'Maternity & newborn', top: false },
  { name: 'Hearing Test', category: 'Maternity & newborn', top: false },
  { name: 'Newborn Screening', category: 'Maternity & newborn', top: false },
  { name: 'Ear Piercing', category: 'Maternity & newborn', top: false },
  { name: 'Pap Smear', category: 'Women’s health & family planning', top: false },
  { name: 'Family Planning Counseling', category: 'Women’s health & family planning', top: false },
  { name: 'DMPA (Injectable)', category: 'Women’s health & family planning', top: false },
  { name: 'Implant', category: 'Women’s health & family planning', top: false },
  { name: 'IUD', category: 'Women’s health & family planning', top: false },
  { name: 'Pills', category: 'Women’s health & family planning', top: false },
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
