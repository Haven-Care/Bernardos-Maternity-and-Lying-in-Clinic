import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate, formatDaysLeft } from '../../../lib/format'
import { BatchActionModal, type BatchAction } from './BatchActionModal'
import type { BatchListRow, ExpiringBatchRow } from '../../../types/medicine'

/**
 * Batches nearing expiry — one row per lot, not per medicine.
 *
 * This is the screen that forces batches to exist as their own entity: a
 * medicine holding 700 units across two lots expiring months apart has two
 * different answers to "when does this expire", and the clinic needs both.
 */
export function ExpirationTracker({ version, onChanged }: { version: number; onChanged: () => void }) {
  const rows = useAsync(() => api.inventory.listExpiring(), [version])
  const [selected, setSelected] = useState<{ batch: BatchListRow; action: BatchAction }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  async function act(row: ExpiringBatchRow, action: BatchAction) {
    if (loading) return
    setLoading(true); setError(undefined)
    try {
      const batches = await api.inventory.listAllBatches(row.medicineId)
      const batch = batches.find((batch) => batch.id === row.batchId)
      if (!batch) throw new Error('Batch no longer exists. Refresh and try again.')
      setSelected({ batch, action })
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load this batch.') }
    finally { setLoading(false) }
  }

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
      header: 'Manufacturer Lot / Internal Ref.',
      render: (r) => <div><p>{r.manufacturerLot || 'Lot not recorded'}</p><p className="text-xs text-gray-400">{r.batchNo}</p></div>,
    },
    { key: 'quantity', header: 'Remaining', align: 'right', render: (r) => `${r.quantity} ${r.unit ?? ''}` },
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
    { key: 'action', header: 'Action', align: 'right', render: (r) => <div className="flex justify-end gap-3 whitespace-nowrap text-xs"><button type="button" className="py-2 font-medium text-danger-700 underline disabled:opacity-40" disabled={loading} onClick={() => void act(r, 'disposed')}>Record disposal</button></div> },
  ]

  return (
    <>
    <Card className="portal-table-card">
      <p className="border-b border-border p-4 text-xs text-gray-500">Expired stock is already excluded from availability. Record disposal only after physical disposal. Completed disposals remain in Batches &amp; History.</p>
      {error && <p role="alert" className="p-4 text-sm text-danger-700">{error}</p>}
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
          <Table fillHeight fitRows columns={columns} rows={data} rowKey={(r) => r.batchId} />
        )}
      </AsyncBoundary>
    </Card>
    {selected && <BatchActionModal {...selected} onClose={() => setSelected(undefined)} onSaved={onChanged} />}
    </>
  )
}
