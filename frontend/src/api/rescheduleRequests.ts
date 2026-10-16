import type {
  RescheduleRequest,
  RescheduleRequestStatus,
} from '../types/appointment'
import { apiFetch } from './client'

/**
 * The staff queue for patient-initiated reschedules.
 *
 * No Figma frame exists for this — the design models reschedule only as
 * something staff impose from the booking detail modal, which is gap #5 in the
 * flowchart spec.
 */

export async function listRescheduleRequests(
  status: RescheduleRequestStatus = 'pending',
): Promise<RescheduleRequest[]> {
  return apiFetch<RescheduleRequest[]>(
    `/reschedule-requests?status=${status}`,
  )
}

/**
 * Approve — moves the booking to the proposed slot.
 *
 * Re-checks capacity, because the slot can fill while the request sits in the
 * queue. If it has, approval fails and the request stays open rather than being
 * marked done against a booking that never moved.
 */
export async function approveRescheduleRequest(
  id: string,
): Promise<RescheduleRequest> {
  return apiFetch<RescheduleRequest>(`/reschedule-requests/${id}/approve`, {
    method: 'POST',
  })
}

/** Decline — the booking keeps the date and time it already had. */
export async function declineRescheduleRequest(
  id: string,
): Promise<RescheduleRequest> {
  return apiFetch<RescheduleRequest>(`/reschedule-requests/${id}/decline`, {
    method: 'POST',
  })
}
