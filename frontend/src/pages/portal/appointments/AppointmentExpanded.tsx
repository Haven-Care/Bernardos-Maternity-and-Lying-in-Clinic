import { useState, type ReactNode } from 'react'
import * as api from '../../../api'
import type { BookingRequest } from '../../../types/appointment'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { StatusBadge } from '../../../components/ui/Badge'
import { ErrorState, LoadingState } from '../../../components/ui/states'
import { formatDate, formatDateTime, formatTimestamp } from '../../../lib/format'
import { PatientModal } from '../patients/PatientModal'

/** Mounted only for an expanded appointment, so patient records load on demand. */
export function AppointmentExpanded({ booking, onManage }: { booking: BookingRequest; onManage: () => void }) {
  const patient = useAsync(() => booking.patientId ? api.patients.getPatient(booking.patientId) : Promise.resolve(null), [booking.patientId])
  const [patientOpen, setPatientOpen] = useState(false)

  return (
    <section aria-label={`Details for ${booking.referenceNo}`} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Appointment &amp; patient details</h2>
        <Button size="sm" onClick={onManage}>Manage appointment</Button>
      </div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <section className="min-w-0 rounded-card border border-border bg-white p-4" aria-label="Appointment details">
          <h3 className="mb-3 font-semibold text-gray-900">Appointment</h3>
          <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Field label="Reference" value={booking.referenceNo} />
            <Field label="Status" value={<StatusBadge status={booking.status} />} />
            <Field label="Service" value={booking.serviceName} />
            <Field label="Date & time" value={formatDateTime(booking.scheduledDate, booking.slotTime)} />
            <Field label="Patient name at booking" value={booking.patientName} />
            <Field label="Submitted" value={formatTimestamp(booking.submittedAt)} />
            <Field label="Booking phone" value={booking.contactNumber} />
            <Field label="Booking email" value={booking.email} />
            <Field label="Reason for visit" value={booking.reasonForVisit} wide />
          </dl>
        </section>
        <section className="min-w-0 rounded-card border border-border bg-white p-4" aria-label="Patient details">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-900">Patient record</h3>
            {patient.data && <Button size="sm" variant="secondary" onClick={() => setPatientOpen(true)}>Open patient record</Button>}
          </div>
          {!booking.patientId ? <p className="text-sm text-gray-500">No patient record is linked to this appointment. The patient’s booking contact details are shown alongside it.</p>
            : patient.loading ? <LoadingState label="Loading patient details…" />
            : patient.error ? <ErrorState error={patient.error} onRetry={patient.reload} />
            : patient.data && <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Patient ID" value={patient.data.patientCode} />
              <Field label="Full name" value={patient.data.fullName} />
              <Field label="Date of birth" value={patient.data.dateOfBirth ? formatDate(patient.data.dateOfBirth) : undefined} />
              <Field label="Blood type" value={patient.data.bloodType} />
              <Field label="Phone" value={patient.data.contactNumber} />
              <Field label="Email" value={patient.data.email} />
              <Field label="Address" value={patient.data.address} wide />
              <Field label="Allergies" value={patient.data.allergies} />
              <Field label="Medical conditions" value={patient.data.medicalConditions} />
              <Field label="Attending physician" value={patient.data.attendingPhysician} />
              <Field label="Last visit" value={patient.data.lastVisit ? formatDate(patient.data.lastVisit) : undefined} />
              <Field label="Emergency contact" value={[patient.data.emergencyContactName, patient.data.emergencyContactNumber].filter(Boolean).join(' · ')} wide />
            </dl>}
        </section>
      </div>
      {patientOpen && booking.patientId && <PatientModal patientId={booking.patientId} open onClose={() => setPatientOpen(false)} onSaved={patient.reload} />}
    </section>
  )
}

function Field({ label, value, wide = false }: { label: string; value?: ReactNode; wide?: boolean }) {
  return <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
    <dt className="text-xs text-gray-500">{label}</dt>
    <dd className="mt-1 break-words whitespace-pre-wrap text-sm text-gray-900">{value === null || value === undefined || value === '' ? 'Not recorded' : value}</dd>
  </div>
}
