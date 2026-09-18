import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import type { LowStockRow } from '../../../types/medicine'

/**
 * Medicines below their own reorder level.
 *
 * The threshold is per-medicine, not global — 20 Ferrous Sulfate is a problem
 * at a reorder level of 70, while 20 of something ordered in tens is fine. The
 * bar makes that ratio legible at a glance, which a bare number doesn't.
 */
export function LowStock({ version }: { version: number }) {
  const rows = useAsync(() => api.inventory.listLowStock(), [version])

  const columns: Column<LowStockRow>[] = [
    {
      key: 'name',
      header: 'Generic Name',
      render: (r) => (
        <span className="font-medium text-gray-900">{r.genericName}</span>
      ),
    },
    {
      key: 'qty',
      header: 'Qty on Hand',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums font-medium text-danger-700">
          {r.qtyOnHand} {r.unit}
        </span>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder Level',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums text-gray-500">
          {r.reorderLevel} {r.unit}
        </span>
      ),
    },
    {
      key: 'level',
      header: 'Level',
      className: 'w-40',
      render: (r) => {
        const pct = Math.min(100, Math.round((r.qtyOnHand / r.reorderLevel) * 100))
        return (
          <div className="flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"
              role="img"
              aria-label={`${pct}% of reorder level`}
            >
              <div
                className={`h-full rounded-full ${pct < 50 ? 'bg-danger-500' : 'bg-warning-500'}`}
                style={{ width: `${Math.max(pct, 3)}%` }}
              />
            </div>
            <span className="w-9 text-right text-xs tabular-nums text-gray-400">
              {pct}%
            </span>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      render: (r) => (
        <Badge tone={r.qtyOnHand === 0 ? 'danger' : 'warning'}>
          {r.qtyOnHand === 0 ? 'Out of Stock' : 'Low Stock'}
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
            title="Everything is above its reorder level"
            description="Medicines that drop below their threshold will appear here."
          />
        }
      >
        {(data) => (
          <Table columns={columns} rows={data} rowKey={(r) => r.medicineId} />
        )}
      </AsyncBoundary>
    </Card>
  )
}
