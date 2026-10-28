import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { ConfirmModal } from '../../../components/ui/Modal'
import { useToast } from '../../../components/ui/toast-context'

export function MedicineList({
  version,
  onChanged,
}: {
  version: number
  onChanged: () => void
}) {
  const medicines = useAsync(() => api.inventory.listMedicines(true), [version])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<MedicineListRow | null>(null)
  const [catalogue, setCatalogue] = useState('active')
  const [archiving, setArchiving] = useState<MedicineListRow>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const toast = useToast()
  async function archive() {
    if (!archiving || saving) return
    setSaving(true); setError(undefined)
    try {
      await api.inventory.archiveMedicine(archiving.id, archiving.active)
      toast.success(archiving.active ? 'Medicine archived' : 'Medicine restored', 'Batch and movement history have been retained.')
      setArchiving(undefined); onChanged()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update this medicine.'); setArchiving(undefined) }
    finally { setSaving(false) }
  }

  const categories = useMemo(
    () => [...new Set((medicines.data ?? []).map((m) => m.category).filter((category) => category.trim() !== ''))].sort(),
    [medicines.data],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (medicines.data ?? [])
      .filter((m) => catalogue === 'all' || (catalogue === 'active' ? m.active : !m.active))
      .filter((m) => (category ? m.category === category : true))
      .filter((m) => (status ? m.stockStatus === status : true))
      .filter((m) =>
        term
          ? m.genericName.toLowerCase().includes(term) ||
            m.brandName.toLowerCase().includes(term)
          : true,
      )
  }, [medicines.data, search, category, status, catalogue])

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
      header: 'Available / Physical',
      align: 'right',
      render: (m) => (
        <div className="tabular-nums"><p className="font-medium">{m.qtyOnHand} {m.unit} available</p><p className="text-xs text-gray-500">{m.physicalQty ?? m.qtyOnHand} physical · {m.expiredQty ?? 0} expired</p></div>
      ),
    },
    {
      key: 'expiry',
      header: 'Next Usable Expiry',
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
      render: (m) => <div><StockBadge status={m.stockStatus} /><p className="mt-1 text-xs text-gray-500">Reorder at ≤ {m.reorderLevel} {m.unit}</p>{!m.active && <p className="text-xs text-gray-400">Archived</p>}</div>,
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (m) => (
        <div className="flex justify-end gap-2 text-xs font-medium whitespace-nowrap">
          <Link className="py-2 text-brand-700 hover:underline" to={`?tab=batches&medicineId=${encodeURIComponent(m.id)}`}>Batches</Link>
          <button
            type="button"
            onClick={() => setEditing(m)}
            className="text-gray-600 hover:underline"
          >
            Edit
          </button>
          <button type="button" className="py-2 text-gray-600 hover:underline disabled:cursor-not-allowed disabled:text-gray-300"
            disabled={m.active && (m.physicalQty ?? m.qtyOnHand) > 0}
            title={m.active && (m.physicalQty ?? m.qtyOnHand) > 0 ? 'Resolve remaining physical stock before archiving.' : undefined}
            onClick={() => setArchiving(m)}>{m.active ? 'Archive' : 'Restore'}</button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Card className="portal-table-card">
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
                { value: 'good', label: 'In Stock' },
                { value: 'low', label: 'Low Stock' },
                { value: 'out', label: 'Out of Stock' },
              ]}
            />
          </div>
          <div className="w-48"><SelectField label="Catalogue" value={catalogue} onChange={setCatalogue} options={[{ value: 'active', label: 'Active medicines' }, { value: 'archived', label: 'Archived medicines' }, { value: 'all', label: 'All medicines' }]} /></div>
          <div className="ml-auto w-full sm:w-64">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Search medicine"
            />
          </div>
        </div>

        <p className="px-4 py-2 text-xs text-gray-500">Available stock excludes expired batches. Physical stock includes all remaining units. Use Batches to record stock changes.</p>
        {error && <p role="alert" className="px-4 py-2 text-sm text-danger-700">{error}</p>}
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
            <Table fillHeight fitRows
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

      {archiving && <ConfirmModal open onClose={() => setArchiving(undefined)} onConfirm={() => void archive()} loading={saving}
        title={archiving.active ? 'Archive Medicine?' : 'Restore Medicine?'} tone="primary" confirmLabel={archiving.active ? 'Archive' : 'Restore'}
        message={`${archiving.genericName} will be ${archiving.active ? 'removed from the active catalogue' : 'returned to the active catalogue'}. Batch and stock movement history will remain available.`} />}

    </>
  )
}
