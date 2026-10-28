import { useRef, useState } from 'react'
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
import { formatServicePrice } from '../../../lib/services'
import type { Service, ServiceInput } from '../../../types/service'
import { clinicServices, clinicServiceGroups } from '../../../lib/clinicServices'

export function ServicesPricing() {
  const services = useAsync(() => api.services.listServices())
  const toast = useToast()

  const [editing, setEditing] = useState<Service | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<ServiceInput | null>(null)

  const pendingIds = useRef(new Set<string>())
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  async function toggleActive(service: Service, next: boolean) {
    if (pendingIds.current.has(service.id)) return
    pendingIds.current.add(service.id)
    setPending(new Set(pendingIds.current))
    const update = (value: boolean) => services.updateData((rows) => rows?.map((row) =>
      row.id === service.id ? { ...row, active: value } : row,
    ))
    update(next)
    try {
      await api.services.setServiceActive(service.id, next)
    } catch (error) {
      update(service.active)
      toast.error('Change not saved', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      pendingIds.current.delete(service.id)
      setPending(new Set(pendingIds.current))
    }
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
        <span className="tabular-nums font-medium">{formatServicePrice(s.price)}</span>
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
            disabled={pending.has(s.id)}
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
            disabled={pending.has(s.id)}
            onClick={() => setEditing(s)}
            className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          >
            Edit
          </button>
        </div>
      ),
    },
  ]

  const active = services.data?.filter((s) => s.active).length ?? 0

  return (
    <div className="portal-settings-body services-settings flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <StatTile label="Total Services" value={services.data?.length ?? '—'} />
        <StatTile label="Active" value={services.data ? active : '—'} />
      </div>

      <Card className="portal-table-card">
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
            <Table fillHeight columns={columns} rows={rows} rowKey={(s) => s.id} />
          )}
        </AsyncBoundary>
      </Card>

      {services.data && <Card className="p-4">
        <h2 className="text-sm font-semibold text-gray-900">Clinic’s service and price list</h2>
        <p className="mt-1 text-xs text-gray-500">
          {clinicServices.length} services are listed by the clinic. Hearing Test is currently unavailable; contact the clinic for Norifam pricing.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clinicServiceGroups.map((group) => (
            <div key={group.category}>
              <h3 className="text-xs font-semibold text-brand-700">{group.category}</h3>
              <ul className="mt-2 space-y-2">
                {group.services.map(({ name, price, available }) => {
                  const configured = services.data?.find((service) => service.name.toLowerCase() === name.toLowerCase())
                  return (
                    <li key={name} className="flex items-center justify-between gap-2 text-xs text-gray-700">
                      <span>{name}<span className="mt-0.5 block text-gray-500">{formatServicePrice(price)}{!available && ' · Currently unavailable'}</span></span>
                      {configured ? (
                        <span className="shrink-0 text-gray-400">{configured.active ? 'Bookable' : 'Configured'}</span>
                      ) : !available ? (
                        <span className="shrink-0 text-gray-400">Unavailable</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setDraft({ name, category: group.category, price }); setAdding(true) }}
                          className="shrink-0 font-semibold text-brand-600 hover:underline"
                        >
                          Set up
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>}

      {(adding || editing) && (
        <ServiceModal
          service={editing ?? undefined}
          initial={draft ?? undefined}
          open={adding || editing !== null}
          onClose={() => {
            setAdding(false)
            setEditing(null)
            setDraft(null)
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
  initial,
  open,
  onClose,
  onSaved,
}: {
  service?: Service
  initial?: ServiceInput
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ServiceInput>({
    name: service?.name ?? initial?.name ?? '',
    category: service?.category ?? initial?.category ?? '',
    price: service ? service.price : initial?.price ?? null,
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const dirty = !service || JSON.stringify(form) !== JSON.stringify({ name: service?.name ?? initial?.name ?? '', category: service?.category ?? initial?.category ?? '', price: service ? service.price : initial?.price ?? null })

  async function save() {
    setSaving(true)
    try {
      if (service) await api.services.updateService(service.id, form)
      else await api.services.createService(form)
      onSaved()
      onClose()
    } catch (error) {
      toast.error('Could not save', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      dirty={dirty}
      busy={saving}
      onClose={onClose}
      size="sm"
      title={service ? 'Edit Service and Pricing' : 'Add Service and Pricing'}
      footer={
        <Button
          onClick={() => void save()}
          loading={saving}
          disabled={!dirty || form.name.trim() === '' || (form.price !== null && (!Number.isFinite(form.price) || form.price < 0))}
        >
          Save
        </Button>
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
          min={0}
          value={form.price ?? ''}
          onChange={(v) => setForm({ ...form, price: v === '' ? null : v })}
          suffix="₱"
          placeholder="e.g. 300"
        />
        <p className="text-xs text-gray-500">Leave the price blank when it has not been provided. Patients will see “Contact clinic for price”.</p>
      </div>
    </Modal>
  )
}
