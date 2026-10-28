import type { BatchState, MedicineBatch, MovementReason } from '../types/medicine'
import { clinicDate } from './dateRange'
export const BATCH_LABELS: Record<BatchState, string> = { available: 'Available', expired: 'Expired / awaiting disposal', quarantined: 'Quarantined', depleted: 'Depleted', disposed: 'Disposed' }
export const MOVEMENT_LABELS: Record<MovementReason, string> = { legacy: 'Legacy entry', received: 'Received', dispensed: 'Dispensed', disposed: 'Disposed', adjustment: 'Adjustment', reversal: 'Reversal' }
export function batchState(batch: MedicineBatch): BatchState {
  return batch.state ?? (batch.quantity === 0 ? 'depleted' : batch.expiresAt < clinicDate(new Date().toISOString()) ? 'expired' : batch.quarantined ? 'quarantined' : 'available')
}

export function canReceiveStock(batch: MedicineBatch): boolean {
  return !batch.quarantined && batch.expiresAt >= clinicDate(new Date().toISOString()) && ['available', 'depleted'].includes(batchState(batch))
}
