import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { SearchField, SelectField } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { formatDate } from '../../../lib/format'
import { BATCH_LABELS, batchState, canReceiveStock } from '../../../lib/inventory'
import type { BatchListRow } from '../../../types/medicine'
import { BatchActionModal, type BatchAction } from './BatchActionModal'
import { ReceiptModal } from './ReceiptModal'
import { MovementTable } from './StockMovements'

export function BatchControls({ batch, onAction, onReceipt }: { batch: BatchListRow; onAction: (action: BatchAction) => void; onReceipt?: () => void }) {
  const state = batchState(batch)
  const actions = batch.medicineActive ? [
    ...(state === 'available' ? [{ value: 'dispensed', label: 'Stock Out' }] : []),
    ...(canReceiveStock(batch) && onReceipt ? [{ value: 'receive', label: 'Receive more' }] : []),
    ...(batch.quantity > 0 ? [{ value: 'disposed', label: 'Record disposal' }] : []),
    ...(state !== 'disposed' ? [{ value: 'adjustment', label: 'Count adjustment' }] : []),
  ] : []
  return actions.length ? <select aria-label={`Action for ${batch.batchNo}`} value="" className="max-w-44 rounded-md border border-border bg-white px-2 py-2 text-xs text-brand-700"
    onChange={(event) => { const action = event.target.value; if (action === 'receive') onReceipt?.(); else if (action) onAction(action as BatchAction) }}>
    <option value="">Choose action</option>{actions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
  </select> : <span className="text-xs text-gray-400">{batch.medicineActive ? 'History retained' : 'Restore medicine to record stock'}</span>
}

export function Batches({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [params, setParams] = useSearchParams()
  const medicineId = params.get('medicineId') ?? ''
  const batches = useAsync(() => api.inventory.listAllBatches(), [version])
  const [search, setSearch] = useState('')
  const [state, setState] = useState(medicineId ? 'all' : 'stock')
  const [action, setAction] = useState<{ batch: BatchListRow; action: BatchAction }>()
  const [receipt, setReceipt] = useState<BatchListRow>()
  const [adding, setAdding] = useState(false)
  const rows = useMemo(() => (batches.data ?? []).filter((batch) =>
    (!medicineId || batch.medicineId === medicineId) &&
    (state === 'all' || (state === 'stock' ? batch.quantity > 0 : batchState(batch) === state)) &&
    `${batch.medicineName} ${batch.brandName} ${batch.dosage} ${batch.batchNo} ${batch.manufacturerLot ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()),
  ), [batches.data, medicineId, state, search])
  const columns: Column<BatchListRow>[] = [
    { key: 'medicine', header: 'Medicine', render: (batch) => <div><p className="font-medium text-gray-900">{batch.medicineName}</p><p className="text-xs text-gray-500">{batch.brandName} · {batch.dosage}{!batch.medicineActive && ' · Archived'}</p></div> },
    { key: 'lot', header: 'Manufacturer Lot / Internal Ref.', render: (batch) => <div><p>{batch.manufacturerLot || 'Lot not recorded'}</p><p className="text-xs text-gray-400">{batch.batchNo}</p></div> },
    { key: 'expiry', header: 'Expiry', render: (batch) => formatDate(batch.expiresAt) },
    { key: 'quantity', header: 'Physical Balance', align: 'right', render: (batch) => `${batch.quantity} ${batch.unit}` },
    { key: 'state', header: 'Batch State', render: (batch) => <div><Badge tone={batchState(batch) === 'available' ? 'success' : batchState(batch) === 'expired' ? 'danger' : 'neutral'}>{BATCH_LABELS[batchState(batch)]}</Badge></div> },
    { key: 'action', header: 'Action', align: 'right', render: (batch) => <BatchControls batch={batch} onAction={(action) => setAction({ batch, action })} onReceipt={() => setReceipt(batch)} /> },
  ]
  return <>
    <Card className="portal-table-card">
      <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
        <div className="w-52"><SelectField label="Batch State" value={state} onChange={setState} options={[{ value: 'stock', label: 'With remaining stock' }, { value: 'all', label: 'All batches / history' }, ...Object.entries(BATCH_LABELS).map(([value, label]) => ({ value, label }))]} /></div>
        {medicineId && <button type="button" className="py-2 text-sm text-brand-700 underline" onClick={() => setParams((previous) => { previous.delete('medicineId'); return previous })}>Clear medicine filter</button>}
        <div className="ml-auto w-full sm:w-72"><SearchField value={search} onChange={setSearch} placeholder="Search medicine, lot, or reference" /></div>
        <Button size="sm" onClick={() => setAdding(true)}>Add Batch</Button>
        <p className="w-full text-xs text-gray-500">Expand a batch to see receipts and stock movements. Empty and disposed batches remain in All batches / history.</p>
      </div>
      <AsyncBoundary state={batches} empty={<EmptyState title="No batches yet" description="Use Receive Stock to record the first delivery." />}>
        {() => <Table fillHeight columns={columns} rows={rows} rowKey={(batch) => batch.id} empty={<EmptyState title="No batches match these filters" />}
          expandable={{ label: (batch) => `batch ${batch.batchNo}`, render: (batch) => <BatchHistory key={`${batch.id}-${version}`} batch={batch} onChanged={onChanged} /> }} />}
      </AsyncBoundary>
    </Card>
    {action && <BatchActionModal {...action} onClose={() => setAction(undefined)} onSaved={onChanged} />}
    {receipt && <ReceiptModal batch={receipt} onClose={() => setReceipt(undefined)} onSaved={onChanged} />}
    {adding && <ReceiptModal onClose={() => setAdding(false)} onSaved={onChanged} />}
  </>
}

function BatchHistory({ batch, onChanged }: { batch: BatchListRow; onChanged: () => void }) {
  const movements = useAsync(() => api.inventory.listMovements(undefined, batch.id))
  const events = useAsync(() => api.inventory.listBatchEvents(batch.id))
  return <div className="flex flex-col gap-4">
    <div><h3 className="font-semibold text-gray-900">Batch history · {batch.batchNo}</h3><p className="mt-1 text-xs text-gray-500">Received {formatDate(batch.receivedAt)} · Expires {formatDate(batch.expiresAt)}</p></div>
    <AsyncBoundary state={movements} empty={<EmptyState title="No recorded quantity movements" />}>
      {(data) => <MovementTable rows={data} onChanged={onChanged} />}
    </AsyncBoundary>
    {(events.error || (events.data?.length ?? 0) > 0) ? <h4 className="text-sm font-semibold">Historical batch events</h4> : null}
    <AsyncBoundary state={events} empty={null}>
      {(data) => <ul className="space-y-2 text-sm">{data.map((event) => <li key={event.id} className="rounded-md border border-border bg-white p-3"><p className="font-medium">{event.action === 'quarantined' ? 'Quarantined' : 'Released'} · {new Date(event.occurredAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · {event.createdBy}</p><p className="mt-1 text-gray-600">{event.reason}</p></li>)}</ul>}
    </AsyncBoundary>
  </div>
}
