import type { ReactNode } from 'react'
import type { AppointmentStatus } from '../../types/appointment'
import type { StockStatus } from '../../types/medicine'

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const TONES: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-200',
  success: 'bg-success-50 text-success-700 ring-success-500/20',
  warning: 'bg-warning-50 text-warning-700 ring-warning-500/20',
  danger: 'bg-danger-50 text-danger-700 ring-danger-500/20',
  info: 'bg-blue-50 text-blue-700 ring-blue-500/20',
  brand: 'bg-brand-50 text-brand-700 ring-brand-500/20',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

const APPOINTMENT_TONES: Record<AppointmentStatus, Tone> = {
  pending: 'warning',
  confirmed: 'info',
  rescheduled: 'brand',
  cancelled: 'danger',
  completed: 'success',
}

const APPOINTMENT_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  completed: 'Completed',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge tone={APPOINTMENT_TONES[status]}>{APPOINTMENT_LABELS[status]}</Badge>
  )
}

const STOCK_TONES: Record<StockStatus, Tone> = {
  good: 'success',
  low: 'warning',
  out: 'danger',
}

const STOCK_LABELS: Record<StockStatus, string> = {
  good: 'Good',
  low: 'Low Stock',
  out: 'Out of Stock',
}

export function StockBadge({ status }: { status: StockStatus }) {
  return <Badge tone={STOCK_TONES[status]}>{STOCK_LABELS[status]}</Badge>
}
