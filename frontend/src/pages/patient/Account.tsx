import { ValidatedForm } from '../../components/ui/ValidatedForm'
import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../../api'
import type { PatientAccount } from '../../types/patientAccount'
import { useConfirmLeave, useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { useAsync } from '../../hooks/useAsync'
import { Button } from '../../components/ui/Button'
import { TextField } from '../../components/ui/fields'
import { AsyncBoundary } from '../../components/ui/states'
import { Toggle } from '../../components/ui/Toggle'
import { useToast } from '../../components/ui/toast-context'
import { isPhMobile } from '../../lib/validate'
import { PublicShell } from '../public/PublicShell'

export function Account() {
  const account = useAsync(() => api.patientAuth.getAccount())

  return (
    <PublicShell>
      <h1 className="text-xl font-semibold text-gray-900">Profile &amp; Settings</h1>
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
  const [profileError, setProfileError] = useState<string>()
  const [passwordError, setPasswordError] = useState<string>()
  const [savingProfile, setSavingProfile] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const passwordRequestInFlight = useRef(false)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationError, setNotificationError] = useState<string>()
  const [savedNotifications, setSavedNotifications] = useState(account.emailNotifications)
  const [loggingOut, setLoggingOut] = useState(false)

  const [savedProfile, setSavedProfile] = useState({ fullName: account.fullName, contactNumber: account.contactNumber })
  const profileDirty = fullName !== savedProfile.fullName || contactNumber !== savedProfile.contactNumber
  const notificationDirty = emailNotifications !== savedNotifications
  const { confirmLeave, cancelLeave } = useConfirmLeave()
  useUnsavedChanges(!loggingOut && (profileDirty || notificationDirty))

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    if (!profileDirty) return
    if (fullName.trim().length < 2) { setProfileError('Enter your full name.'); return }
    if (!isPhMobile(contactNumber)) { setProfileError('Enter a valid mobile number, e.g. 0917 123 4567.'); return }
    setSavingProfile(true)
    setProfileError(undefined)
    try {
      await api.patientAuth.updateAccount({ fullName, contactNumber })
      setSavedProfile({ fullName, contactNumber })
      toast.success('Profile saved', 'Your details are up to date.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function requestPasswordReset() {
    if (passwordRequestInFlight.current) return
    passwordRequestInFlight.current = true
    setSendingCode(true)
    setPasswordError(undefined)
    try {
      if (!await confirmLeave()) return
      await api.patientAuth.requestPasswordReset(account.email)
      navigate('/patient/verify-code', { state: { email: account.email, codeSentAt: Date.now(), returnTo: '/patient/account' } })
    } catch (err) {
      cancelLeave()
      setPasswordError(err instanceof Error ? err.message : 'Could not send the verification code. Please try again.')
    } finally {
      passwordRequestInFlight.current = false
      setSendingCode(false)
    }
  }

  async function saveNotifications(event: React.FormEvent) {
    event.preventDefault()
    if (!notificationDirty || savingNotifications) return
    setSavingNotifications(true); setNotificationError(undefined)
    try {
      await api.patientAuth.updateAccount({ emailNotifications })
      setSavedNotifications(emailNotifications)
      toast.success('Notification settings saved', 'Your email preference has been updated.')
    } catch (error) { setNotificationError(error instanceof Error ? error.message : 'Could not save notification settings.') }
    finally { setSavingNotifications(false) }
  }

  async function logOut() {
    if (!await confirmLeave()) return
    setLoggingOut(true)
    try {
      await api.patientAuth.logout()
      navigate('/login', { replace: true })
      window.location.reload()
    } catch (err) {
      cancelLeave()
      toast.error('Could not log out', err instanceof Error ? err.message : 'Please try again.')
      setLoggingOut(false)
    }
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
      <ProfilePanel title="Personal Information" description="Your name and contact details">
        <ValidatedForm onSubmit={saveProfile}>
          <fieldset disabled={savingProfile} className="space-y-4">
            <TextField validation="name" label="Full name" required value={fullName} onChange={setFullName} autoComplete="name" />
            <TextField validation="mobile" maxLength={30} label="Mobile number" required type="tel" value={contactNumber} onChange={setContactNumber} autoComplete="tel" />
            <div>
              <p className="mb-1.5 text-xs font-medium text-gray-700">Email address</p>
              <p className="break-all rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">{account.email}</p>
            </div>
            {profileError && <p role="alert" className="text-sm text-danger-700">{profileError}</p>}
            <Button type="submit" disabled={!profileDirty} loading={savingProfile} className="w-full justify-center">Save personal information</Button>
          </fieldset>
        </ValidatedForm>
      </ProfilePanel>

      <ProfilePanel title="Password Management" description="Reset your password with an email code">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">We’ll send a six-digit verification code to <span className="break-all font-medium text-gray-900">{account.email}</span>. Enter the code, then choose a new password.</p>
          <p className="text-xs text-gray-500">You’ll stay signed in. You can cancel before saving a new password.</p>
          {passwordError && <p role="alert" className="text-sm text-danger-700">{passwordError}</p>}
          <Button type="button" onClick={() => void requestPasswordReset()} loading={sendingCode} className="w-full justify-center">Send verification code</Button>
        </div>
      </ProfilePanel>

      <ProfilePanel title="Notification Settings" description="Manage appointment email notifications">
        <ValidatedForm onSubmit={saveNotifications}>
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-sm font-medium text-gray-900">Email notifications</p><p className="mt-1 text-xs text-gray-500">Receive appointment emails from the clinic.</p></div>
            <Toggle checked={emailNotifications} onChange={setEmailNotifications} disabled={savingNotifications} label="Email notifications" />
          </div>
          {notificationError && <p role="alert" className="mt-3 text-sm text-danger-700">{notificationError}</p>}
          <Button type="submit" loading={savingNotifications} disabled={!notificationDirty} className="mt-4 w-full justify-center">Save notification settings</Button>
        </ValidatedForm>
      </ProfilePanel>

      <ProfilePanel title="Contact Us" description="Get in touch with the clinic">
        <AsyncBoundary state={clinic}>{(details) => <div className="space-y-3 text-sm">
          <p className="font-medium text-gray-900">{details.name}</p>
          {details.address && <p className="text-gray-600">{details.address}</p>}
          {details.mobile && <a href={`tel:${details.mobile.replace(/[^+\d]/g, '')}`} className="block w-fit py-1 font-semibold text-brand-700">Call {details.mobile}</a>}
          {details.landline && <a href={`tel:${details.landline.replace(/[^+\d]/g, '')}`} className="block w-fit py-1 font-semibold text-brand-700">Call {details.landline}</a>}
          {details.email && <a href={`mailto:${details.email}`} className="block break-all py-1 font-semibold text-brand-700">Email {details.email}</a>}
          {!details.mobile && !details.landline && !details.email && <p className="text-gray-500">Clinic contact details are currently unavailable.</p>}
        </div>}</AsyncBoundary>
      </ProfilePanel>

      <ProfilePanel title="Help & FAQs" description="Answers about your bookings and account">
        <div className="divide-y divide-border">{FAQS.map(({ question, answer }) => <details key={question} className="py-3 first:pt-0 last:pb-0">
          <summary className="cursor-pointer text-sm font-medium text-gray-900">{question}</summary>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">{answer}</p>
        </details>)}</div>
      </ProfilePanel>

      <Button variant="secondary" onClick={() => void logOut()} loading={loggingOut} className="w-full self-start justify-center lg:col-span-2">Log out</Button>
    </div>
  )
}

const FAQS = [
  { question: 'What does Booked mean?', answer: 'Your appointment is accepted and the time slot is reserved. Please arrive at the scheduled time.' },
  { question: 'How can I request a different appointment time?', answer: 'Open History, expand the appointment, and choose Request another time. Your original schedule stays reserved until the clinic approves the request.' },
  { question: 'How can I cancel a booking?', answer: 'Open History, expand an upcoming appointment, and select Cancel. Confirm the cancellation to release your reserved slot.' },
  { question: 'How do I update my contact information?', answer: 'Open Personal Information, edit your name or mobile number, then select Save personal information.' },
  { question: 'What if I forget my password?', answer: 'Use Forgot Password on the sign-in page and follow the email verification steps. If you are already signed in, open Password Management and select Send verification code to reset it using your registered email.' },
]
const desktopQuery = '(min-width: 1024px)'
function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia(desktopQuery)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}
function isDesktop() { return window.matchMedia(desktopQuery).matches }

function ProfilePanel({ title, description, initialOpen = false, children }: { title: string; description: string; initialOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen)
  const desktop = useSyncExternalStore(subscribeDesktop, isDesktop, () => true)
  const id = useId()
  const expanded = desktop || open
  return <section className="min-w-0 rounded-2xl border border-border bg-white p-5 shadow-sm">
    <h2><button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => { if (!desktop) setOpen((previous) => !previous) }}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 lg:cursor-default">
      <span><span className="block text-base font-semibold text-gray-900">{title}</span><span className="mt-1 block text-xs font-normal text-gray-500">{description}</span></span>
      <svg className={`size-5 shrink-0 text-brand-700 transition-transform lg:hidden ${expanded ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button></h2>
    <div id={id} hidden={!expanded} className="mt-4 border-t border-border pt-4">{children}</div>
  </section>
}
