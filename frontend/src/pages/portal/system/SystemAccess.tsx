import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { SelectField, TextField } from '../../../components/ui/fields'
import { Table, type Column } from '../../../components/ui/Table'
import { AsyncBoundary, EmptyState } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { formatDate } from '../../../lib/format'
import type { CreateStaffInput, StaffProfile } from '../../../types/account'

/**
 * Staff provisioning — `/admin/system`.
 *
 * Unlisted: absent from the sidebar, reachable only by typing the URL. The
 * Figma has no screen for this because provisioning was never designed, but
 * accounts have to come from somewhere and the clinic will not run a command
 * line.
 *
 * Unlisted is not a permission. Every endpoint behind this is
 * administrator-only in Express, and a staff member who types the URL is
 * redirected by the route guard before it renders.
 */
export function SystemAccess() {
  const staff = useAsync(() => api.system.listStaff())
  const me = useAsync(() => api.account.getProfile())
  const toast = useToast()

  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function toggleStatus(member: StaffProfile) {
    const next = member.status === 'active' ? 'inactive' : 'active'
    setBusy(member.id)

    try {
      await api.system.setStaffStatus(member.id, next)
      staff.reload()
      toast.success(
        next === 'active' ? 'Account Reactivated' : 'Account Deactivated',
        next === 'active'
          ? `${member.fullName} can sign in again.`
          : `${member.fullName} can no longer sign in.`,
      )
    } catch (err) {
      toast.error(
        'Could not update the account',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<StaffProfile>[] = [
    {
      key: 'employeeId',
      header: 'Employee ID',
      render: (s) => <span className="tabular-nums">{s.employeeId}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.fullName}</p>
          <p className="text-xs text-gray-500">{s.email}</p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (s) => (
        <Badge tone={s.role === 'administrator' ? 'info' : 'neutral'}>
          {s.role === 'administrator' ? 'Administrator' : 'Staff'}
        </Badge>
      ),
    },
    {
      key: 'hiredAt',
      header: 'Added',
      render: (s) => formatDate(s.hiredAt),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Badge tone={s.status === 'active' ? 'success' : 'danger'}>
          {s.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (s) =>
        // An administrator locking themselves out may be unrecoverable if
        // they are the only one, so the control is not offered at all rather
        // than offered and then refused.
        s.id === me.data?.id ? (
          <span className="text-xs text-gray-400">This is you</span>
        ) : (
          <button
            type="button"
            disabled={busy === s.id}
            onClick={() => void toggleStatus(s)}
            className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          >
            {s.status === 'active' ? 'Deactivate' : 'Reactivate'}
          </button>
        ),
    },
  ]

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">System Access</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Staff accounts for the HavenCare portal. There is no self sign-up —
          accounts are created here.
        </p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-xs text-gray-500">
            Deactivating an account blocks sign-in immediately. Records of what
            that person entered are kept.
          </p>
          <Button size="sm" onClick={() => setAdding(true)}>
            + Add Staff Account
          </Button>
        </div>

        <AsyncBoundary
          state={staff}
          empty={<EmptyState title="No staff accounts yet" />}
        >
          {(rows) => (
            <Table columns={columns} rows={rows} rowKey={(s) => s.id} />
          )}
        </AsyncBoundary>
      </Card>

      {adding && (
        <AddStaffModal
          open={adding}
          onClose={() => setAdding(false)}
          onSaved={() => {
            staff.reload()
            toast.success(
              'Account Created',
              'They can sign in with the password you set.',
            )
          }}
        />
      )}
    </div>
  )
}

const EMPTY: CreateStaffInput = {
  email: '',
  password: '',
  fullName: '',
  contactNumber: '',
  role: 'staff',
}

function AddStaffModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CreateStaffInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  function set<K extends keyof CreateStaffInput>(
    key: K,
    value: CreateStaffInput[K],
  ) {
    setForm({ ...form, [key]: value })
  }

  const canSave =
    form.email.includes('@') &&
    form.password.length >= 8 &&
    form.fullName.trim() !== ''

  async function save() {
    setSaving(true)
    setError(undefined)

    try {
      await api.system.createStaff(form)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Add Staff Account"
      footer={
        <Button
          onClick={() => void save()}
          loading={saving}
          disabled={!canSave}
        >
          Create Account
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <TextField
          label="Full Name"
          required
          value={form.fullName}
          onChange={(v) => set('fullName', v)}
          placeholder="e.g. Hannah Puerta"
        />
        <TextField
          label="Email"
          type="email"
          required
          value={form.email}
          onChange={(v) => set('email', v)}
          placeholder="e.g. hannahp@havencare.ph"
        />
        <TextField
          label="Contact Number"
          value={form.contactNumber}
          onChange={(v) => set('contactNumber', v)}
          placeholder="e.g. 0917 456 7890"
        />
        <SelectField
          label="Role"
          value={form.role}
          onChange={(v) => set('role', v as CreateStaffInput['role'])}
          options={[
            { value: 'staff', label: 'Staff' },
            { value: 'administrator', label: 'Administrator' },
          ]}
        />
        <TextField
          label="Temporary Password"
          type="password"
          required
          value={form.password}
          onChange={(v) => set('password', v)}
          placeholder="At least 8 characters"
        />

        {/* Said plainly because it is true: there is no "force change on first
            login" here, and pretending otherwise would be worse than the note. */}
        <p className="text-xs text-gray-500">
          Give this password to them directly and ask them to change it from My
          Account once they have signed in.
        </p>
      </div>
    </Modal>
  )
}
