import { useState } from 'react'
import * as api from '../../../api'
import { useAsync } from '../../../hooks/useAsync'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card, CardHeader } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import { Toggle } from '../../../components/ui/Toggle'
import { TextField } from '../../../components/ui/fields'
import { AsyncBoundary } from '../../../components/ui/states'
import { useToast } from '../../../components/ui/toast-context'
import { formatDate, formatTimestamp, initials } from '../../../lib/format'
import type { NotificationPrefs } from '../../../types/account'

export function MyAccount() {
  const profile = useAsync(() => api.account.getProfile())
  const prefs = useAsync(() => api.account.getNotificationPrefs())
  const toast = useToast()

  const [editingProfile, setEditingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  async function setPref(key: keyof NotificationPrefs, value: boolean) {
    await api.account.updateNotificationPrefs({ [key]: value })
    prefs.reload()
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Profile Details"
          action={
            <Button size="sm" variant="secondary" onClick={() => setEditingProfile(true)}>
              Edit Profile
            </Button>
          }
        />
        <AsyncBoundary state={profile}>
          {(p) => (
            <div className="flex flex-col gap-5 p-5 sm:flex-row">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
                {initials(p.fullName)}
              </span>

              <dl className="grid flex-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                <Field label="Name" value={p.fullName} />
                <Field label="Role" value={<span className="capitalize">{p.role}</span>} />
                <Field label="Employee ID" value={p.employeeId} />
                <Field
                  label="Status"
                  value={
                    <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>
                      {p.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  }
                />
                <Field label="Contact Number" value={p.contactNumber} />
                <Field label="Date Hired" value={formatDate(p.hiredAt)} />
                <Field label="Email" value={p.email} />
                <Field label="Last Login" value={formatTimestamp(p.lastLoginAt)} />
              </dl>
            </div>
          )}
        </AsyncBoundary>
      </Card>

      <Card>
        <CardHeader
          title="Security"
          action={
            <Button size="sm" variant="secondary" onClick={() => setChangingPassword(true)}>
              Change Password
            </Button>
          }
        />
        <AsyncBoundary state={profile}>
          {(p) => (
            <div className="flex flex-col divide-y divide-border">
              <Row
                title="Password"
                detail={`Last changed ${formatTimestamp(p.passwordChangedAt)}`}
              />
              <Row
                title="Two-Factor Authentication"
                detail="Adds an extra layer of protection to your account."
                control={
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">Coming soon</Badge>
                    <Toggle
                      checked={false}
                      onChange={() => {}}
                      disabled
                      label="Two-factor authentication"
                      // Shipped visibly off rather than faked: enrolment and
                      // challenge flows are real work and aren't built.
                      title="Not available yet — enrolment isn't implemented"
                    />
                  </div>
                }
              />
            </div>
          )}
        </AsyncBoundary>
      </Card>

      <Card>
        <CardHeader title="Notification Preferences" />
        <AsyncBoundary state={prefs}>
          {(p) => (
            <div className="flex flex-col divide-y divide-border">
              <Row
                title="Email Notifications"
                detail="Booking requests, reminders, and system alerts."
                control={
                  <Toggle
                    checked={p.emailNotifications}
                    onChange={(v) => void setPref('emailNotifications', v)}
                    label="Email notifications"
                  />
                }
              />
              <Row
                title="SMS Reminders"
                detail="Sent to patients before each appointment."
                control={
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">Unavailable</Badge>
                    <Toggle
                      checked={false}
                      onChange={() => {}}
                      disabled
                      label="SMS reminders"
                      // Philippine SMS gateways bill per message and there is no
                      // budget. Proposal Limitation 2 covers provider dependence.
                      title="No SMS provider is configured for this deployment"
                    />
                  </div>
                }
              />
              <Row
                title="New Booking Alerts"
                detail="Notify me when a patient submits a request."
                control={
                  <Toggle
                    checked={p.newBookingAlerts}
                    onChange={(v) => void setPref('newBookingAlerts', v)}
                    label="New booking alerts"
                  />
                }
              />
            </div>
          )}
        </AsyncBoundary>
      </Card>

      {editingProfile && profile.data && (
        <EditProfileModal
          initial={{
            fullName: profile.data.fullName,
            email: profile.data.email,
            contactNumber: profile.data.contactNumber,
          }}
          open={editingProfile}
          onClose={() => setEditingProfile(false)}
          onSaved={() => {
            profile.reload()
            toast.success('Record Updated', 'Your profile has been updated.')
          }}
        />
      )}

      {changingPassword && (
        <ChangePasswordModal
          open={changingPassword}
          onClose={() => setChangingPassword(false)}
          onSaved={() =>
            toast.success('Record Updated', 'Your password has been changed.')
          }
        />
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  )
}

function Row({
  title,
  detail,
  control,
}: {
  title: string
  detail: string
  control?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{detail}</p>
      </div>
      {control}
    </div>
  )
}

function EditProfileModal({
  initial,
  open,
  onClose,
  onSaved,
}: {
  initial: { fullName: string; email: string; contactNumber: string }
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await api.account.updateProfile(form)
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
      title="Edit Profile"
      description="Update your personal and contact information."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save Changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Full Name"
          value={form.fullName}
          onChange={(v) => setForm({ ...form, fullName: v })}
        />
        <TextField
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <TextField
          label="Contact"
          value={form.contactNumber}
          onChange={(v) => setForm({ ...form, contactNumber: v })}
        />
      </div>
    </Modal>
  )
}

function ChangePasswordModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const matches = next.length > 0 && next === confirm

  async function save() {
    setSaving(true)
    setError(undefined)
    try {
      await api.account.changePassword({
        currentPassword: current,
        newPassword: next,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Change Password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={current === '' || !matches}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Current Password"
          type="password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <TextField
          label="New Password"
          type="password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          hint="At least 8 characters."
        />
        <TextField
          label="Confirm New Password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={confirm !== '' && !matches ? 'Passwords don’t match' : undefined}
        />
        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
