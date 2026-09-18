import { useState } from 'react'
import * as api from '../../../api'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import {
  NumberField,
  SelectField,
  TextField,
} from '../../../components/ui/fields'
import { useToast } from '../../../components/ui/toast-context'
import type {
  DosageForm,
  MedicineInput,
  MedicineListRow,
} from '../../../types/medicine'

const DOSAGE_FORMS: DosageForm[] = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Injection',
  'Ointment',
]

const UNITS = ['pcs', 'Boxes', 'Bottles', 'Vials']

const CATEGORIES = [
  'Analgesic',
  'Antibiotic',
  'Supplement',
  'Antiseptic',
  'Obstetric',
]

const EMPTY: MedicineInput = {
  genericName: '',
  brandName: '',
  category: '',
  dosageForm: 'Tablet',
  dosage: '',
  unit: 'pcs',
  reorderLevel: 0,
  unitCost: 0,
  sellingPrice: 0,
  supplierName: '',
  supplierContact: '',
  storageLocation: '',
}

/**
 * Add / edit a medicine. Four sections, matching the prototype's detail modal.
 *
 * Quantity and expiry are deliberately absent: those belong to batches, which
 * are created by Record Stock In. A medicine is a catalogue entry, not a pile
 * of stock — editing it must never silently change what's on the shelf.
 */
export function MedicineModal({
  medicine,
  open,
  onClose,
  onSaved,
}: {
  medicine?: MedicineListRow
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const editing = medicine !== undefined

  const [form, setForm] = useState<MedicineInput>(() =>
    medicine ? toInput(medicine) : EMPTY,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  function set<K extends keyof MedicineInput>(key: K, value: MedicineInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const canSave =
    form.genericName.trim() !== '' &&
    form.dosage.trim() !== '' &&
    form.reorderLevel > 0

  async function save() {
    setSaving(true)
    setError(undefined)

    try {
      if (editing) {
        await api.inventory.updateMedicine(medicine.id, form)
        toast.success(
          'Record Updated',
          'The changes have been saved to your inventory records.',
        )
      } else {
        await api.inventory.createMedicine(form)
        toast.success(
          'Medicine Added',
          'The new medicine has been successfully added to your inventory.',
        )
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit Medicine' : 'Add New Medicine'}
      description={
        editing
          ? `${medicine.genericName} · on hand ${medicine.qtyOnHand} ${medicine.unit}`
          : 'Stock and expiry are added separately, through Record Stock In.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!canSave}>
            {editing ? 'Save Changes' : 'Add Medicine'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Section title="Basic Medicine Details">
          <TextField
            label="Generic Name"
            required
            value={form.genericName}
            onChange={(v) => set('genericName', v)}
            placeholder="e.g. Paracetamol"
          />
          <TextField
            label="Brand Name"
            value={form.brandName}
            onChange={(v) => set('brandName', v)}
            placeholder="e.g. Biogesic"
          />
          <SelectField
            label="Category"
            value={form.category}
            onChange={(v) => set('category', v)}
            placeholder="Select a category"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <SelectField
            label="Dosage Form"
            value={form.dosageForm}
            onChange={(v) => set('dosageForm', v as DosageForm)}
            options={DOSAGE_FORMS.map((d) => ({ value: d, label: d }))}
          />
          <TextField
            label="Dosage"
            required
            value={form.dosage}
            onChange={(v) => set('dosage', v)}
            placeholder="e.g. 500mg"
          />
          <SelectField
            label="Unit"
            value={form.unit}
            onChange={(v) => set('unit', v)}
            options={UNITS.map((u) => ({ value: u, label: u }))}
          />
        </Section>

        <Section title="Inventory & Stock Tracking">
          <NumberField
            label="Reorder Level"
            required
            min={1}
            value={form.reorderLevel === 0 ? '' : form.reorderLevel}
            onChange={(v) => set('reorderLevel', v === '' ? 0 : v)}
            suffix={form.unit}
            placeholder="e.g. 100"
          />
          {editing && (
            <div className="self-end pb-2 text-xs text-gray-500">
              On hand: {medicine.qtyOnHand} {medicine.unit} — changed only by
              stock movements.
            </div>
          )}
        </Section>

        <Section title="Pricing & Financials">
          <NumberField
            label="Unit Cost"
            value={form.unitCost === 0 ? '' : form.unitCost}
            onChange={(v) => set('unitCost', v === '' ? 0 : v)}
            suffix="₱"
            placeholder="e.g. 1.50"
          />
          <NumberField
            label="Selling Price"
            value={form.sellingPrice === 0 ? '' : form.sellingPrice}
            onChange={(v) => set('sellingPrice', v === '' ? 0 : v)}
            suffix="₱"
            placeholder="e.g. 3.00"
          />
        </Section>

        <Section title="Storage & Supplier Info">
          <TextField
            label="Supplier Name"
            value={form.supplierName}
            onChange={(v) => set('supplierName', v)}
            placeholder="e.g. MedLine Distributors"
          />
          <TextField
            label="Supplier Contact"
            value={form.supplierContact}
            onChange={(v) => set('supplierContact', v)}
            placeholder="e.g. (02) 8123 4567"
          />
          <TextField
            label="Storage Location"
            value={form.storageLocation}
            onChange={(v) => set('storageLocation', v)}
            placeholder="e.g. Cabinet A · Shelf 1"
          />
        </Section>

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-brand-700 uppercase">
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function toInput(m: MedicineListRow): MedicineInput {
  return {
    genericName: m.genericName,
    brandName: m.brandName,
    category: m.category,
    dosageForm: m.dosageForm,
    dosage: m.dosage,
    unit: m.unit,
    reorderLevel: m.reorderLevel,
    unitCost: m.unitCost,
    sellingPrice: m.sellingPrice,
    supplierName: m.supplierName,
    supplierContact: m.supplierContact,
    storageLocation: m.storageLocation,
  }
}
