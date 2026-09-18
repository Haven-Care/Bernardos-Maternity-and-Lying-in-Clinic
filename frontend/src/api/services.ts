import type { Service, ServiceInput } from '../types/service'
import { services } from '../mocks/services'
import { mockDelay, mockReject, uid } from '../mocks/util'
// import { apiFetch } from './client'

export async function listServices(): Promise<Service[]> {
  // BACKEND: return apiFetch<Service[]>('/services')
  return mockDelay(services)
}

/** Only active services appear in the public booking form. */
export async function listActiveServices(): Promise<Service[]> {
  // BACKEND: return apiFetch<Service[]>('/services?active=true')
  return mockDelay(services.filter((s) => s.active))
}

export async function createService(input: ServiceInput): Promise<Service> {
  // BACKEND: return apiFetch<Service>('/services', { method: 'POST', body: JSON.stringify(input) })
  const created: Service = { ...input, id: uid('svc'), active: true }
  services.push(created)
  return mockDelay(created)
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<Service> {
  // BACKEND: return apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
  const s = services.find((x) => x.id === id)
  if (!s) return mockReject(`Service not found: ${id}`)
  Object.assign(s, input)
  return mockDelay(s)
}

export async function setServiceActive(
  id: string,
  active: boolean,
): Promise<Service> {
  // BACKEND: return apiFetch<Service>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) })
  const s = services.find((x) => x.id === id)
  if (!s) return mockReject(`Service not found: ${id}`)
  s.active = active
  return mockDelay(s)
}
