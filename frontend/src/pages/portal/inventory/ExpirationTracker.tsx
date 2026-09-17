import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate, formatDaysLeft } from '../../../lib/format'
import type { ExpiringBatchRow } from '../../../types/medicine'

/**
 * Batches nearing expiry — one row per lot, not per medicine.
 *
 * This is the screen that forces batches to exist as their own entity: a
 * medicine holding 700 units across two lots expiring months apart has two
 * different answers to "when does this expire", and the clinic needs both.
 */
export function ExpirationTracker({ version }: { version: number }) {
  const rows = useAsync(() => api.inventory.listExpiring(), [version])

  const columns: Column<ExpiringBatchRow>[] = [
    {
      key: 'name',
      header: 'Generic Name',
      render: (r) => (
        <span className="font-medium text-gray-900">{r.genericName}</span>
      ),
    },
    {
      key: 'batch',
      header: 'Batch No.',
      render: (r) => <span className="tabular-nums">{r.batchNo}</span>,
    },
    {
      key: 'expires',
      header: 'Expiration Date',
      render: (r) => formatDate(r.expiresAt),
    },
    {
      key: 'left',
      header: 'Days Left',
      align: 'right',
      render: (r) => (
        <span
          className={`tabular-nums font-medium ${
            r.daysLeft < 0
              ? 'text-danger-700'
              : r.daysLeft <= 7
                ? 'text-danger-700'
                : 'text-warning-700'
          }`}
        >
          {formatDaysLeft(r.daysLeft)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      // Severity is spelled out as well as coloured — the row must still read
      // correctly in greyscale or to a colour-blind reader.
      render: (r) => (
        <Badge tone={r.daysLeft < 0 ? 'danger' : r.daysLeft <= 7 ? 'danger' : 'warning'}>
          {r.daysLeft < 0
            ? 'Expired'
            : r.daysLeft <= 7
              ? 'Expiring this week'
              : 'Expiring soon'}
        </Badge>
      ),
    },
  ]

  return (
    <Card>
      <AsyncBoundary
        state={rows}
        empty={
          <EmptyState
            title="Nothing expiring soon"
            description="Batches nearing their expiration date will appear here."
          />
        }
      >
        {(data) => (
          <Table columns={columns} rows={data} rowKey={(r) => r.batchId} />
        )}
      </AsyncBoundary>
    </Card>
  )
}
