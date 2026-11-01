import { useState } from 'react'
import * as api from '../../../api'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { SelectField } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { useAsync } from '../../../hooks/useAsync'
import { formatTimestamp } from '../../../lib/format'
import type { AuditEntry } from '../../../types/privacy'

/** Plain words for each recorded action; anything unlisted shows its raw name. */
const ACTIONS: Record<string, string> = {
  'patient.list': 'Viewed the patient list',
  'patient.view': 'Opened a patient record',
  'patient.create': 'Created a patient record',
  'patient.update': 'Edited a patient record',
  'patient.export': 'Exported a patient record',
  'clinical_record.view': 'Viewed clinical history',
  'clinical_record.create': 'Added a clinical note',
  'document.list': 'Listed documents',
  'document.upload': 'Uploaded a document',
  'document.open': 'Opened a document',
  'staff.create': 'Created a staff account',
  'staff.status': 'Changed a staff account’s status',
  'service.create': 'Added a service',
  'service.update': 'Changed a service or price',
  'slot.create': 'Added an appointment slot',
  'slot.update': 'Changed an appointment slot',
  'clinic.update': 'Changed clinic information',
  'hours.update': 'Changed opening hours',
  'settings.update': 'Changed clinic settings',
  'consent.record': 'Agreed to the privacy notice',
  'privacy_request.create': 'Filed a privacy request',
  'privacy_request.resolve': 'Resolved a privacy request',
}

const PAGE = 100

/**
 * Who viewed or changed patient data and settings, newest first.
 *
 * What the Data Privacy Act expects a clinic to be able to answer after the
 * fact: who opened this patient's record, and when. The log stores field names,
 * never their values, so reading it reveals nothing clinical.
 */
export function ActivityLog() {
  const [action, setAction] = useState('')
  const [pages, setPages] = useState(1)
  const log = useAsync(() => api.system.listAuditLog({ action, limit: PAGE * pages }), [action, pages])

  const columns: Column<AuditEntry>[] = [
    { key: 'when', header: 'When', render: (row) => <span className="whitespace-nowrap tabular-nums">{formatTimestamp(row.occurredAt)}</span> },
    {
      key: 'who',
      header: 'Who',
      render: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.actorName ?? (row.actorRole === 'system' ? 'System' : 'Account no longer exists')}</p>
          <Badge tone={row.actorRole === 'patient' ? 'neutral' : 'info'}>{row.actorRole}</Badge>
        </div>
      ),
    },
    { key: 'what', header: 'What', render: (row) => ACTIONS[row.action] ?? row.action },
    {
      key: 'details',
      header: 'Details',
      render: (row) => <span className="text-xs text-gray-500">{describe(row)}</span>,
    },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
        <p className="max-w-xl text-xs text-gray-500">
          Every view or change of a patient record, document or clinic setting. Entries cannot be edited or
          deleted. Values are never recorded, only which fields changed.
        </p>
        <div className="w-full sm:w-64">
          <SelectField
            label="Show"
            value={action}
            onChange={(value) => { setAction(value); setPages(1) }}
            placeholder="All activity"
            options={Object.entries(ACTIONS).map(([value, label]) => ({ value, label }))}
          />
        </div>
      </div>
      <AsyncBoundary state={log} empty={<EmptyState title="No activity recorded yet" />}>
        {(rows) => (
          <>
            <Table columns={columns} rows={rows} rowKey={(row) => String(row.id)} pageSize={25} />
            {rows.length === PAGE * pages && (
              <div className="border-t border-border p-3 text-center">
                <button type="button" onClick={() => setPages((n) => n + 1)} className="text-sm font-medium text-brand-600 hover:underline">
                  Load older activity
                </button>
              </div>
            )}
          </>
        )}
      </AsyncBoundary>
    </Card>
  )
}

function describe(row: AuditEntry): string {
  const parts: string[] = []
  if (row.patientId) parts.push(`Patient ${row.patientId.slice(0, 8)}`)
  for (const [key, value] of Object.entries(row.details)) {
    parts.push(`${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
  }
  return parts.join(' · ') || '—'
}
