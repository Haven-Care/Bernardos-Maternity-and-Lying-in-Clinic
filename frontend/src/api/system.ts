import type {
  CreateStaffInput,
  StaffProfile,
  StaffStatus,
} from '../types/account'
import type { AuditEntry, PrivacyRequest } from '../types/privacy'
import { apiFetch } from './client'

/**
 * Staff provisioning.
 *
 * No mock layer and no `// BACKEND:` marker: this domain has no fixtures to
 * swap from, because it did not exist during the UI phase. It is real from the
 * first line.
 *
 * Every endpoint is administrator-only, enforced in Express. The screen being
 * unlisted is not what protects it.
 */

export async function listStaff(): Promise<StaffProfile[]> {
  return apiFetch<StaffProfile[]>('/system/staff')
}

export async function createStaff(
  input: CreateStaffInput,
): Promise<StaffProfile> {
  return apiFetch<StaffProfile>('/system/staff', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Deactivate or reactivate.
 *
 * Never a delete — stock movements and uploaded documents point at these rows,
 * and removing one would erase who recorded what. Deactivation takes effect on
 * the account's very next request, not when their token expires.
 */
export async function setStaffStatus(
  id: string,
  status: StaffStatus,
): Promise<StaffProfile> {
  return apiFetch<StaffProfile>(`/system/staff/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

/** Who viewed or changed patient data and settings, newest first. */
export async function listAuditLog(
  filter: { patientId?: string; action?: string; offset?: number; limit?: number } = {},
): Promise<AuditEntry[]> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return apiFetch<AuditEntry[]>(`/system/audit-log${query.size ? `?${query}` : ''}`)
}

/** Patients' Data Privacy Act requests; `open` by default, or every one. */
export async function listPrivacyRequests(status: 'open' | 'all' = 'open'): Promise<PrivacyRequest[]> {
  return apiFetch<PrivacyRequest[]>(`/system/privacy-requests?status=${status}`)
}

export async function resolvePrivacyRequest(id: string, resolutionNote: string): Promise<PrivacyRequest> {
  return apiFetch<PrivacyRequest>(`/system/privacy-requests/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolutionNote }),
  })
}
