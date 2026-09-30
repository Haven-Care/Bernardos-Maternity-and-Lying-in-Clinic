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
import { formatTimestamp } from '../../../lib/format'
import type { NotificationPrefs } from '../../../types/account'

export function MyAccount() {
  const profile = useAsync(() => api.account.getProfile())
  const prefs = useAsync(() => api.account.getNotificationPrefs())
  const toast = useToast()

  const [changingPassword, setChangingPassword] = useState(false)

  async function setPref(key: keyof NotificationPrefs, value: boolean) {
    await api.account.updateNotificationPrefs({ [key]: value })
    prefs.reload()
  }

  return (
    <div className="flex flex-col gap-4">
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
                detail="New bookings, reminders, and system alerts."
                control={
                  <Toggle
                    checked={p.emailNotifications}
                    onChange={(v) => void setPref('emailNotifications', v)}
                    label="Email notifications"
                  />
                }
              />
              <Row
                title="New Booking Alerts"
                detail="Notify me when a patient books an appointment."
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
        <Button
          onClick={() => void save()}
          loading={saving}
          disabled={current === '' || !matches}
        >
          Save
        </Button>
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
