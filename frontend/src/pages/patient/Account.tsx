import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../../api'
import type { PatientAccount } from '../../types/patientAccount'
import { useConfirmLeave, useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { AsyncBoundary } from '../../components/ui/states'
import { Toggle } from '../../components/ui/Toggle'
import { useToast } from '../../components/ui/toast-context'
import { ChangePasswordFields } from '../../components/ChangePasswordFields'
import { EMPTY_PASSWORD_CHANGE, isPasswordChangeReady, type PasswordChange } from '../../lib/password'
import { isPhMobile } from '../../lib/validate'
import { PublicShell } from '../public/PublicShell'

export function Account() {
  const account = useAsync(() => api.patientAuth.getAccount())

  return (
    <PublicShell>
      <h1 className="text-xl font-semibold text-gray-900">Your profile</h1>
      <p className="mt-1 text-sm text-gray-500">Manage your contact details and account settings.</p>
      <div className="mt-5">
        <AsyncBoundary state={account}>{(data) => <AccountContent account={data} />}</AsyncBoundary>
      </div>
    </PublicShell>
  )
}

function AccountContent({ account }: { account: PatientAccount }) {
  const navigate = useNavigate()
  const toast = useToast()
  const clinic = useAsync(() => api.clinic.getClinicInfo())
  const [fullName, setFullName] = useState(account.fullName)
  const [contactNumber, setContactNumber] = useState(account.contactNumber)
  const [emailNotifications, setEmailNotifications] = useState(account.emailNotifications)
  const [form, setForm] = useState<PasswordChange>(EMPTY_PASSWORD_CHANGE)
  const [profileError, setProfileError] = useState<string>()
  const [passwordError, setPasswordError] = useState<string>()
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [savedProfile, setSavedProfile] = useState({ fullName: account.fullName, contactNumber: account.contactNumber, emailNotifications: account.emailNotifications })
  const profileDirty = fullName !== savedProfile.fullName || contactNumber !== savedProfile.contactNumber || emailNotifications !== savedProfile.emailNotifications
  const passwordDirty = Object.values(form).some((value) => value !== '')
  const { confirmLeave, cancelLeave } = useConfirmLeave()
  useUnsavedChanges(!loggingOut && (profileDirty || passwordDirty))

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!profileDirty) return
    if (fullName.trim().length < 2) { setProfileError('Enter your full name.'); return }
    if (!isPhMobile(contactNumber)) { setProfileError('Enter a valid mobile number, e.g. 0917 123 4567.'); return }
    setSavingProfile(true)
    setProfileError(undefined)
    try {
      await api.patientAuth.updateAccount({ fullName, contactNumber, emailNotifications })
      setSavedProfile({ fullName, contactNumber, emailNotifications })
      toast.success('Profile saved', 'Your details are up to date.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    if (!isPasswordChangeReady(form)) return
    setSavingPassword(true)
    setPasswordError(undefined)
    try {
      await api.patientAuth.changePassword({ currentPassword: form.current, newPassword: form.next })
      setForm(EMPTY_PASSWORD_CHANGE)
      toast.success('Password changed', 'Use your new password the next time you sign in.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function logOut() {
    if (!confirmLeave()) return
    setLoggingOut(true)
    try {
      await api.patientAuth.logout()
      navigate('/patient/login', { replace: true })
      window.location.reload()
    } catch (err) {
      cancelLeave()
      toast.error('Could not log out', err instanceof Error ? err.message : 'Please try again.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="min-w-0 self-start rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Personal information</h2>
        <div className="mt-4 space-y-4">
          <TextField label="Full name" required value={fullName} onChange={setFullName} autoComplete="name" />
          <TextField label="Mobile number" required type="tel" value={contactNumber} onChange={setContactNumber} autoComplete="tel" />
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-700">Email address</p>
            <p className="break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">{account.email}</p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Email notifications</p>
            <p className="text-xs text-gray-500">Receive appointment emails from the clinic.</p>
          </div>
          <Toggle checked={emailNotifications} onChange={setEmailNotifications} label="Email notifications" />
        </div>
        {profileError && <p role="alert" className="mt-3 text-sm text-danger-700">{profileError}</p>}
        <Button type="submit" disabled={!profileDirty} loading={savingProfile} className="mt-5 w-full justify-center">Save changes</Button>
      </form>

      <form onSubmit={changePassword} className="min-w-0 self-start rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Change password</h2>
        <div className="mt-4"><ChangePasswordFields value={form} onChange={setForm} /></div>
        <p className="mt-3 text-right text-xs text-gray-500">
          Forgot your password?{' '}
          <Link to="/patient/forgot-password" state={{ email: account.email }} className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
            Reset it here
          </Link>
        </p>
        {passwordError && <p role="alert" className="mt-3 text-sm text-danger-700">{passwordError}</p>}
        <Button type="submit" loading={savingPassword} disabled={!isPasswordChangeReady(form)} className="mt-5 w-full justify-center">Update password</Button>
      </form>

      <section className="min-w-0 self-start rounded-2xl border border-border bg-white p-5 shadow-sm" aria-labelledby="contact-clinic">
        <h2 id="contact-clinic" className="text-base font-semibold text-gray-900">Contact the clinic</h2>
        <p className="mt-1 text-sm text-gray-500">Need help with your appointment or account?</p>
        {clinic.data?.mobile && <a href={`tel:${clinic.data.mobile.replace(/[^+\d]/g, '')}`} className="mt-4 block text-sm font-semibold text-brand-700">Call {clinic.data.mobile}</a>}
        {clinic.data?.email && <a href={`mailto:${clinic.data.email}`} className="mt-2 block text-sm font-semibold text-brand-700">Email {clinic.data.email}</a>}
        {clinic.error && <p className="mt-3 text-sm text-gray-500">Clinic contact details are temporarily unavailable.</p>}
      </section>

      <Button variant="secondary" onClick={() => void logOut()} loading={loggingOut} className="w-full self-start justify-center lg:col-span-2">Log out</Button>
    </div>
  )
}
