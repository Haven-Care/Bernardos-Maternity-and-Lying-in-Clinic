import { useState } from 'react'
import type { RescheduleRequest } from '../../../types/appointment'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { formatDate, formatTime, formatTimestamp } from '../../../lib/format'

/**
 * Patient-initiated reschedules awaiting a decision.
 *
 * **No Figma frame exists for this screen.** The design models reschedule only
 * as something staff impose from the booking detail modal — gap #5 in the
 * flowchart spec, which flagged that reschedule is bidirectional but modelled
 * once. This is built against the language of the tabs either side of it: the
 * same Card, the same Table, the same inline actions as Booking Requests.
 *
 * The row shows the move as "from → to" rather than just the proposal, because
 * the decision is a comparison. Staff are not asked "is Tuesday 9am free", they
 * are asked "is moving this patient off Thursday worth doing".
 */
export function RescheduleQueue({ onDecided }: { onDecided?: () => void }) {
  const requests = useAsync(() => api.rescheduleRequests.listRescheduleRequests())

  return (
    <Card>
      <AsyncBoundary
        state={requests}
        empty={
          <EmptyState
            title="No reschedule requests"
            description="When a patient asks to move an appointment, it lands here for approval."
          />
        }
      >
        {(rows) => (
          <Table
            columns={columns(() => {
              requests.reload()
              onDecided?.()
            })}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <EmptyState
                title="No reschedule requests"
                description="When a patient asks to move an appointment, it lands here for approval."
              />
            }
          />
        )}
      </AsyncBoundary>
    </Card>
  )
}

function columns(onDecided: () => void): Column<RescheduleRequest>[] {
  return [
    {
      key: 'ref',
      header: 'Reference No.',
      render: (r) => (
        <span className="font-medium text-gray-900">{r.referenceNo}</span>
      ),
    },
    { key: 'patient', header: 'Patient', render: (r) => r.patientName },
    { key: 'service', header: 'Service', render: (r) => r.serviceName },
    {
      key: 'move',
      header: 'Requested change',
      render: (r) => (
        <span className="whitespace-nowrap">
          <span className="text-gray-400 line-through">
            {formatDate(r.currentDate)}, {formatTime(r.currentTime)}
          </span>
          <span className="mx-1.5 text-gray-300">→</span>
          <span className="font-medium text-gray-900">
            {formatDate(r.proposedDate)}, {formatTime(r.proposedTime)}
          </span>
        </span>
      ),
    },
    {
      key: 'asked',
      header: 'Requested',
      render: (r) => (
        <span className="text-gray-500">{formatTimestamp(r.requestedAt)}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (r) => <Decision request={r} onDecided={onDecided} />,
    },
  ]
}

function Decision({
  request,
  onDecided,
}: {
  request: RescheduleRequest
  onDecided: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)

  async function decide(action: 'approve' | 'decline') {
    setBusy(action)

    try {
      if (action === 'approve') {
        await api.rescheduleRequests.approveRescheduleRequest(request.id)
        toast.success(
          'Appointment moved',
          `${request.patientName} is now on ${formatDate(request.proposedDate)}, ${formatTime(request.proposedTime)}.`,
        )
      } else {
        await api.rescheduleRequests.declineRescheduleRequest(request.id)
        toast.success(
          'Request declined',
          'The appointment keeps its original time.',
        )
      }

      onDecided()
    } catch (err) {
      // Approval re-checks capacity, so the proposed slot filling while the
      // request sat in this queue is a real and expected failure. The request
      // stays open rather than being marked done against a booking that never
      // moved, so the message has to say what happened.
      toast.error(
        action === 'approve' ? 'Could not approve' : 'Could not decline',
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void decide('decline')}
        loading={busy === 'decline'}
        disabled={busy !== null}
      >
        Decline
      </Button>
      <Button
        size="sm"
        variant="success"
        onClick={() => void decide('approve')}
        loading={busy === 'approve'}
        disabled={busy !== null}
      >
        Approve
      </Button>
    </div>
  )
}
