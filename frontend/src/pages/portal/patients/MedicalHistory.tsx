import { useState } from 'react'
import * as historyApi from '../../../api/clinicalHistory'
import { useAsync } from '../../../hooks/useAsync'
import { ConfirmModal, Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { TextField, TextArea } from '../../../components/ui/fields'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatTimestamp } from '../../../lib/format'

export function MedicalHistory({ patientId, patientName, onClose }: {
  patientId: string
  patientName: string
  onClose: () => void
}) {
  const history = useAsync(() => historyApi.list(patientId), [patientId])
  const [adding, setAdding] = useState(false)
  return (
    <>
    <Modal open onClose={onClose} size="xl" title="Patient Clinical History Summary" description={patientName}
      headerAction={<Button onClick={() => setAdding(true)}>+ Add New Record</Button>}>
      <div className="max-h-[65dvh] space-y-4 overflow-y-auto p-1">
        <h3 className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Chronological Consultation &amp; Scan History</h3>
        <AsyncBoundary state={history} empty={<EmptyState title="No clinical history yet" description="Add a consultation or scan record for this patient." />}>
          {(records) => <div className="space-y-3">
            {records.map((record, index) => (
              <article key={record.id} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-2">
                  <time dateTime={record.occurredAt} className={'rounded-md px-2 py-1 text-xs font-semibold ' + (index === 0 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600')}>
                    {formatTimestamp(record.occurredAt)}
                  </time>
                  <h4 className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{record.title}</h4>
                  <span className="rounded-full border border-green-200 bg-success-50 px-2.5 py-0.5 text-xs font-semibold text-success-700">Completed</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600"><strong className="font-semibold text-gray-900">Diagnosis &amp; Findings: </strong>{record.findings}</p>
                <p className="mt-2 text-sm text-gray-500"><strong className="font-semibold text-gray-700">Provider: </strong>{record.provider}</p>
              </article>
            ))}
          </div>}
        </AsyncBoundary>
      </div>
    </Modal>
    {adding && <AddRecord patientId={patientId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); history.reload() }} />}
    </>
  )
}

function AddRecord({ patientId, onClose, onSaved }: { patientId: string; onClose: () => void; onSaved: () => void }) {
  const [input, setInput] = useState<historyApi.ClinicalRecordInput>({ occurredAt: '', title: '', findings: '', provider: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const dirty = Object.values(input).some((value) => value !== '')
  const valid = Object.values(input).every((value) => value.trim() !== '') && !Number.isNaN(Date.parse(input.occurredAt))
  async function save() {
    setSaving(true)
    setError('')
    try {
      if (!input.title.trim() || !input.findings.trim() || !input.provider.trim() || !input.occurredAt || Number.isNaN(Date.parse(input.occurredAt))) {
        throw new Error('Complete the date, consultation, findings, and provider fields.')
      }
      await historyApi.create(patientId, { ...input, occurredAt: new Date(input.occurredAt).toISOString() })
      onSaved()
    }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to save record.') }
    finally { setSaving(false) }
  }
  return (
    <>
    <Modal open dirty={dirty} busy={saving} onClose={onClose} title="Add Clinical Record"
      footer={<><Button variant="secondary" disabled={saving} onClick={() => { if (dirty) setConfirmingDiscard(true); else onClose() }}>Cancel</Button><Button loading={saving} disabled={!valid || !dirty} onClick={() => void save()}>Save Record</Button></>}>
      <div className="space-y-4">
        <TextField label="Consultation / Scan" required value={input.title} onChange={(title) => setInput({ ...input, title })} />
        <TextField label="Date & Time" type="datetime-local" required value={input.occurredAt} onChange={(occurredAt) => setInput({ ...input, occurredAt })} />
        <TextArea label="Diagnosis & Findings" required value={input.findings} onChange={(findings) => setInput({ ...input, findings })} />
        <TextField label="Provider" required value={input.provider} onChange={(provider) => setInput({ ...input, provider })} />
        {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      </div>
    </Modal>
    <ConfirmModal open={confirmingDiscard} onClose={() => setConfirmingDiscard(false)} onConfirm={onClose}
      title="Discard unsaved changes?" message="Your unsaved changes will be lost." confirmLabel="Discard changes" />
    </>
  )
}
