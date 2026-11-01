import {
  PRIVACY_NOTICE_VERSION,
  type ConsentStatus,
  type PrivacyRequest,
  type PrivacyRequestInput,
} from '../types/privacy'
import { apiFetch } from './client'

/**
 * A patient's side of the Data Privacy Act: the notice they agreed to, and
 * requests about their own data. Staff-side handling lives in `system.ts`.
 */

export async function getConsent(): Promise<ConsentStatus> {
  return apiFetch<ConsentStatus>('/me/consent')
}

/** Agrees to the notice this build shows at /privacy, and no other. */
export async function acceptNotice(): Promise<ConsentStatus> {
  return apiFetch<ConsentStatus>('/me/consent', {
    method: 'POST',
    body: JSON.stringify({ noticeVersion: PRIVACY_NOTICE_VERSION }),
  })
}

export async function listMyRequests(): Promise<PrivacyRequest[]> {
  return apiFetch<PrivacyRequest[]>('/me/privacy-requests')
}

export async function submitRequest(input: PrivacyRequestInput): Promise<PrivacyRequest> {
  return apiFetch<PrivacyRequest>('/me/privacy-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
