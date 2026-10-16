import type {
  ClinicInfo,
  ClinicSettings,
  OperatingHours,
} from '../types/clinic'
import { apiFetch } from './client'

export async function getClinicInfo(): Promise<ClinicInfo> {
  return apiFetch<ClinicInfo>('/clinic')
}

export async function updateClinicInfo(input: ClinicInfo): Promise<ClinicInfo> {
  return apiFetch<ClinicInfo>('/clinic', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function getOperatingHours(): Promise<OperatingHours[]> {
  return apiFetch<OperatingHours[]>('/clinic/hours')
}

/**
 * Replaces the whole table, which is why this is a PUT.
 *
 * The grid is edited as one thing, so a per-row PATCH would allow a half-saved
 * week. Rows left out of the payload are deleted — that is how a day gets
 * removed.
 */
export async function updateOperatingHours(
  rows: OperatingHours[],
): Promise<OperatingHours[]> {
  return apiFetch<OperatingHours[]>('/clinic/hours', {
    method: 'PUT',
    body: JSON.stringify(rows),
  })
}

export async function getSettings(): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>('/clinic/settings')
}

export async function updateSettings(
  input: Partial<ClinicSettings>,
): Promise<ClinicSettings> {
  return apiFetch<ClinicSettings>('/clinic/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
