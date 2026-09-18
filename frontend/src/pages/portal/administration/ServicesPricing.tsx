import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { StatTile } from '../../../components/ui/StatTile'
import { Toggle } from '../../../components/ui/Toggle'
import { NumberField, TextField } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { formatPeso } from '../../../lib/format'
import type { Service, ServiceInput } from '../../../types/service'

export function ServicesPricing() {
  const services = useAsync(() => api.services.listServices())
  const toast = useToast()

  const [editing, setEditing] = useState<Service | null>(null)
  const [adding, setAdding] = useState(false)

  async function toggleActive(service: Service, active: boolean) {
    await api.services.setServiceActive(service.id, active)
    services.reload()
  }

  const columns: Column<Service>[] = [
    {
      key: 'name',
      header: 'Service',
      render: (s) => (
        <span className="font-medium text-gray-900">{s.name}</span>
      ),
    },
    { key: 'category', header: 'Category', render: (s) => s.category || '—' },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      render: (s) => (
        <span className="tabular-nums font-medium">{formatPeso(s.price)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Badge tone={s.active ? 'success' : 'neutral'}>
          {s.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-3">
          <Toggle
            checked={s.active}
            onChange={(v) => void toggleActive(s, v)}
            label={`${s.name} active`}
            title={
              s.active
                ? 'Hide this service from the public booking form'
                : 'Offer this service on the public booking form'
            }
          />
          <button
            type="button"
            onClick={() => setEditing(s)}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Edit
          </button>
        </div>
      ),
    },
  ]

  const active = services.data?.filter((s) => s.active).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <StatTile label="Total Services" value={services.data?.length ?? '—'} />
        <StatTile label="Active" value={services.data ? active : '—'} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-xs text-gray-500">
            Inactive services are hidden from the public booking form. Existing
            bookings are not affected.
          </p>
          <Button size="sm" onClick={() => setAdding(true)}>
            + Add Service
          </Button>
        </div>

        <AsyncBoundary
          state={services}
          empty={<EmptyState title="No services yet" />}
        >
          {(rows) => (
            <Table columns={columns} rows={rows} rowKey={(s) => s.id} />
          )}
        </AsyncBoundary>
      </Card>

      {(adding || editing) && (
        <ServiceModal
          service={editing ?? undefined}
          open={adding || editing !== null}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
          onSaved={() => {
            services.reload()
            toast.success(
              'Record Updated',
              'The service has been saved to your records.',
            )
          }}
        />
      )}
    </div>
  )
}

function ServiceModal({
  service,
  open,
  onClose,
  onSaved,
}: {
  service?: Service
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ServiceInput>({
    name: service?.name ?? '',
    category: service?.category ?? '',
    price: service?.price ?? 0,
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      if (service) await api.services.updateService(service.id, form)
      else await api.services.createService(form)
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
      size="sm"
      title={service ? 'Edit Service and Pricing' : 'Add Service and Pricing'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={form.name.trim() === '' || form.price <= 0}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Service Name"
          required
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="e.g. Pre-natal Check-up"
        />
        <TextField
          label="Category"
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          placeholder="e.g. Consultation"
        />
        <NumberField
          label="Price"
          required
          min={1}
          value={form.price === 0 ? '' : form.price}
          onChange={(v) => setForm({ ...form, price: v === '' ? 0 : v })}
          suffix="₱"
          placeholder="e.g. 300"
        />
      </div>
    </Modal>
  )
}
