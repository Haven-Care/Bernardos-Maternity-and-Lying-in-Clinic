import { useRef, useState } from 'react'
import * as api from '../../../api'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { NumberField, SelectField, TextArea } from '../../../components/ui/fields'
import { useToast } from '../../../components/ui/toast-context'
import type { BatchListRow } from '../../../types/medicine'

export type BatchAction = 'dispensed' | 'disposed' | 'adjustment'
const TITLES: Record<BatchAction, string> = { dispensed: 'Stock Out', disposed: 'Record Disposal', adjustment: 'Record Count Adjustment' }

export function BatchActionModal({ batch, action, onClose, onSaved }: { batch: BatchListRow; action: BatchAction; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [quantity, setQuantity] = useState<number | ''>('')
  const [direction, setDirection] = useState('remove')
  const [note, setNote] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const inFlight = useRef(false)
  const delta = action === 'adjustment' && direction === 'add' ? Number(quantity) : -Number(quantity)
  const after = batch.quantity + delta
  const valid = note.trim() && (Number.isInteger(quantity) && Number(quantity) > 0 && after >= 0) && (action !== 'disposed' || acknowledged)

  async function save() {
    if (!valid || inFlight.current) return
    inFlight.current = true; setSaving(true); setError(undefined)
    try {
      await api.inventory.moveStock(batch.id, { quantity: action === 'adjustment' ? delta : Number(quantity), reason: action, note })
      toast.success(TITLES[action], 'The batch and inventory history have been updated.')
      onSaved(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this movement.') }
    finally { inFlight.current = false; setSaving(false) }
  }
  return <Modal open onClose={onClose} title={TITLES[action]} busy={saving} dirty={quantity !== '' || !!note || acknowledged}
    description={`${batch.medicineName} ${batch.dosage} · ${batch.manufacturerLot || 'Lot not recorded'} · ${batch.batchNo}`}
    footer={<Button variant={action === 'disposed' ? 'danger' : 'primary'} onClick={() => void save()} loading={saving} disabled={!valid}>{TITLES[action]}</Button>}>
    <fieldset disabled={saving} className="flex flex-col gap-4">
        {action === 'adjustment' && <>
          <p className="text-sm text-gray-600">Correct a verified physical count. Use Receive Stock for deliveries. A correction is logged without editing earlier movements.</p>
          <SelectField label="Adjustment Direction" value={direction} onChange={setDirection} options={[{ value: 'remove', label: 'Decrease count' }, { value: 'add', label: 'Increase count' }]} />
        </>}
        <NumberField label={action === 'disposed' ? 'Quantity Disposed' : action === 'dispensed' ? 'Quantity Out' : 'Quantity Difference'} required min={1} max={action === 'adjustment' && direction === 'add' ? 2_147_483_647 - batch.quantity : batch.quantity} value={quantity} onChange={setQuantity} suffix={batch.unit}
          error={after < 0 ? `Only ${batch.quantity} ${batch.unit} remain.` : undefined} />
        <p className="rounded-md bg-gray-50 p-3 text-sm">Batch balance: <strong>{batch.quantity} → {after} {batch.unit}</strong></p>
      <TextArea label="Reason / Reference" required value={note} onChange={setNote} placeholder={action === 'disposed' ? 'Reason, disposal date, and disposal reference' : 'Explain this inventory action'} />
      {action === 'disposed' && <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />I confirm this quantity has already been physically disposed of under the clinic’s procedure. This records the disposal; it does not perform it.</label>}
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </fieldset>
  </Modal>
}
