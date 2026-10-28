import { useMemo, useRef, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { Card } from '../../../components/ui/Card'
import { SearchField, SelectField, TextArea } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { DateRangeFields } from '../../../components/ui/DateRangeFields'
import { useToast } from '../../../components/ui/toast-context'
import { clinicDate, dateRangeError, withinDateRange } from '../../../lib/dateRange'
import { MOVEMENT_LABELS } from '../../../lib/inventory'
import type { StockMovement } from '../../../types/medicine'

export function StockMovements({ version, onChanged }: { version: number; onChanged: () => void }) {
  const [dates, setDates] = useState({ from: '', to: '' })
  const movements = useAsync(() => dateRangeError(dates) ? Promise.resolve([]) : api.inventory.listMovements(dates), [version, dates.from, dates.to])
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (movements.data ?? []).filter((m) => withinDateRange(clinicDate(m.occurredAt), dates) && (!type || (m.reason ?? 'legacy') === type) &&
      `${m.medicineName} ${m.brandName} ${m.batchNo} ${m.manufacturerLot ?? ''} ${m.note} ${m.createdBy}`.toLowerCase().includes(term))
  }, [movements.data, type, search, dates])
  return <Card className="portal-table-card">
    <div className="flex flex-wrap items-end gap-3 border-b border-border p-4">
      <div className="w-44"><SelectField label="Movement" value={type} onChange={setType} options={[{ value: '', label: 'All movements' }, ...Object.entries(MOVEMENT_LABELS).map(([value, label]) => ({ value, label }))]} /></div>
      <DateRangeFields value={dates} onChange={setDates} />
      <div className="ml-auto w-full sm:w-64"><SearchField value={search} onChange={setSearch} placeholder="Search medicine, lot, note, or staff" /></div>
      <p className="w-full text-xs text-gray-500">History is retained when a batch is empty or a medicine is archived. Legacy entries keep their original direction and note; their purpose and balances were not reconstructed.</p>
    </div>
    <AsyncBoundary state={movements} empty={<EmptyState title="No stock movements yet" description="Receipts, stock out, disposal, and corrections are recorded here." />}>
      {() => <MovementTable rows={rows} onChanged={onChanged} fillHeight />}
    </AsyncBoundary>
  </Card>
}

export function MovementTable({ rows, onChanged, fillHeight = false }: { rows: StockMovement[]; onChanged: () => void; fillHeight?: boolean }) {
  const [reversing, setReversing] = useState<StockMovement>()
  const columns: Column<StockMovement>[] = [
    { key: 'when', header: 'Date / Staff', render: (m) => <div><p className="whitespace-nowrap">{new Date(m.occurredAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p><p className="text-xs text-gray-500">{m.createdBy}</p></div> },
    { key: 'type', header: 'Movement', render: (m) => <div><Badge tone={m.reason === 'disposed' ? 'danger' : m.type === 'stock_in' ? 'success' : 'neutral'}>{MOVEMENT_LABELS[m.reason ?? 'legacy']}</Badge>{m.reason === 'legacy' && <p className="mt-1 text-xs text-gray-500">{m.type === 'stock_in' ? 'Stock in' : 'Stock out'}</p>}{m.reversed && <p className="mt-1 text-xs text-gray-500">Reversed</p>}{m.reversesMovementId && <p className="mt-1 text-xs text-gray-500">Corrects {m.reversesMovementId.slice(0, 8)}</p>}</div> },
    { key: 'item', header: 'Medicine / Batch', render: (m) => <div><p className="font-medium text-gray-900">{m.medicineName ?? 'Historical medicine'}</p><p className="text-xs text-gray-500">{m.brandName} {m.dosage}</p><p className="text-xs text-gray-500">{m.manufacturerLot || 'Lot not recorded'} · {m.batchNo}</p></div> },
    { key: 'qty', header: 'Quantity', align: 'right', render: (m) => <span className={`whitespace-nowrap tabular-nums ${m.type === 'stock_in' ? 'text-success-700' : 'text-danger-700'}`}>{m.type === 'stock_in' ? '+' : '−'}{m.quantity} {m.unit}</span> },
    { key: 'balance', header: 'Batch Before → After', render: (m) => m.quantityBefore == null || m.quantityAfter == null ? <span className="text-xs text-gray-400">Not recorded (legacy)</span> : <span className="whitespace-nowrap tabular-nums">{m.quantityBefore} → {m.quantityAfter} {m.unit}</span> },
    { key: 'note', header: 'Reason / Reference', render: (m) => <p className="min-w-40 max-w-80 whitespace-normal break-words text-gray-600">{m.note || '—'}</p> },
    { key: 'action', header: 'Correction', render: (m) => ['received', 'dispensed', 'adjustment'].includes(m.reason ?? '') && !m.reversed ? <button type="button" className="py-2 text-xs font-medium text-brand-700 underline" onClick={() => setReversing(m)}>Reverse entry</button> : <span className="text-xs text-gray-400">Retained</span> },
  ]
  return <><Table fillHeight={fillHeight} columns={columns} rows={rows} rowKey={(m) => m.id} empty={<EmptyState title="No movements match these filters" />} />
    {reversing && <ReverseModal movement={reversing} onClose={() => setReversing(undefined)} onSaved={onChanged} />}</>
}

function ReverseModal({ movement, onClose, onSaved }: { movement: StockMovement; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const inFlight = useRef(false)
  async function save() {
    if (!note.trim() || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(undefined)
    try { await api.inventory.reverseMovement(movement.id, note); toast.success('Correction recorded', 'The original entry remains linked to its reversal.'); onSaved(); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not reverse this entry.') }
    finally { inFlight.current = false; setSaving(false) }
  }
  return <Modal open title="Reverse Inventory Entry" onClose={onClose} busy={saving} dirty={!!note}
    footer={<Button onClick={() => void save()} loading={saving} disabled={!note.trim()}>Record Reversal</Button>}>
    <fieldset disabled={saving} className="space-y-4">
      <p className="text-sm text-gray-600">Correct an entry recorded in error. This adds an opposite movement of {movement.quantity} {movement.unit} to {movement.batchNo}. Use a new receipt or movement to record a new physical transaction.</p>
      <p className="text-xs text-gray-500">An entry can be reversed once, if the batch still supports the correction. Disposal and legacy entries cannot be reversed.</p>
      <TextArea label="Correction Reason" required value={note} onChange={setNote} />
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </fieldset>
  </Modal>
}
