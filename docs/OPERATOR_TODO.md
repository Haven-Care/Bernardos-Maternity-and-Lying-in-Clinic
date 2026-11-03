# Operator to-do list

Everything that needs a person: dashboard settings, accounts, and decisions. Code work is not here; that is in `ROADMAP_STATUS.md`. Tick items off as you go, and tell Claude when a step says so, because some steps unblock code or checks.

Last updated: 3 November 2026.

## Order

**Now (no clinic decision needed)**
1. [Upstash](#upstash): create the rate-limit database, then add it to [Vercel](#vercel).
2. [Supabase](#supabase-demo-project): apply the Auth settings on the demo project, then rotate its secret key.
3. [GitHub](#github): protect `main`, and confirm secret scanning.
4. [UptimeRobot](#uptimerobot): add the two health monitors.
5. [Supabase](#supabase-demo-project): ask Supabase in writing about the HIPAA clause.
6. [Brevo](#brevo): open the account and set up a test sender for the demo.
7. [Decisions for the team](#decisions-for-the-team): the access list.

**After the clinic interview**
- [Questions for the clinic](#questions-for-the-clinic)
- Vercel Pro, the production Supabase project, the domain, Brevo on the clinic's domain, and [Google sign-in](#google-sign-in).

**Later, optional**
- [Cloudflare](#cloudflare) (Turnstile and backups), [Sentry](#sentry-optional), [k6](#k6-optional).

---

## Upstash

Shared rate-limit counters, so every backend server counts together. Stores only counters keyed by visitor address or account id, which expire quickly. Free plan.

- [ ] Sign up at [upstash.com](https://upstash.com) with the team's shared account (for example `havencare.org@gmail.com`), not a personal one. The terms allow one free account per person or company.
- [ ] **Create Database → Redis**:
  - Name: `havencare-ratelimit-staging`
  - Region: AWS `ap-southeast-1` (Singapore), the same region as the backend and Supabase
  - Everything else at its defaults
- [ ] On the database page, in the **REST API** section, copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Use the normal token, not the read-only one.
- [ ] Add both to Vercel (see [Vercel](#vercel)).
- [ ] **Tell Claude.** Claude checks that the rate-limit count goes down.

Note: a free database with no requests for a week can be deleted. If that happens, the backend stops counting instead of failing; create a new one.

---

## Vercel

Team "Havencare": [havencare-backend](https://vercel.com/havencare/havencare-backend) and [havencare-frontend](https://vercel.com/havencare/havencare-frontend).

**Now**
- [x] Backend Preview `/api/health` and `/api/health/db` return 200 (2 Nov 2026).
- [ ] Add the Upstash variables: **havencare-backend → Settings → Environment Variables**
  - `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  - Environment: **Preview** only
  - Mark both **Sensitive**
  - Add both or neither; one without the other stops the deploy.
- [ ] Redeploy the latest Preview: **Deployments → ⋯ → Redeploy**. New variables reach only new deployments.

**After the clinic interview**
- [ ] Upgrade the team to **Pro** (Team Settings → Billing). Hobby does not allow paid client work. Decide who pays.
- [ ] On release day, the address check: Claude runs the same request twice while you switch this laptop between Wi-Fi and your phone's hotspot. It can only run once this work is on `main`.

---

## Supabase (demo project)

Project `camqzzctawwqlwmqqpop`: [dashboard](https://supabase.com/dashboard/project/camqzzctawwqlwmqqpop). Today it serves the demo **and** the live production URL, so take care.

### Auth settings (Authentication menu)
- [ ] **Sign In / Providers → Email**
  - Minimum password length: **12**
  - Password requirements ("Required characters"): leave **off**
  - Secure password change: **on**
  - Email OTP expiration: **900** seconds; OTP length stays **6**
- [ ] **Rate Limits:** at least **60 seconds** between emails to the same person.
- [ ] **URL Configuration**
  - Site URL: `https://bernardo-clinic.vercel.app`
  - Redirect URLs: keep `https://bernardo-clinic.vercel.app/auth/callback` and `https://bernardo-clinic.vercel.app/auth/recovery`. Remove entries for sites no longer used.
- [ ] **Multi-Factor:** enable **TOTP** (authenticator apps).
- **Not yet:**
  - leaked-password protection and session timeouts (Pro plan)
  - custom SMTP (after [Brevo](#brevo))
  - CAPTCHA: switching it on before Claude builds the Turnstile part breaks sign-in
  - the Google provider (needs a clinic-owned Google sign-in setup)

### Rotate the secret key
It was used on lab and shared computers. The production URL uses this project too, so the new key goes into **both** Vercel environments.
- [ ] In Vercel, check how the backend's `SUPABASE_SERVICE_ROLE_KEY` starts: `sb_secret_` or `eyJ`. Look only at the start.
- [ ] In Supabase, go to **Project Settings → API Keys** and create a new secret key (`sb_secret_…`).
- [ ] In Vercel, on **havencare-backend**, replace `SUPABASE_SERVICE_ROLE_KEY` in **Preview and Production**, then redeploy both.
- [ ] Open `/api/health/db` on both. A 200 means the new key works.
- [ ] Remove the old key:
  - **It started with `sb_secret_`:** delete it in Supabase.
  - **It started with `eyJ`:** it stays valid until legacy keys are turned off, which also turns off the frontend's old public key. **Tell Claude**, who moves the frontend to the `sb_publishable_` key first.
- [ ] Update each developer's `backend/.env`.

### Ask Supabase in writing
- [ ] Supabase's terms ban storing "protected health information (as defined in HIPAA)" without a US HIPAA agreement. HIPAA is US law, so it most likely does not cover a Philippine clinic. Ask them to confirm that, through the [sales contact form](https://supabase.com/contact/sales), because the free plan has no email support. Keep the reply.

### After the clinic interview: the production project
- [ ] Create a Supabase organisation that the clinic owns and pays for, on **Pro**. Free has no backups and pauses when idle.
- [ ] Create the project in **Southeast Asia (Singapore)**. Store its database password in the password manager.
- [ ] **Tell Claude**, who applies the migrations, sets up the environment variables, and splits Preview (demo) from Production.

---

## GitHub

Needs a repository admin. Repository: [Haven-Care/Bernardos-Maternity-and-Lying-in-Clinic](https://github.com/Haven-Care/Bernardos-Maternity-and-Lying-in-Clinic).

- [ ] **Protect `main`:** go to **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
  - Name: `Protect main`
  - Enforcement: **Active**
  - Target branches: include by pattern `main`
  - Turn on **Require a pull request before merging**
  - Turn on **Require status checks to pass**, and add:
    - `Lint, Build & Test (Backend)`
    - `Lint, Build & Test (Frontend)`
    - `Backend suites against local Supabase`
  - Turn on **Block force pushes**, then save.
- [x] Only `main` is protected (decided 3 Nov 2026). `dev`, the development branch, stays open for direct pushes.
- [ ] **Secret scanning:** in **Settings → Advanced Security** (on some accounts "Code security"), confirm that **secret scanning** and **push protection** are on.

---

## UptimeRobot

Emails you when the site stops answering. The free plan allows business use. One account per person.

- [ ] Sign up at [uptimerobot.com](https://uptimerobot.com), with your email as the alert contact.
- [ ] Add two **HTTP(s)** monitors, both at a 5-minute interval:
  - `https://havencare-backend.vercel.app/api/health` (the API is up)
  - `https://havencare-backend.vercel.app/api/health/db` (it can reach the database)
- [ ] Optional: a third monitor on `https://bernardo-clinic.vercel.app`.
- Do not use Better Stack's free plan: it is labelled for personal projects.

---

## Brevo

Sends the sign-in emails (sign-up confirmation, password-reset code). Free plan: 300 emails a day.

**Now, for the demo**
- [ ] Sign up at [brevo.com](https://www.brevo.com) with the team's shared account. Brevo may review the account before it can send.
- [ ] Add a sender under **Senders, Domains & Dedicated IPs → Senders**. A free mailbox, such as a Gmail address, works for the demo, but Brevo may rewrite it under `brevosend.com`.
- [ ] Under **SMTP & API → SMTP**, note the SMTP login and generate an **SMTP key**.
- [ ] In Supabase, go to **Authentication → Emails → SMTP Settings** and enable custom SMTP:
  - Host `smtp-relay.brevo.com`, port `587`
  - Username: the SMTP login; password: the SMTP key
  - Sender email: the verified sender
  - Sender name: `Bernardo's Maternity and Lying-in Clinic`
- [ ] In **Authentication → Emails → Templates**, paste in our two templates:
  - **Confirm signup:** subject `Confirm your Bernardo Clinic email`, body from `supabase/templates/confirmation.html`
  - **Reset password:** subject `Your Bernardo Clinic password verification code`, body from `supabase/templates/recovery.html`
- [ ] Sign up as a test patient and reset the password, and check both emails arrive.

**After the clinic interview**
- [ ] Authenticate the clinic's domain in Brevo (SPF, DKIM and DMARC records at the domain registrar), then switch the sender to an address on that domain.

---

## Google sign-in

Decided 3 Nov 2026: patients can sign in with Google at launch. Today's Google client is a development one; launch needs one the clinic owns. Do this after the clinic interview: it needs the clinic's Google account and the production Supabase project. Background: `LOCAL_DEVELOPMENT.md` → Google sign-in.

- [ ] Signed in with the clinic's Google account, create a Google Cloud project (for example `bernardo-clinic`).
- [ ] In **Google Auth Platform**:
  - **Branding:**
    - App name: `Bernardo's Maternity and Lying-in Clinic`
    - Support email: the clinic's
    - Privacy policy link: `https://bernardo-clinic.vercel.app/privacy`, or the clinic domain later
  - **Audience:** External.
  - **Data Access:** only the `openid`, email and profile scopes.
- [ ] **Clients → Create client → Web application:**
  - Authorized JavaScript origins: `https://bernardo-clinic.vercel.app`, and the clinic domain later. No path and no trailing slash.
  - Authorized redirect URI: the production project's `https://<project-ref>.supabase.co/auth/v1/callback`.
- [ ] In the production Supabase project, open **Authentication → Providers → Google**:
  - Enable it, and paste the client ID and client secret. The secret goes nowhere else.
  - Leave "Skip nonce checks" off.
- [ ] Publish the app (**Audience → Publish app**). Google may ask to verify the app's name and logo; allow a few days.
- [ ] **Tell Claude** the client ID; it is public. Claude checks Google sign-in under the site's security policy, then switches it on in Vercel.

---

## Cloudflare

One account covers both items. The free plans allow business use.

- [ ] **Turnstile** (the invisible "not a robot" check). Wait until Claude has built the frontend part.
  - In the Cloudflare dashboard, go to **Turnstile → Add widget**.
  - Hostnames: `bernardo-clinic.vercel.app` (and the clinic domain later). Mode: **Managed**.
  - Give Claude the **site key**. It is public.
  - The **secret key** goes only into Supabase (**Authentication → Attack Protection → CAPTCHA**), and only when Claude says the frontend is ready.
- [ ] **R2** (off-site backups). Wait until the backup plan is agreed; Claude writes the backup job first. Then create a bucket with the Asia-Pacific location hint and an API token limited to that bucket.

---

## Sentry (optional)

Error tracking. Allowed for business on the free plan, but it is limited to one user with no shared logins, and its terms ban sensitive personal information. Leave it until just before launch. If you use it, Claude sets it to send no personal data.

---

## k6 (optional)

The load test: it acts like several patients booking at once.

- [ ] Install it: `winget install k6 --source winget`
- [ ] Create 3–10 confirmed test patient accounts on the **demo** project. Never run k6 against real patients.
- [ ] Follow `docs/LOAD_TESTING.md`, and record the results in `RUNBOOK.md`.

---

## Decisions for the team

- [x] **Roles** (3 Nov 2026; Claude builds them):
  - **Staff:** all of the clinic's work, including prices and privacy requests.
  - **Owner:** one account, which you assign. Staff, plus the activity log and creating staff accounts.
  - **Administrator (HavenCare):** prices, hours, slots and clinic details only. No patient data, inventory or staff accounts.
  - **Super administrator (you):** everything, logged.
  - **Two-factor sign-in:** required for administrators and you.
- [ ] **Access list:** who on the team gets Supabase and Vercel access. Fill in the table under "Keys and access" in `PRODUCTION_CONFIG.md`.
- [x] **Google sign-in:** yes, at launch. See [Google sign-in](#google-sign-in).
- [x] **Migrations 26–28:** wait for the production project. The demo database stays as it is until it no longer serves the live site.
- [x] **Backups:** decide after the clinic interview.
- [x] **Branches:** `frontend-main` and `backend-main` → `dev` (development, taking over from `deployment/prep`) → `main` (live). Only `main` is protected. Claude sets up `dev`.

---

## Questions for the clinic

The clinic has no legal adviser or DPO, so the owner decides and is your contact.

- [ ] **Billing:** who pays for Vercel Pro and Supabase Pro? The production Supabase organisation should be the clinic's. Confirm current prices on each provider's pricing page first.
- [ ] **Domain:** does the clinic want its own domain for the site and email?
- [ ] **DPO:** the Data Privacy Act requires the clinic to name a Data Protection Officer, usually someone already at the clinic. NPC guidance warns about conflicts of interest, so let the owner choose.
- [ ] **Privacy notice:** the owner reads and approves our draft.
- [ ] **Medical-record retention:** how long DOH rules require records to be kept.
- [ ] **NPC registration:** whether the clinic must register with the National Privacy Commission.
- [ ] **Breach contacts:** the owner, plus which two of you act as operators (the table in `RUNBOOK.md`).
- [ ] **Roles:** check them with the owner. Every staff member can change prices and answer privacy requests; the owner creates staff accounts and reads the activity log; staff don't need two-factor sign-in.
- [ ] **Backups:** the budget for Supabase Pro backups plus an encrypted off-site copy on Cloudflare R2. The R2 copy fits in the free allowance.
- [ ] **Government and PhilHealth work:** how the clinic handles PhilHealth claims (maternity and newborn packages), reports to the local health office, and birth registration today. Paper, or a portal? This tells us whether any integration is worth building.
- [ ] **Demo patients:** after migration 27, the demo accounts `client01`–`client05` see a consent screen on their next sign-in. Expect it in demos.
