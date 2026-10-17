import type { Service } from '../../types/service'
import { Button } from '../../components/ui/Button'
import { formatDateLong, formatPeso, formatTime } from '../../lib/format'
import type { Contact } from './DetailsStep'

export function ReviewStep({ service, scheduledDate, slotTime, contact, submitting, error, onSubmit, onBack, onPickAnotherTime }: {
  service: Service
  scheduledDate: string
  slotTime: string
  contact: Contact
  submitting: boolean
  error?: string
  onSubmit: () => void
  onBack: () => void
  onPickAnotherTime: () => void
}) {
  return (
    <div>
      <h1 className="text-lg font-semibold text-gray-900">Review your booking</h1>
      <p className="mt-1 text-sm text-gray-500">Check the details before confirming your appointment.</p>
      <dl className="mt-5 divide-y divide-border rounded-card border border-border bg-white px-4">
        <Row label="Service" value={service.name} />
        <Row label="Price" value={formatPeso(service.price)} />
        <Row label="Date" value={formatDateLong(scheduledDate)} />
        <Row label="Time" value={formatTime(slotTime)} />
        <Row label="Patient" value={contact.patientName} />
        <Row label="Mobile" value={contact.contactNumber} />
        <Row label="Email" value={contact.email} />
        <Row label="Reason for visit" value={contact.reasonForVisit} />
      </dl>
      {error && (
        <div role="alert" className="mt-5 rounded-card border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">
          <p>{error}</p>
          <button type="button" onClick={onPickAnotherTime} className="mt-1.5 font-semibold underline underline-offset-2">Choose another time</button>
        </div>
      )}
      <div className="mt-5 flex gap-2">
        <Button variant="secondary" onClick={onBack} disabled={submitting} className="flex-1 justify-center">Edit details</Button>
        <Button onClick={onSubmit} loading={submitting} className="flex-1 justify-center">Confirm booking</Button>
      </div>
      <p className="mt-3 text-center text-xs text-gray-500">Confirming holds this appointment time immediately. You can cancel or request a new time from History.</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-sm">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-gray-900">{value}</dd>
    </div>
  )
}
