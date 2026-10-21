import type { Service, ServiceInput } from '../types/service'
import { apiFetch } from './client'

export async function listServices(): Promise<Service[]> {
  return (await apiFetch<Service[]>('/services')).filter(isSpecificService)
}

/**
 * Only active services appear in the public booking form.
 *
 * The `active=true` is belt and braces: the server already hides deactivated
 * services from anyone who is not signed-in staff, so an anonymous caller could
 * not see them even by asking for everything.
 */
export async function listActiveServices(): Promise<Service[]> {
  return (await apiFetch<Service[]>('/services?active=true')).filter(isSpecificService)
}

export async function createService(input: ServiceInput): Promise<Service> {
  return apiFetch<Service>('/services', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<Service> {
  return apiFetch<Service>(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function setServiceActive(
  id: string,
  active: boolean,
): Promise<Service> {
  return apiFetch<Service>(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  })
}

function isSpecificService(service: Service): boolean {
  return service.name.trim().toLowerCase() !== 'other'
}
