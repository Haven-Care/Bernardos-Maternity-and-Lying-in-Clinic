import type { Service } from '../types/service'

/** The four services shown in Administration → Services & Pricing. */
export const services: Service[] = [
  {
    id: 'svc-1',
    name: 'Pre-natal Check-up',
    category: 'Consultation',
    price: 300,
    active: true,
  },
  {
    id: 'svc-2',
    name: 'Consultation',
    category: 'Consultation',
    price: 200,
    active: true,
  },
  {
    id: 'svc-3',
    name: 'Ultrasound',
    category: 'Diagnostic',
    price: 500,
    active: true,
  },
  {
    id: 'svc-4',
    name: 'Follow-up',
    category: 'Consultation',
    price: 200,
    active: true,
  },
]

export function findService(id: string): Service | undefined {
  return services.find((s) => s.id === id)
}
