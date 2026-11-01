import { useState } from 'react'
import * as api from '../../../api'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { SelectField, TextArea } from '../../../components/ui/fields'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { useAsync } from '../../../hooks/useAsync'
import { formatTimestamp } from '../../../lib/format'
import type { PrivacyRequest } from '../../../types/privacy'

const KIND_LABEL: Record<PrivacyRequest['kind'], string> = {
  access: 'Copy of their information',
  correction: 'Correction',
  deletion: 'Deletion',
  objection: 'Objection / withdraw consent',
}

/**
 * Patients' Data Privacy Act requests, oldest first, for an administrator
 * acting for the clinic's Data Protection Officer to answer.
 *
 * The note recorded on resolving is what the patient reads in their profile,
 * so it should say what was done. For a copy of their information, export the
 * record from Patient Records and send it to the address on the request.
 */
export function PrivacyRequests() {
  const toast = useToast()
  const [status, setStatus] = useState<'open' | 'all'>('open')
  const requests = useAsync(() => api.system.listPrivacyRequests(status), [status])
  const [resolving, setResolving] = useState<PrivacyRequest | null>(null)

  return (
    <Card>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
        <p className="max-w-xl text-xs text-gray-500">
          Answer requests promptly. Medical records are kept for the period the law requires even when a patient
          asks for deletion; say so in the reply.
        </p>
        <div className="w-full sm:w-48">
          <SelectField
            label="Show"
            value={status}
            onChange={(value) => setStatus(value as 'open' | 'all')}
            options={[{ value: 'open', label: 'Open requests' }, { value: 'all', label: 'All requests' }]}
          />
        </div>
      </div>

      <AsyncBoundary state={requests} empty={<EmptyState title={status === 'open' ? 'No open requests' : 'No requests yet'} />}>
        {(rows) => (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900">{KIND_LABEL[row.kind]}</p>
                    <Badge tone={row.resolvedAt ? 'success' : 'warning'}>{row.resolvedAt ? 'Resolved' : 'Open'}</Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {row.requester ? `${row.requester.fullName} · ${row.requester.email}` : 'Account no longer exists'} · {formatTimestamp(row.submittedAt)}
                  </p>
                  {row.details && <p className="mt-1 whitespace-pre-wrap text-gray-700">{row.details}</p>}
                  {row.resolvedAt && (
                    <p className="mt-1 text-gray-600">
                      <span className="font-medium">Reply{row.resolvedBy ? ` by ${row.resolvedBy}` : ''}:</span> {row.resolutionNote}
                    </p>
                  )}
                </div>
                {!row.resolvedAt && (
                  <Button size="sm" variant="secondary" onClick={() => setResolving(row)}>Resolve</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </AsyncBoundary>

      {resolving && (
        <ResolveModal
          request={resolving}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setResolving(null)
            requests.reload()
            toast.success('Request resolved', 'The patient can read your reply in their profile.')
          }}
        />
      )}
    </Card>
  )
}

function ResolveModal({ request, onClose, onResolved }: { request: PrivacyRequest; onClose: () => void; onResolved: () => void }) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  async function save() {
    setSaving(true)
    setError(undefined)
    try {
      await api.system.resolvePrivacyRequest(request.id, note.trim())
      onResolved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resolve the request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`Resolve: ${KIND_LABEL[request.kind]}`}>
      <div className="flex flex-col gap-3">
        <TextArea label="Reply to the patient" required value={note} onChange={setNote} rows={4} maxLength={2000} />
        {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} loading={saving} disabled={!note.trim()}>Mark resolved</Button>
        </div>
      </div>
    </Modal>
  )
}
