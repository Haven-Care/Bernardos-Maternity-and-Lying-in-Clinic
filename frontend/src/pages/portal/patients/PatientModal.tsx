import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import {
  NumberField,
  SelectField,
  TextArea,
  TextField,
} from '../../../components/ui/fields'
import { useToast } from '../../../components/ui/toast-context'
import { formatTimestamp } from '../../../lib/format'
import type {
  BloodType,
  CivilStatus,
  Patient,
  PatientDocumentType,
  PatientInput,
  Sex,
  VisitType,
} from '../../../types/patient'

const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const DOCUMENT_TYPES: Array<{ id: PatientDocumentType; label: string }> = [
  { id: 'valid_id', label: 'Valid Government ID' },
  { id: 'lab_results', label: 'Lab Results' },
  { id: 'ultrasound_report', label: 'Ultrasound Report' },
  { id: 'marriage_certificate', label: 'Marriage Certificate' },
  { id: 'previous_hospital_records', label: 'Previous Hospital Records' },
]

const EMPTY: PatientInput = {
  fullName: '',
  dateOfBirth: '',
  sex: 'female',
  civilStatus: 'single',
  contactNumber: '',
  email: '',
  address: '',
  occupation: '',
  bloodType: null,
  emergencyContactName: '',
  emergencyContactNumber: '',
  emergencyContactRelation: '',
  lastMenstrualPeriod: null,
  expectedDeliveryDate: null,
  gravida: null,
  para: null,
  attendingPhysician: '',
  allergies: '',
  medicalConditions: '',
  visitType: null,
}

/**
 * New / edit patient record — Personal Information, Maternity & Medical Info,
 * and Required Documents, matching the prototype's three sections.
 *
 * Uploads are only offered on an existing record: a document has to attach to a
 * patient id, and holding files in memory until the record saves would lose
 * them on any validation failure.
 */
export function PatientModal({
  patientId,
  open,
  onClose,
  onSaved,
}: {
  patientId?: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const editing = patientId !== undefined

  const existing = useAsync(
    () => (patientId ? api.patients.getPatient(patientId) : Promise.resolve(undefined)),
    [patientId],
  )

  const [form, setForm] = useState<PatientInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  // Seed once the record arrives; a new record starts from EMPTY immediately.
  const values = form ?? (existing.data ? toInput(existing.data) : editing ? null : EMPTY)

  function set<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
    if (!values) return
    setForm({ ...values, [key]: value })
  }

  const canSave =
    values !== null &&
    values.fullName.trim() !== '' &&
    values.contactNumber.trim() !== ''

  async function save() {
    if (!values) return
    setSaving(true)
    setError(undefined)

    try {
      if (editing) {
        await api.patients.updatePatient(patientId, values)
        toast.success(
          'Patient Record Updated',
          'The patient record has been updated in your records.',
        )
      } else {
        await api.patients.createPatient(values)
        toast.success(
          'Patient Record Created',
          'The new patient has been added to your records.',
        )
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Patient Information' : 'New Patient Record'}
      description={
        editing && existing.data
          ? `${existing.data.patientCode} · added ${formatTimestamp(existing.data.createdAt)}`
          : 'Personal, maternity, and supporting documents.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!canSave}>
            {editing ? 'Save Changes' : 'Save Patient'}
          </Button>
        </>
      }
    >
      {values === null ? (
        <p className="py-10 text-center text-sm text-gray-400">Loading record…</p>
      ) : (
        <div className="flex flex-col gap-5">
          <Section title="Personal Information">
            <TextField
              label="Full Name"
              required
              value={values.fullName}
              onChange={(v) => set('fullName', v)}
            />
            <TextField
              label="Date of Birth"
              type="date"
              value={values.dateOfBirth}
              onChange={(v) => set('dateOfBirth', v)}
            />
            <SelectField
              label="Sex"
              value={values.sex}
              onChange={(v) => set('sex', v as Sex)}
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
            />
            <SelectField
              label="Civil Status"
              value={values.civilStatus}
              onChange={(v) => set('civilStatus', v as CivilStatus)}
              options={[
                { value: 'single', label: 'Single' },
                { value: 'married', label: 'Married' },
                { value: 'widowed', label: 'Widowed' },
                { value: 'separated', label: 'Separated' },
              ]}
            />
            <TextField
              label="Contact Number"
              required
              value={values.contactNumber}
              onChange={(v) => set('contactNumber', v)}
            />
            <TextField
              label="Email"
              type="email"
              value={values.email}
              onChange={(v) => set('email', v)}
            />
            <TextField
              label="Occupation"
              value={values.occupation}
              onChange={(v) => set('occupation', v)}
            />
            <SelectField
              label="Blood Type"
              value={values.bloodType ?? ''}
              onChange={(v) => set('bloodType', (v || null) as BloodType | null)}
              placeholder="Unknown"
              options={BLOOD_TYPES.map((b) => ({ value: b, label: b }))}
            />
            <div className="sm:col-span-2">
              <TextArea
                label="Address"
                rows={2}
                value={values.address}
                onChange={(v) => set('address', v)}
              />
            </div>
            <TextField
              label="Emergency Contact"
              value={values.emergencyContactName}
              onChange={(v) => set('emergencyContactName', v)}
            />
            <TextField
              label="Emergency Contact Number"
              value={values.emergencyContactNumber}
              onChange={(v) => set('emergencyContactNumber', v)}
            />
            <TextField
              label="Relationship"
              value={values.emergencyContactRelation}
              onChange={(v) => set('emergencyContactRelation', v)}
            />
          </Section>

          <Section title="Maternity & Medical Info">
            <TextField
              label="Last Menstrual Period"
              type="date"
              value={values.lastMenstrualPeriod ?? ''}
              onChange={(v) => set('lastMenstrualPeriod', v || null)}
            />
            <TextField
              label="Expected Delivery Date"
              type="date"
              value={values.expectedDeliveryDate ?? ''}
              onChange={(v) => set('expectedDeliveryDate', v || null)}
            />
            <NumberField
              label="Gravida"
              value={values.gravida ?? ''}
              onChange={(v) => set('gravida', v === '' ? null : v)}
              placeholder="Pregnancies"
            />
            <NumberField
              label="Para"
              value={values.para ?? ''}
              onChange={(v) => set('para', v === '' ? null : v)}
              placeholder="Births"
            />
            <TextField
              label="Attending Physician"
              value={values.attendingPhysician}
              onChange={(v) => set('attendingPhysician', v)}
            />
            <SelectField
              label="Visit Type"
              value={values.visitType ?? ''}
              onChange={(v) => set('visitType', (v || null) as VisitType | null)}
              placeholder="Not set"
              options={[
                { value: 'prenatal', label: 'Prenatal Care' },
                { value: 'delivery', label: 'Delivery' },
                { value: 'postnatal', label: 'Postnatal Care' },
              ]}
            />
            <div className="sm:col-span-2">
              <TextArea
                label="Allergies"
                rows={2}
                value={values.allergies}
                onChange={(v) => set('allergies', v)}
                placeholder="None reported"
              />
            </div>
            <div className="sm:col-span-2">
              <TextArea
                label="Medical Conditions"
                rows={2}
                value={values.medicalConditions}
                onChange={(v) => set('medicalConditions', v)}
                placeholder="None reported"
              />
            </div>
          </Section>

          <section>
            <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-brand-700 uppercase">
              Required Documents
            </h3>
            {editing ? (
              <Documents patientId={patientId} />
            ) : (
              <p className="text-xs text-gray-500">
                Save the record first — documents attach to a patient, so there
                is nothing to attach them to yet.
              </p>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm text-danger-700">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

function Documents({ patientId }: { patientId: string }) {
  const documents = useAsync(() => api.patients.listDocuments(patientId))
  const [uploading, setUploading] = useState<PatientDocumentType | null>(null)

  async function upload(docType: PatientDocumentType, file: File) {
    setUploading(docType)
    try {
      await api.patients.uploadDocument(patientId, docType, file)
      documents.reload()
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-md border border-border">
      {DOCUMENT_TYPES.map((type) => {
        const existing = documents.data?.find((d) => d.docType === type.id)

        return (
          <div
            key={type.id}
            className="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">{type.label}</p>
              <p className="truncate text-[11px] text-gray-400">
                {existing
                  ? `${existing.fileName} · ${formatSize(existing.fileSize)}`
                  : 'Not uploaded'}
              </p>
            </div>

            <label className="shrink-0 cursor-pointer rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50">
              {uploading === type.id
                ? 'Uploading…'
                : existing
                  ? 'Replace'
                  : 'Upload'}
              <input
                type="file"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void upload(type.id, file)
                  // Reset so re-picking the same file fires change again.
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        )
      })}
    </div>
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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Strip the server-owned fields — id, patient code, last visit, created at are
 * all derived or assigned, never edited on the form.
 */
function toInput(p: Patient): PatientInput {
  return {
    fullName: p.fullName,
    dateOfBirth: p.dateOfBirth,
    sex: p.sex,
    civilStatus: p.civilStatus,
    contactNumber: p.contactNumber,
    email: p.email,
    address: p.address,
    occupation: p.occupation,
    bloodType: p.bloodType,
    emergencyContactName: p.emergencyContactName,
    emergencyContactNumber: p.emergencyContactNumber,
    emergencyContactRelation: p.emergencyContactRelation,
    lastMenstrualPeriod: p.lastMenstrualPeriod,
    expectedDeliveryDate: p.expectedDeliveryDate,
    gravida: p.gravida,
    para: p.para,
    attendingPhysician: p.attendingPhysician,
    allergies: p.allergies,
    medicalConditions: p.medicalConditions,
    visitType: p.visitType,
  }
}
