import { useState } from 'react'
import * as patientAccounts from '../../../api/patientAccounts'
import { useAsync } from '../../../hooks/useAsync'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Table, type Column } from '../../../components/ui/Table'
import { SearchField } from '../../../components/ui/fields'
import { Modal } from '../../../components/ui/Modal'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate } from '../../../lib/format'
import type { PatientListRow } from '../../../types/patient'

export function PatientAccounts() {
  const accounts = useAsync(() => patientAccounts.list())
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PatientListRow | null>(null)
  const columns: Column<PatientListRow>[] = [
    { key: 'id', header: 'Patient ID', render: (patient) => patient.patientCode },
    { key: 'name', header: 'Patient Name', render: (patient) => <span className="font-medium text-gray-900">{patient.fullName}</span> },
    { key: 'contact', header: 'Contact Number', render: (patient) => patient.contactNumber },
    { key: 'visit', header: 'Last Visit', render: (patient) => patient.lastVisit ? formatDate(patient.lastVisit) : 'No visits yet' },
    { key: 'actions', header: 'Action', align: 'right', render: (patient) => (
      <button type="button" aria-label={'View ' + patient.fullName} title={'View ' + patient.fullName} onClick={() => setSelected(patient)}
        className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-brand-50 hover:text-brand-700">
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    ) },
  ]
  const term = search.trim().toLowerCase()
  const rows = (accounts.data ?? []).filter((patient) =>
    [patient.patientCode, patient.fullName, patient.contactNumber].some((value) => value.toLowerCase().includes(term)),
  )

  return (
    <div className="portal-tab-body flex flex-col gap-4">
      <div className="w-full min-w-0 sm:max-w-md">
        <SearchField value={search} onChange={setSearch} placeholder="Search patient accounts..." />
      </div>
      <Card className="portal-table-card">
        <AsyncBoundary state={accounts} empty={<EmptyState title="No patient accounts yet" description="Patients registered for the mobile app will appear here." />}>
          {() => <Table fillHeight columns={columns} rows={rows} rowKey={(patient) => patient.id} empty={<EmptyState title="No patient accounts match your search" />} />}
        </AsyncBoundary>
      </Card>
      {selected && (
        <Modal open onClose={() => setSelected(null)} title="Patient Account Details" description="Mobile patient account"
          footer={<Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Patient ID', selected.patientCode],
              ['Patient Name', selected.fullName],
              ['Contact Number', selected.contactNumber],
              ['Last Visit', selected.lastVisit ? formatDate(selected.lastVisit) : 'No visits yet'],
            ].map(([label, value]) => (
              <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 font-medium text-gray-900">{value}</dd></div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  )
}