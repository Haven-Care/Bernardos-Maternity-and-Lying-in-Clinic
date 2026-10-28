import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import type { LowStockRow } from '../../../types/medicine'

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
      header: 'Available',
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
    { key: 'target', header: 'Target Stock', align: 'right', render: (r) => r.targetStockLevel == null ? 'Not set' : `${r.targetStockLevel} ${r.unit}` },
    { key: 'suggested', header: 'Suggested Replenishment', align: 'right', render: (r) => r.targetStockLevel == null ? 'Set a target to calculate' : `${Math.max(0, r.targetStockLevel - r.qtyOnHand)} ${r.unit}` },
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
    <Card className="portal-table-card">
      <p className="border-b border-border p-4 text-xs text-gray-500">The reorder level triggers an alert when available stock is at or below it. Target stock is an optional replenishment goal, not a maximum.</p>
      <AsyncBoundary
        state={rows}
        empty={
          <EmptyState
            title="Everything is above its reorder level"
            description="Medicines at or below their threshold will appear here."
          />
        }
      >
        {(data) => (
          <Table fillHeight fitRows columns={columns} rows={data} rowKey={(r) => r.medicineId} />
        )}
      </AsyncBoundary>
    </Card>
  )
}
