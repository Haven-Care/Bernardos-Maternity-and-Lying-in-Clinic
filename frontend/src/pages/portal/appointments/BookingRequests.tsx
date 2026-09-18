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
import { BookingDetail } from './BookingDetail'

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  ...APPOINTMENT_STATUSES.map((status) => ({
    value: status,
    label: status[0].toUpperCase() + status.slice(1),
  })),
]

export function BookingRequests() {
  const bookings = useAsync(() => api.appointments.listBookings())

  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<BookingRequest | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()

    return (bookings.data ?? [])
      .filter((b) => (status ? b.status === status : true))
      .filter((b) => (date ? b.scheduledDate === date : true))
      .filter((b) =>
        term
          ? b.patientName.toLowerCase().includes(term) ||
            b.referenceNo.toLowerCase().includes(term) ||
            b.serviceName.toLowerCase().includes(term)
          : true,
      )
      // Pending first, then soonest — staff open this tab to action requests,
      // not to browse history.
      .sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1
        if (b.status === 'pending' && a.status !== 'pending') return 1
        return a.scheduledDate.localeCompare(b.scheduledDate)
      })
  }, [bookings.data, status, date, search])

  const columns: Column<BookingRequest>[] = [
    {
      key: 'ref',
      header: 'Reference No.',
      render: (b) => (
        <span className="font-medium text-gray-900">{b.referenceNo}</span>
      ),
    },
    { key: 'patient', header: 'Patient', render: (b) => b.patientName },
    { key: 'service', header: 'Service', render: (b) => b.serviceName },
    {
      key: 'date',
      header: 'Date',
      render: (b) => formatDate(b.scheduledDate),
    },
    {
      key: 'time',
      header: 'Time',
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
          View
        </button>
      ),
    },
  ]

  const filtered = status !== '' || date !== '' || search !== ''

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="w-40">
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
            />
          </div>
          <div className="w-44">
            <label className="mb-1.5 block text-xs font-medium text-gray-700">
              Date
            </label>
            <input
              type="date"
              value={date}
              aria-label="Filter by date"
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
          </div>
          <div className="ml-auto w-full sm:w-64">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search name, reference, service"
            />
          </div>
        </div>

        <AsyncBoundary
          state={bookings}
          empty={
            <EmptyState
              title="No booking requests yet"
              description="Requests submitted from the public booking form land here."
            />
          }
        >
          {() => (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(b) => b.id}
              onRowClick={setSelected}
              empty={
                <EmptyState
                  title="Nothing matches those filters"
                  description={
                    filtered
                      ? 'Try clearing the status, date, or search.'
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
          onChanged={bookings.reload}
        />
      )}
    </>
  )
}
