import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../../api'
import { useAsync } from '../../hooks/useAsync'
import { PRIVACY_NOTICE_VERSION } from '../../types/privacy'

/**
 * The privacy notice patients agree to, at /privacy.
 *
 * DRAFT. Written by the team for the clinic to review with its lawyer. The
 * clinic is the personal information controller and decides what this says.
 * When the text changes in substance, bump PRIVACY_NOTICE_VERSION in
 * types/privacy.ts in the same change, and every patient is asked again.
 * Bracketed items are decisions the clinic has not made yet.
 */
export function PrivacyNotice() {
  const clinic = useAsync(() => api.clinic.getClinicInfo())
  const name = clinic.data?.name ?? 'Bernardo’s Maternity and Lying-in Clinic'
  const isDraft = PRIVACY_NOTICE_VERSION.includes('draft')

  return (
    <div className="min-h-dvh bg-brand-50/40 px-4 py-6 sm:py-10">
      <article className="mx-auto w-full max-w-3xl rounded-card border border-border bg-surface p-5 shadow-sm sm:p-8">
        <header className="flex items-center gap-3">
          <img src="/images/clinic-logo.jpg" alt="" className="size-12 object-contain" width={48} height={48} />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Privacy Notice</h1>
            <p className="text-sm text-gray-500">{name}</p>
          </div>
        </header>

        {isDraft && (
          <p role="note" className="mt-4 rounded-card border border-warning-500/30 bg-warning-50 px-3 py-2 text-sm text-warning-700">
            Draft for the clinic’s review. This notice has not yet been approved by the clinic and its legal adviser.
          </p>
        )}

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-gray-700">
          <Section title="Who is responsible for your information">
            <p>
              {name} is responsible for the personal information described here. Under the Data Privacy Act of
              2012 (Republic Act No. 10173), the clinic is the <em>personal information controller</em>. The team
              that built and maintains this booking and records system operates it for the clinic, under a written
              agreement, and does not use your information for anything else.
            </p>
            <ClinicContact clinic={clinic.data} />
          </Section>

          <Section title="What we collect">
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Your account:</strong> your name, email address and mobile number. Your password is handled by our sign-in provider; the clinic never sees it.</li>
              <li><strong>Your bookings:</strong> the service, date and time you choose, and the reason for your visit you give us.</li>
              <li><strong>Your clinical record</strong>, written by clinic staff when you visit: date of birth, sex, civil status, address, occupation, emergency contact, blood type, pregnancy history (such as gravida, para, last menstrual period and expected delivery date), allergies, medical conditions, and consultation notes.</li>
              <li><strong>Documents</strong> the clinic keeps for your care, such as a valid ID, laboratory results, ultrasound reports, a marriage certificate, or records from another hospital.</li>
              <li><strong>Security records:</strong> when you sign in, and a log of which staff member viewed or changed your record and when.</li>
            </ul>
            <p className="mt-2">Health information is <em>sensitive personal information</em> under the law, and we treat it that way.</p>
          </Section>

          <Section title="Why we use it">
            <ul className="list-disc space-y-1 pl-5">
              <li>To provide prenatal, maternity and related care, and to keep your medical record.</li>
              <li>To schedule your appointments and contact you about them.</li>
              <li>To meet the clinic’s legal duties, such as keeping medical records and reports the Department of Health requires.</li>
              <li>To keep the system secure, including checking who accessed which record.</li>
            </ul>
            <p className="mt-2">
              We process your health information with your consent, and where it is needed for your medical
              treatment, as the Data Privacy Act allows. We do not sell your information, use it for advertising,
              or send you marketing.
            </p>
          </Section>

          <Section title="Who can see it">
            <ul className="list-disc space-y-1 pl-5">
              <li>Clinic staff who need it for your care. Each staff member signs in with their own account, and their access is logged.</li>
              <li>
                Service providers that run the system for the clinic, under contract and only on the clinic’s
                instructions: Supabase (database and file storage), Vercel (website hosting), and Brevo (sending
                appointment and account emails).
              </li>
              <li>Government agencies, when the law requires it.</li>
            </ul>
          </Section>

          <Section title="Where it is stored">
            <p>
              Your information is stored on servers in Singapore operated by our service providers, and travels
              there encrypted. These providers are bound by contract to protect it as Philippine law requires.
            </p>
          </Section>

          <Section title="How long we keep it">
            <ul className="list-disc space-y-1 pl-5">
              <li>Medical records are kept for as long as Department of Health rules require [period to be confirmed by the clinic].</li>
              <li>Your account is kept until you ask us to close it. Your medical record is still kept for the required period after that.</li>
              <li>Staff notifications that mention your name are deleted after 12 months.</li>
            </ul>
          </Section>

          <Section title="How we protect it">
            <p>
              Connections are encrypted. Staff can see only what their role allows, staff sessions end after a
              period of inactivity, every access to a medical record is logged, and the system is backed up. If a
              breach of your personal information is likely to put you at risk, we will tell you and the National
              Privacy Commission as the law requires.
            </p>
          </Section>

          <Section title="Your rights">
            <p>Under the Data Privacy Act you have the right to:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>be informed about how your information is used, which is what this notice does;</li>
              <li>get a copy of your information;</li>
              <li>have wrong or incomplete information corrected;</li>
              <li>object to processing, and withdraw your consent;</li>
              <li>ask for your information to be deleted or blocked, subject to the clinic’s duty to keep medical records;</li>
              <li>receive your information in a format you can take elsewhere;</li>
              <li>be compensated for damage caused by misuse of your information; and</li>
              <li>file a complaint with the National Privacy Commission (privacy.gov.ph).</li>
            </ul>
            <p className="mt-2">
              To use these rights, sign in and open <strong>Profile → Your Privacy</strong>, or contact the clinic’s
              Data Protection Officer [name to be confirmed by the clinic] using the details above. Withdrawing consent
              means we can no longer take bookings through this app, but it does not affect care you have already
              received.
            </p>
          </Section>

          <Section title="Changes to this notice">
            <p>If we change this notice in a way that matters, we will ask you to read and agree to it again the next time you sign in.</p>
          </Section>

          <p className="border-t border-border pt-4 text-xs text-gray-500">
            Version {PRIVACY_NOTICE_VERSION}
          </p>
        </div>

        <p className="mt-6 text-sm">
          <Link to="/patient/login" className="font-semibold text-brand-600 hover:underline">Go to sign in</Link>
        </p>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

function ClinicContact({ clinic }: { clinic?: { address?: string; email?: string; mobile?: string; landline?: string } }) {
  if (!clinic) return null
  const phone = [clinic.mobile, clinic.landline].filter(Boolean).join(' · ')
  return (
    <p className="mt-2 text-gray-600">
      {clinic.address && <>{clinic.address}<br /></>}
      {phone && <>{phone}<br /></>}
      {clinic.email && <a href={`mailto:${clinic.email}`} className="font-medium text-brand-700">{clinic.email}</a>}
    </p>
  )
}
