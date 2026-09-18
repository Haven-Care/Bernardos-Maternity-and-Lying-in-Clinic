import type {
  ClinicInfo,
  ClinicSettings,
  OperatingHours,
} from '../types/clinic'
import { clinicInfo, clinicSettings, operatingHours } from '../mocks/clinic'
import { mockDelay } from '../mocks/util'
// import { apiFetch } from './client'

export async function getClinicInfo(): Promise<ClinicInfo> {
  // BACKEND: return apiFetch<ClinicInfo>('/clinic')
  return mockDelay(clinicInfo)
}

export async function updateClinicInfo(
  input: ClinicInfo,
): Promise<ClinicInfo> {
  // BACKEND: return apiFetch<ClinicInfo>('/clinic', { method: 'PATCH', body: JSON.stringify(input) })
  Object.assign(clinicInfo, input)
  return mockDelay(clinicInfo)
}

export async function getOperatingHours(): Promise<OperatingHours[]> {
  // BACKEND: return apiFetch<OperatingHours[]>('/clinic/hours')
  return mockDelay(operatingHours)
}

export async function updateOperatingHours(
  rows: OperatingHours[],
): Promise<OperatingHours[]> {
  // BACKEND: return apiFetch<OperatingHours[]>('/clinic/hours', { method: 'PUT', body: JSON.stringify(rows) })
  operatingHours.splice(0, operatingHours.length, ...rows)
  return mockDelay(operatingHours)
}

export async function getSettings(): Promise<ClinicSettings> {
  // BACKEND: return apiFetch<ClinicSettings>('/clinic/settings')
  return mockDelay(clinicSettings)
}

export async function updateSettings(
  input: Partial<ClinicSettings>,
): Promise<ClinicSettings> {
  // BACKEND: return apiFetch<ClinicSettings>('/clinic/settings', { method: 'PATCH', body: JSON.stringify(input) })
  Object.assign(clinicSettings, input)
  return mockDelay(clinicSettings)
}
