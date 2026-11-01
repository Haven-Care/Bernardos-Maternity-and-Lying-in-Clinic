import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../api'
import { Button } from '../../components/ui/Button'
import { SelectField, TextArea } from '../../components/ui/fields'
import { AsyncBoundary } from '../../components/ui/states'
import { ValidatedForm } from '../../components/ui/ValidatedForm'
import { useToast } from '../../components/ui/toast-context'
import { useAsync } from '../../hooks/useAsync'
import { formatTimestamp } from '../../lib/format'
import type { PrivacyRequestKind } from '../../types/privacy'

const KINDS: { value: PrivacyRequestKind; label: string; hint: string }[] = [
  { value: 'access', label: 'Get a copy of my information', hint: 'The clinic sends you what it holds about you.' },
  { value: 'correction', label: 'Correct my information', hint: 'Tell the clinic what is wrong and what it should say.' },
  { value: 'deletion', label: 'Delete my account and information', hint: 'Medical records are kept for the period the law requires.' },
  { value: 'objection', label: 'Object to how my information is used', hint: 'Withdrawing consent stops online booking.' },
]

/**
 * A patient's Data Privacy Act rights, in their profile: the notice they agreed
 * to, and requests the clinic answers. Requests go to the clinic's
 * administrators, who reply and close them; the patient sees the answer here.
 */
export function PrivacySettings() {
  const toast = useToast()
  const consent = useAsync(() => api.privacy.getConsent())
  const requests = useAsync(() => api.privacy.listMyRequests())
  const [kind, setKind] = useState<PrivacyRequestKind | ''>('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!kind) return
    setSending(true)
    setError(undefined)
    try {
      await api.privacy.submitRequest({ kind, details: details.trim() })
      setKind('')
      setDetails('')
      requests.reload()
      toast.success('Request sent', 'The clinic will reply here.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const hint = KINDS.find((option) => option.value === kind)?.hint

  return (
    <div className="space-y-5 text-sm">
      <AsyncBoundary state={consent}>
        {(status) => (
          <p className="text-gray-600">
            {status.consentedAt
              ? <>You agreed to the privacy notice on {formatTimestamp(status.consentedAt)}.</>
              : <>You have not agreed to the privacy notice yet.</>}{' '}
            <Link to="/privacy" target="_blank" rel="noopener" className="font-semibold text-brand-600 hover:underline">
              Read the Privacy Notice
            </Link>
          </p>
        )}
      </AsyncBoundary>

      <ValidatedForm onSubmit={submit} className="space-y-3">
        <SelectField
          label="What would you like the clinic to do?"
          required
          value={kind}
          onChange={(value) => setKind(value as PrivacyRequestKind)}
          placeholder="Choose a request"
          options={KINDS.map(({ value, label }) => ({ value, label }))}
        />
        {hint && <p className="-mt-1 text-xs text-gray-500">{hint}</p>}
        <TextArea label="Details (optional)" value={details} onChange={setDetails} rows={3} maxLength={2000} />
        {error && <p role="alert" className="text-danger-700">{error}</p>}
        <Button type="submit" loading={sending} disabled={!kind} className="w-full justify-center">
          Send request to the clinic
        </Button>
      </ValidatedForm>

      <AsyncBoundary state={requests}>
        {(rows) => rows.length === 0 ? null : (
          <div>
            <h3 className="mb-2 font-medium text-gray-900">Your requests</h3>
            <ul className="divide-y divide-border rounded-card border border-border">
              {rows.map((row) => (
                <li key={row.id} className="p-3">
                  <p className="font-medium text-gray-900">{KINDS.find((option) => option.value === row.kind)?.label ?? row.kind}</p>
                  <p className="text-xs text-gray-500">Sent {formatTimestamp(row.submittedAt)}</p>
                  {row.resolvedAt
                    ? <p className="mt-1 text-gray-700"><span className="font-medium">Clinic reply ({formatTimestamp(row.resolvedAt)}):</span> {row.resolutionNote}</p>
                    : <p className="mt-1 text-gray-600">Waiting for the clinic.</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AsyncBoundary>
    </div>
  )
}
