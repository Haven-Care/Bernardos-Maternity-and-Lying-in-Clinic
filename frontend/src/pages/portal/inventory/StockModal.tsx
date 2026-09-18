import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import {
  NumberField,
  SelectField,
  TextField,
} from '../../../components/ui/fields'
import { useToast } from '../../../components/ui/toast-context'
import { formatDate } from '../../../lib/format'
import { daysUntil } from '../../../lib/dates'
import type { MedicineListRow } from '../../../types/medicine'

/**
 * Record Stock In / Stock Out.
 *
 * Both write a movement rather than setting a quantity — the Stock Movement
 * log is the audit trail the clinic actually asked for, and a direct quantity
 * edit would leave an unexplained jump in it.
 */
export function StockModal({
  medicine,
  direction,
  open,
  onClose,
  onSaved,
}: {
  medicine: MedicineListRow
  direction: 'in' | 'out'
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const batches = useAsync(() => api.inventory.listBatches(medicine.id))

  const [batchNo, setBatchNo] = useState('')
  const [batchId, setBatchId] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [expiresAt, setExpiresAt] = useState('')
  const [note, setNote] = useState(direction === 'out' ? 'Dispensed to patient' : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const stockIn = direction === 'in'

  // Dispensing draws from a specific lot, so the options carry what's left and
  // how close it is to expiry — staff should be reaching for the oldest stock.
  const batchOptions = (batches.data ?? [])
    .filter((b) => b.quantity > 0)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    .map((b) => ({
      value: b.id,
      label: `${b.batchNo} — ${b.quantity} ${medicine.unit} left, expires ${formatDate(b.expiresAt)}${
        daysUntil(b.expiresAt) < 0 ? ' (expired)' : ''
      }`,
    }))

  const selectedBatch = batches.data?.find((b) => b.id === batchId)

  const overQuantity =
    !stockIn &&
    selectedBatch !== undefined &&
    quantity !== '' &&
    quantity > selectedBatch.quantity

  const backdated = stockIn && expiresAt !== '' && daysUntil(expiresAt) < 0

  // The form already knows both of these will be rejected, so don't invite the
  // click and then surface the same complaint a second time as a server error.
  const canSave = stockIn
    ? batchNo.trim() !== '' &&
      quantity !== '' &&
      quantity > 0 &&
      expiresAt !== '' &&
      !backdated
    : batchId !== '' && quantity !== '' && quantity > 0 && !overQuantity

  async function save() {
    setSaving(true)
    setError(undefined)

    try {
      if (stockIn) {
        await api.inventory.recordStockIn({
          medicineId: medicine.id,
          batchNo: batchNo.trim(),
          quantity: Number(quantity),
          expiresAt,
          note: note.trim() || 'Stock received',
        })
      } else {
        await api.inventory.recordStockOut({
          batchId,
          quantity: Number(quantity),
          note: note.trim() || 'Dispensed',
        })
      }

      toast.success(
        'Record Updated',
        'The changes have been saved to your inventory records.',
      )
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record movement')
    } finally {
      setSaving(false)
    }
  }

  const noStock = !stockIn && batchOptions.length === 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={stockIn ? 'Record Stock In' : 'Record Stock Out'}
      description={`${medicine.genericName} ${medicine.dosage} · on hand ${medicine.qtyOnHand} ${medicine.unit}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={stockIn ? 'primary' : 'danger'}
            onClick={() => void save()}
            loading={saving}
            disabled={!canSave || noStock}
          >
            {stockIn ? 'Record Stock In' : 'Confirm Stock Out'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {stockIn ? (
          <>
            <TextField
              label="Batch No."
              required
              value={batchNo}
              onChange={setBatchNo}
              placeholder="e.g. B-2091"
              hint="Reusing an existing batch number tops that lot up instead of opening a duplicate."
            />
            <TextField
              label="Expiration Date"
              type="date"
              required
              value={expiresAt}
              onChange={setExpiresAt}
              error={backdated ? 'That date is already in the past' : undefined}
            />
          </>
        ) : (
          <SelectField
            label="Batch"
            required
            value={batchId}
            onChange={setBatchId}
            options={batchOptions}
            placeholder={
              batches.loading
                ? 'Loading batches…'
                : noStock
                  ? 'No stock on hand'
                  : 'Select a batch'
            }
          />
        )}

        <NumberField
          label="Quantity"
          required
          min={1}
          value={quantity}
          onChange={setQuantity}
          suffix={medicine.unit}
          error={
            overQuantity
              ? `Only ${selectedBatch!.quantity} ${medicine.unit} left in that batch`
              : undefined
          }
        />

        <TextField
          label="Note"
          value={note}
          onChange={setNote}
          placeholder={
            stockIn ? 'e.g. Delivery — MedLine Distributors' : 'e.g. Dispensed to patient'
          }
        />

        {noStock && (
          <p className="text-xs text-gray-500">
            There is nothing on hand to dispense. Record stock in first.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
