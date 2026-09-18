import { useMemo, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Card } from '../../../components/ui/Card'
import { Table, type Column } from '../../../components/ui/Table'
import { StockBadge } from '../../../components/ui/Badge'
import { SearchField, SelectField } from '../../../components/ui/fields'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate } from '../../../lib/format'
import type { MedicineListRow } from '../../../types/medicine'
import { MedicineModal } from './MedicineModal'
import { StockModal } from './StockModal'

export function MedicineList({
  version,
  onChanged,
}: {
  version: number
  onChanged: () => void
}) {
  const medicines = useAsync(() => api.inventory.listMedicines(), [version])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<MedicineListRow | null>(null)
  const [stock, setStock] = useState<{
    medicine: MedicineListRow
    direction: 'in' | 'out'
  } | null>(null)

  const categories = useMemo(
    () => [...new Set((medicines.data ?? []).map((m) => m.category))].sort(),
    [medicines.data],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (medicines.data ?? [])
      .filter((m) => (category ? m.category === category : true))
      .filter((m) => (status ? m.stockStatus === status : true))
      .filter((m) =>
        term
          ? m.genericName.toLowerCase().includes(term) ||
            m.brandName.toLowerCase().includes(term)
          : true,
      )
  }, [medicines.data, search, category, status])

  const columns: Column<MedicineListRow>[] = [
    {
      key: 'name',
      header: 'Generic Name',
      render: (m) => (
        <div>
          <p className="font-medium text-gray-900">{m.genericName}</p>
          {m.brandName && (
            <p className="text-xs text-gray-400">{m.brandName}</p>
          )}
        </div>
      ),
    },
    { key: 'form', header: 'Dosage Form', render: (m) => m.dosageForm },
    { key: 'dosage', header: 'Dosage', render: (m) => m.dosage },
    {
      key: 'qty',
      header: 'Qty on Hand',
      align: 'right',
      render: (m) => (
        <span className="tabular-nums">
          {m.qtyOnHand} {m.unit}
        </span>
      ),
    },
    {
      key: 'expiry',
      header: 'Expiration Date',
      render: (m) =>
        m.nearestExpiry ? (
          formatDate(m.nearestExpiry)
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => <StockBadge status={m.stockStatus} />,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-2 text-xs font-medium whitespace-nowrap">
          <button
            type="button"
            onClick={() => setStock({ medicine: m, direction: 'in' })}
            className="text-brand-600 hover:underline"
          >
            Stock In
          </button>
          <button
            type="button"
            onClick={() => setStock({ medicine: m, direction: 'out' })}
            disabled={m.qtyOnHand === 0}
            className="text-gray-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
          >
            Stock Out
          </button>
          <button
            type="button"
            onClick={() => setEditing(m)}
            className="text-gray-600 hover:underline"
          >
            Edit
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <div className="w-44">
            <SelectField
              label="Category"
              value={category}
              onChange={setCategory}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>
          <div className="w-40">
            <SelectField
              label="Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'All Status' },
                { value: 'good', label: 'Good' },
                { value: 'low', label: 'Low Stock' },
                { value: 'out', label: 'Out of Stock' },
              ]}
            />
          </div>
          <div className="ml-auto w-full sm:w-64">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search medicine"
            />
          </div>
        </div>

        <AsyncBoundary
          state={medicines}
          empty={
            <EmptyState
              title="No medicines yet"
              description="Add a medicine to start tracking stock and expiry."
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

      {editing && (
        <MedicineModal
          medicine={editing}
          open={editing !== null}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}

      {stock && (
        <StockModal
          medicine={stock.medicine}
          direction={stock.direction}
          open={stock !== null}
          onClose={() => setStock(null)}
          onSaved={onChanged}
        />
      )}
    </>
  )
}
