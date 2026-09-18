import { useMemo, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Card } from '../../../components/ui/Card'
import { SearchField, SelectField } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import type { StockMovement } from '../../../types/medicine'

/**
 * The audit trail. Every change to stock appears here, because stock is only
 * ever moved by recording a movement — never by writing a quantity.
 *
 * Medicine names are resolved here rather than denormalised onto the movement,
 * so renaming a medicine doesn't leave stale names scattered through history.
 */
export function StockMovements({ version }: { version: number }) {
  const movements = useAsync(() => api.inventory.listMovements(), [version])
  const medicines = useAsync(() => api.inventory.listMedicines(), [version])

  const [type, setType] = useState('')
  const [search, setSearch] = useState('')

  const byId = useMemo(
    () => new Map((medicines.data ?? []).map((m) => [m.id, m])),
    [medicines.data],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (movements.data ?? [])
      .filter((m) => (type ? m.type === type : true))
      .filter((m) => {
        if (!term) return true
        const medicine = byId.get(m.medicineId)
        return (
          medicine?.genericName.toLowerCase().includes(term) ||
          m.note.toLowerCase().includes(term)
        )
      })
  }, [movements.data, type, search, byId])

  const columns: Column<StockMovement>[] = [
    {
      key: 'when',
      header: 'Date',
      render: (m) => (
        <span className="whitespace-nowrap">
          {new Date(m.occurredAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Time',
      render: (m) => (
        <span className="whitespace-nowrap text-gray-500">
          {new Date(m.occurredAt).toLocaleTimeString('en-PH', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (m) => (
        <Badge tone={m.type === 'stock_in' ? 'success' : 'danger'}>
          {m.type === 'stock_in' ? 'Stock In' : 'Stock Out'}
        </Badge>
      ),
    },
    {
      key: 'item',
      header: 'Item Name',
      render: (m) => (
        <span className="font-medium text-gray-900">
          {byId.get(m.medicineId)?.genericName ?? 'Unknown'}
        </span>
      ),
    },
    {
      key: 'form',
      header: 'Form',
      render: (m) => byId.get(m.medicineId)?.dosageForm ?? '—',
    },
    {
      key: 'dosage',
      header: 'Dosage',
      render: (m) => byId.get(m.medicineId)?.dosage ?? '—',
    },
    {
      key: 'qty',
      header: 'Qty',
      align: 'right',
      render: (m) => {
        const unit = byId.get(m.medicineId)?.unit ?? ''
        return (
          <span
            className={`tabular-nums font-medium ${
              m.type === 'stock_in' ? 'text-success-700' : 'text-danger-700'
            }`}
          >
            {m.type === 'stock_in' ? '+' : '−'}
            {m.quantity} {unit}
          </span>
        )
      },
    },
    {
      key: 'note',
      header: 'Note',
      render: (m) => <span className="text-gray-500">{m.note}</span>,
    },
  ]

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <div className="w-40">
          <SelectField
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: '', label: 'All Types' },
              { value: 'stock_in', label: 'Stock In' },
              { value: 'stock_out', label: 'Stock Out' },
            ]}
          />
        </div>
        <div className="ml-auto w-full sm:w-64">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search item or note"
          />
        </div>
      </div>

      <AsyncBoundary
        state={movements}
        empty={
          <EmptyState
            title="No stock movements yet"
            description="Recording stock in or out will log it here."
          />
        }
      >
        {() => (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            empty={<EmptyState title="Nothing matches those filters" />}
          />
        )}
      </AsyncBoundary>
    </Card>
  )
}
