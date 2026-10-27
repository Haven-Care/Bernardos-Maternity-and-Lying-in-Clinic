import { useMemo, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { StatusBadge } from '../../../components/ui/Badge'
import { SearchField, SelectField } from '../../../components/ui/fields'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate, formatTime } from '../../../lib/format'
import {
  APPOINTMENT_STATUSES,
  type BookingRequest,
} from '../../../types/appointment'
import { DateRangeFields } from '../../../components/ui/DateRangeFields'
import { clinicDate, dateRangeError, withinDateRange } from '../../../lib/dateRange'
import { BookingDetail } from './BookingDetail'
import { AppointmentExpanded } from './AppointmentExpanded'
import { APPOINTMENT_LABELS } from '../../../lib/visits'
import { ACTIONABLE } from '../../../lib/bookings'

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  ...APPOINTMENT_STATUSES.map(
    (status) => ({
      value: status,
      label: APPOINTMENT_LABELS[status],
    }),
  ),
]

export function BookingRequests({ visits = false, onChanged }: { visits?: boolean; onChanged?: () => void }) {
  const [status, setStatus] = useState(visits ? 'active' : '')
  const [dates, setDates] = useState(() => { const today = clinicDate(new Date().toISOString()); return visits ? { from: today, to: today } : { from: '', to: '' } })
  const bookings = useAsync(() => dateRangeError(dates) ? Promise.resolve([]) : api.appointments.listBookings(dates), [dates.from, dates.to])
  const [sort, setSort] = useState(visits ? 'appointment' : 'latest-appointment')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BookingRequest | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return (bookings.data ?? [])
      .filter((b) => status === 'active' ? ACTIONABLE.has(b.status) || b.status === 'arrived' : status ? b.status === status : true)
      .filter((b) => withinDateRange(b.scheduledDate, dates))
      .filter((b) =>
        term
          ? b.patientName.toLowerCase().includes(term) ||
            b.referenceNo.toLowerCase().includes(term) ||
            b.serviceName.toLowerCase().includes(term)
          : true,
      )
      .sort((a, b) => {
        if (sort === 'oldest') return a.submittedAt.localeCompare(b.submittedAt)
        if (sort === 'appointment') {
          return `${a.scheduledDate}T${a.slotTime}`.localeCompare(`${b.scheduledDate}T${b.slotTime}`)
        }
        if (sort === 'latest-appointment') {
          return `${b.scheduledDate}T${b.slotTime}`.localeCompare(`${a.scheduledDate}T${a.slotTime}`) || b.submittedAt.localeCompare(a.submittedAt) || a.id.localeCompare(b.id)
        }
        return b.submittedAt.localeCompare(a.submittedAt)
      })
  }, [bookings.data, status, dates, search, sort])

  const columns: Column<BookingRequest>[] = [
    {
      key: 'ref',
      header: 'Reference No.',
      className: 'whitespace-nowrap',
      render: (b) => (
        <span className="font-medium text-gray-900">{b.referenceNo}</span>
      ),
    },
    { key: 'patient', header: 'Patient', render: (b) => b.patientName },
    { key: 'service', header: 'Service', render: (b) => b.serviceName },
    {
      key: 'date',
      header: 'Date',
      className: 'whitespace-nowrap',
      render: (b) => formatDate(b.scheduledDate),
    },
    {
      key: 'time',
      header: 'Time',
      className: 'whitespace-nowrap',
      render: (b) => formatTime(b.slotTime),
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <StatusBadge status={b.status} />,
    },
    {
      key: 'action',
      header: 'Action',
      className: 'whitespace-nowrap',
      align: 'right',
      render: (b) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setSelected(b)
          }}
          className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
        >
          Manage
        </button>
      ),
    },
  ]

  const filtered = status !== '' || dates.from !== '' || dates.to !== '' || search !== ''

  return (
    <>
      {visits && <p className="text-sm text-gray-600">Today’s active visits. Open a booking to confirm, record arrival, complete the visit, or mark a no-show. Change or clear the dates to view other visits.</p>}
      <Card className="appointments-list-card">
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="w-40">
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={visits ? [{ value: 'active', label: 'Active visits' }, ...STATUS_OPTIONS] : STATUS_OPTIONS}
            />
          </div>
          <DateRangeFields value={dates} onChange={setDates} />
          <div className="w-48">
            <SelectField label="Sort by" value={sort} onChange={setSort} options={[
              { value: 'latest-appointment', label: 'Latest appointment first' },
              { value: 'newest', label: 'Newest booking first' },
              { value: 'oldest', label: 'Oldest booking first' },
              { value: 'appointment', label: 'Earliest appointment first' },
            ]} />
          </div>
          <div className="ml-auto w-full min-w-0 sm:w-80">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Patient, reference, or service…"
            />
          </div>
        </div>

        <AsyncBoundary
          state={bookings}
          empty={
            <EmptyState
              title="No bookings yet"
              description="Appointments booked from the public form land here."
            />
          }
        >
          {() => (
            <Table
              fillHeight
              columns={columns}
              rows={rows}
              rowKey={(b) => b.id}
              expandable={{
                label: (booking) => `appointment ${booking.referenceNo} for ${booking.patientName}`,
                render: (booking) => <AppointmentExpanded booking={booking} onManage={() => setSelected(booking)} />,
              }}
              empty={
                <EmptyState
                  title="Nothing matches those filters"
                  description={
                    filtered
                      ? 'Try clearing the status, date range, or search.'
                      : undefined
                  }
                />
              }
            />
          )}
        </AsyncBoundary>
      </Card>

      {selected && (
        <BookingDetail
          booking={selected}
          open={selected !== null}
          onClose={() => setSelected(null)}
          onChanged={() => { bookings.reload(); onChanged?.() }}
        />
      )}
    </>
  )
}
