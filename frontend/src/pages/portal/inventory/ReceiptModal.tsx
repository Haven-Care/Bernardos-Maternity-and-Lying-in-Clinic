import { useRef, useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { NumberField, SelectField, TextArea, TextField } from '../../../components/ui/fields'
import { useToast } from '../../../components/ui/toast-context'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { canReceiveStock } from '../../../lib/inventory'
import { clinicDate } from '../../../lib/dateRange'
import type { BatchListRow } from '../../../types/medicine'

export function ReceiptModal({ batch, medicineId: initialMedicineId, onClose, onSaved }: { batch?: BatchListRow; medicineId?: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const medicines = useAsync(() => api.inventory.listMedicines())
  const [medicineId, setMedicineId] = useState(batch?.medicineId ?? initialMedicineId ?? '')
  const batches = useAsync(() => medicineId ? api.inventory.listBatches(medicineId) : Promise.resolve([]), [medicineId])
  const [batchId, setBatchId] = useState(batch?.id ?? '')
  const [lot, setLot] = useState(batch?.manufacturerLot ?? '')
  const [expiry, setExpiry] = useState(batch?.expiresAt ?? '')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  const selectedMedicine = medicines.data?.find((m) => m.id === medicineId)
  const today = clinicDate(new Date().toISOString())
  const valid = medicineId && Number.isInteger(quantity) && Number(quantity) > 0 && expiry >= today && note.trim() && (!batchId || batches.data?.some((b) => b.id === batchId && b.medicineId === medicineId))

  function selectBatch(id: string) {
    setBatchId(id)
    const selected = batches.data?.find((b) => b.id === id)
    setLot(selected?.manufacturerLot ?? '')
    setExpiry(selected?.expiresAt ?? '')
  }
  async function save() {
    if (!valid || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(undefined)
    try {
      await api.inventory.receiveStock({ medicineId, ...(batchId ? { batchId } : {}), manufacturerLot: lot, expiresAt: expiry, quantity: Number(quantity), note })
      toast.success('Stock received', 'The batch and stock movement have been saved.')
      onSaved(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not receive stock.') }
    finally { inFlight.current = false; setSaving(false) }
  }
  return <Modal open onClose={onClose} title="Receive Stock" busy={saving} dirty={quantity !== '' || !!note || (!batchId && (!!lot || !!expiry))}
    description="Record a delivery into a new batch or add to an existing lot."
    footer={<Button onClick={() => void save()} loading={saving} disabled={!valid}>Record Receipt</Button>}>
    <AsyncBoundary state={medicines} empty={<EmptyState title="Add an active medicine first" />}>
      {(items) => <fieldset disabled={saving} className="flex flex-col gap-4">
        <SelectField label="Medicine" required value={medicineId} disabled={!!batch} placeholder="Choose a medicine"
          options={items.map((m) => ({ value: m.id, label: `${m.genericName} · ${m.brandName} ${m.dosage} (${m.unit})` }))}
          onChange={(id) => { setMedicineId(id); setBatchId(''); setLot(''); setExpiry('') }} />
        {medicineId && <>
          <SelectField label="Batch" value={batchId} onChange={selectBatch} disabled={!!batch || batches.loading}
            options={[{ value: '', label: 'New batch' }, ...(batches.data ?? []).filter((b) => b.medicineId === medicineId && canReceiveStock(b)).map((b) => ({ value: b.id, label: `${b.manufacturerLot || 'Lot not recorded'} · ${b.batchNo} · expires ${b.expiresAt}` }))]} />
          {batches.error && <p role="alert" className="text-sm text-danger-700">Could not load batches. <button type="button" onClick={batches.reload} className="underline">Retry</button></p>}
          <TextField validation="lot" maxLength={64} label="Manufacturer Lot Number (optional)" value={lot} onChange={setLot} disabled={!!batchId}
            hint="Copy from the packaging. Leave blank if unavailable; an internal batch reference is generated separately." />
          <TextField label="Expiration Date" type="date" min={today} required value={expiry} onChange={setExpiry} disabled={!!batchId}
            error={expiry && expiry < today ? 'Expired stock cannot be received.' : undefined} />
          <p className="text-xs text-gray-500">An existing manufacturer lot keeps its original expiry date. A different lot must be received as a new batch.</p>
          <NumberField label="Quantity Received" required min={1} max={2_147_483_647 - (batches.data?.find((b) => b.id === batchId)?.quantity ?? 0)} value={quantity} onChange={setQuantity} suffix={selectedMedicine?.unit} />
          {batchId && <p className="text-xs text-gray-500">Batch balance: {batches.data?.find((b) => b.id === batchId)?.quantity ?? '…'} → {(batches.data?.find((b) => b.id === batchId)?.quantity ?? 0) + Number(quantity)} {selectedMedicine?.unit}</p>}
          <TextArea label="Receipt Note" required value={note} onChange={setNote} placeholder="Supplier, delivery reference, or reason for this receipt" />
        </>}
        {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
      </fieldset>}
    </AsyncBoundary>
  </Modal>
}
