import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Button } from '../../../components/ui/Button'
import { Card, CardHeader } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { TextField } from '../../../components/ui/fields'
import { AsyncBoundary } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { formatTime } from '../../../lib/format'
import type { ClinicInfo as ClinicInfoType } from '../../../types/clinic'

export function ClinicInfo() {
  const info = useAsync(() => api.clinic.getClinicInfo())
  const hours = useAsync(() => api.clinic.getOperatingHours())
  const toast = useToast()

  const [editing, setEditing] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="General Information"
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit Details
            </Button>
          }
        />
        <AsyncBoundary state={info}>
          {(c) => (
            <dl className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
              <Field label="Clinic Name" value={c.name} />
              <Field label="License No." value={c.licenseNo} />
              <Field label="Address" value={c.address} />
              <Field label="Landline" value={c.landline} />
              <Field label="Mobile" value={c.mobile} />
              <Field label="Email" value={c.email} />
              <Field label="Website" value={c.website} />
            </dl>
          )}
        </AsyncBoundary>
      </Card>

      <Card>
        <CardHeader title="Operating Hours" />
        <AsyncBoundary state={hours}>
          {(rows) => (
            <div className="flex flex-col divide-y divide-border">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <p className="text-sm text-gray-700">{row.label}</p>
                  <p
                    className={`text-sm font-medium ${row.closed ? 'text-danger-700' : 'text-gray-900'}`}
                  >
                    {row.closed || !row.opensAt || !row.closesAt
                      ? 'Closed'
                      : `${formatTime(row.opensAt)} – ${formatTime(row.closesAt)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </Card>

      {editing && info.data && (
        <EditClinicModal
          initial={info.data}
          open={editing}
          onClose={() => setEditing(false)}
          onSaved={() => {
            info.reload()
            toast.success(
              'Record Updated',
              'The clinic details have been saved.',
            )
          }}
        />
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium break-words text-gray-900">
        {value || '—'}
      </dd>
    </div>
  )
}

function EditClinicModal({
  initial,
  open,
  onClose,
  onSaved,
}: {
  initial: ClinicInfoType
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof ClinicInfoType>(key: K, value: ClinicInfoType[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      await api.clinic.updateClinicInfo(form)
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Clinic Info"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={form.name.trim() === ''}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Clinic Name"
          required
          value={form.name}
          onChange={(v) => set('name', v)}
        />
        <TextField
          label="License No."
          value={form.licenseNo}
          onChange={(v) => set('licenseNo', v)}
        />
        <div className="sm:col-span-2">
          <TextField
            label="Address"
            value={form.address}
            onChange={(v) => set('address', v)}
          />
        </div>
        <TextField
          label="Landline"
          value={form.landline}
          onChange={(v) => set('landline', v)}
        />
        <TextField
          label="Mobile"
          value={form.mobile}
          onChange={(v) => set('mobile', v)}
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => set('email', v)}
        />
        <TextField
          label="Website"
          value={form.website}
          onChange={(v) => set('website', v)}
        />
      </div>
    </Modal>
  )
}
