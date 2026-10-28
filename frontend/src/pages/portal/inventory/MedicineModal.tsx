import { useEffect, useRef, useState } from 'react'
import * as api from '../../../api'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import {
  NumberField,
  SelectField,
  TextField,
} from '../../../components/ui/fields'
import { useToast } from '../../../components/ui/toast-context'
import { useAsync } from '../../../hooks/useAsync'
import { medicinePhotoError } from '../../../lib/medicinePhoto'
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
  targetStockLevel: null,
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
  const [savedMedicine, setSavedMedicine] = useState(medicine)
  const [baseline, setBaseline] = useState<MedicineInput>(() => medicine ? toInput(medicine) : EMPTY)
  const [photo, setPhoto] = useState<File>()
  const [preview, setPreview] = useState<string>()
  const inFlight = useRef(false)
  const currentPhoto = useAsync(() => savedMedicine ? api.inventory.getMedicinePhoto(savedMedicine.id) : Promise.resolve({ url: null }), [savedMedicine?.id])

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function set<K extends keyof MedicineInput>(key: K, value: MedicineInput[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const formDirty = JSON.stringify(form) !== JSON.stringify(baseline)
  const dirty = formDirty || photo !== undefined

  const canSave =
    form.genericName.trim() !== '' &&
    form.dosage.trim() !== '' &&
    Number.isInteger(form.reorderLevel) && form.reorderLevel >= 0 &&
    (form.targetStockLevel == null || (Number.isInteger(form.targetStockLevel) && form.targetStockLevel >= form.reorderLevel))

  async function save() {
    if (inFlight.current || !dirty || !canSave) return
    inFlight.current = true
    setSaving(true)
    setError(undefined)
    let detailsSaved = !formDirty && Boolean(savedMedicine)

    try {
      let record = savedMedicine
      if (!record || formDirty) {
        record = record ? await api.inventory.updateMedicine(record.id, form) : await api.inventory.createMedicine(form)
        setSavedMedicine(record)
        setBaseline({ ...form })
        detailsSaved = true
        onSaved()
      }
      // Keep the created id on failure so Retry never creates a second medicine.
      if (photo) await api.inventory.uploadMedicinePhoto(record.id, photo)
      toast.success(editing ? 'Record Updated' : 'Medicine Added', photo ? 'The medicine details and photo have been saved.' : 'The medicine details have been saved.')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save'
      setError(detailsSaved && photo ? `Medicine details are saved. ${message} Retry or undo the photo selection.` : message)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      dirty={dirty}
      busy={saving}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit Medicine' : 'Add New Medicine'}
      description={
        editing
          ? `${medicine.genericName} · on hand ${medicine.qtyOnHand} ${medicine.unit}`
          : 'Add stock and expiry separately through Receive Stock.'
      }
      footer={
        <Button onClick={() => void save()} loading={saving} disabled={!dirty || !canSave}>
          {editing ? 'Save Changes' : 'Add Medicine'}
        </Button>
      }
    >
      <fieldset disabled={saving} className="flex min-w-0 flex-col gap-5">
        <Section title="Basic Medicine Details">
          <figure className="sm:col-span-2">
            <img
              src={photo ? preview : currentPhoto.data?.url ?? '/images/medicine-placeholder.png'}
              alt={photo || currentPhoto.data?.url ? `${form.genericName || 'Medicine'} photo` : 'Medicine photo placeholder'}
              className="h-40 w-full rounded-lg border border-border object-contain object-center bg-white"
            />
            <figcaption className="mt-1.5 text-xs text-gray-500">
              JPG, PNG, or WebP · up to 5 MB
            </figcaption>
            <label className="mt-2 block text-sm font-medium text-gray-700">
              Product photo
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:px-3 file:py-2"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const invalid = medicinePhotoError(file)
                  setError(invalid)
                  if (!invalid) { setPhoto(file); setPreview(URL.createObjectURL(file)) }
                  event.target.value = ''
                }} />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <a className="font-medium text-brand-700 underline" target="_blank" rel="noopener noreferrer"
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent([form.brandName, form.genericName, form.dosage, form.dosageForm, 'medicine packaging'].filter(Boolean).join(' '))}`}>
                Search product photo ↗
              </a>
              <label className="cursor-pointer font-medium text-brand-700 underline">
                Take photo
                <input className="sr-only" type="file" accept="image/*" capture="environment" disabled={saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    const invalid = medicinePhotoError(file)
                    setError(invalid)
                    if (!invalid) { setPhoto(file); setPreview(URL.createObjectURL(file)) }
                    event.target.value = ''
                  }} />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">Search opens in a new tab. Verify the brand, strength, and packaging, then upload a photo you have permission to use. No API key or subscription is needed.</p>
            {photo && <button type="button" disabled={saving} className="mt-2 text-xs text-brand-700 underline" onClick={() => setPhoto(undefined)}>Undo photo selection</button>}
            {currentPhoto.error && <p role="alert" className="mt-2 text-xs text-danger-700">Could not load the saved photo. <button type="button" className="underline" onClick={currentPhoto.reload}>Retry</button></p>}
          </figure>
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
            disabled={medicine?.hasBatchHistory}
            onChange={(v) => set('unit', v)}
            options={UNITS.map((u) => ({ value: u, label: u }))}
          />
        </Section>

        <Section title="Inventory & Stock Tracking">
          <NumberField
            label="Reorder Level (alert threshold)"
            required
            min={0}
            value={form.reorderLevel}
            onChange={(v) => set('reorderLevel', v === '' ? 0 : v)}
            suffix={form.unit}
            placeholder="e.g. 100"
          />
          <NumberField label="Target Stock (optional)" min={form.reorderLevel}
            value={form.targetStockLevel ?? ''} suffix={form.unit}
            onChange={(value) => set('targetStockLevel', value === '' ? null : value)}
            error={form.targetStockLevel != null && form.targetStockLevel < form.reorderLevel ? 'Target must be at least the reorder level.' : undefined} />
          <p className="text-xs text-gray-500 sm:col-span-2">Low stock starts when available stock is at or below the reorder level. Target stock is the desired balance after replenishment; neither value limits how much you can receive.</p>
          {medicine?.hasBatchHistory && <p className="text-xs text-gray-500 sm:col-span-2">The unit is locked because batch history exists. Create a separate medicine entry to track a different unit.</p>}
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
      </fieldset>
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
      <h3 className="mb-2.5 text-sm font-semibold text-brand-700">
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
    targetStockLevel: m.targetStockLevel ?? null,
    unitCost: m.unitCost,
    sellingPrice: m.sellingPrice,
    supplierName: m.supplierName,
    supplierContact: m.supplierContact,
    storageLocation: m.storageLocation,
  }
}
