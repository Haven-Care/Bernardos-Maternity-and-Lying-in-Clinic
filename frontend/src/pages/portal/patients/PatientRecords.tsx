import { useMemo, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { SearchField } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate, initials } from '../../../lib/format'
import type { PatientListRow } from '../../../types/patient'
import { PatientModal } from './PatientModal'

export function PatientRecords() {
  const patients = useAsync(() => api.patients.listPatients())

  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (patients.data ?? []).filter((p) =>
      term
        ? p.fullName.toLowerCase().includes(term) ||
          p.patientCode.toLowerCase().includes(term) ||
          p.contactNumber.includes(term)
        : true,
    )
  }, [patients.data, search])

  const columns: Column<PatientListRow>[] = [
    {
      key: 'code',
      header: 'Patient ID',
      render: (p) => (
        <span className="font-medium tabular-nums text-gray-900">
          {p.patientCode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Patient Name',
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
            {initials(p.fullName)}
          </span>
          <span className="font-medium text-gray-900">{p.fullName}</span>
        </div>
      ),
    },
    { key: 'contact', header: 'Contact Number', render: (p) => p.contactNumber },
    {
      key: 'visit',
      header: 'Last Visit',
      render: (p) =>
        p.lastVisit ? (
          formatDate(p.lastVisit)
        ) : (
          <span className="text-gray-400">No visits yet</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (p) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setEditing(p.id)
          }}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          View
        </button>
      ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Patient Records
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            View and manage patient profiles
          </p>
        </div>

        <Button onClick={() => setAdding(true)}>+ Add New Patient</Button>
      </div>

      <Card>
        <div className="border-b border-border p-4">
          <div className="sm:max-w-xs">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search name, ID, or contact"
            />
          </div>
        </div>

        <AsyncBoundary
          state={patients}
          empty={
            <EmptyState
              title="No patient records yet"
              description="Add a patient to start building their history."
            />
          }
        >
          {() => (
            <Table
              columns={columns}
              rows={rows}
              rowKey={(p) => p.id}
              onRowClick={(p) => setEditing(p.id)}
              empty={<EmptyState title="No patients match that search" />}
            />
          )}
        </AsyncBoundary>
      </Card>

      {adding && (
        <PatientModal
          open={adding}
          onClose={() => setAdding(false)}
          onSaved={patients.reload}
        />
      )}

      {editing && (
        <PatientModal
          patientId={editing}
          open={editing !== null}
          onClose={() => setEditing(null)}
          onSaved={patients.reload}
        />
      )}
    </div>
  )
}
