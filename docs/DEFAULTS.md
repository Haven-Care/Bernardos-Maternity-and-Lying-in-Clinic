# Defaults the clinic can change

These are working defaults, shipped so the system is safe before the clinic has
decided. Each one is a setting rather than a rewrite. When the clinic decides,
change the value where the table says and record the decision here.

| Decision | Default | Where it is set | How to change it |
|---|---|---|---|
| Who may change prices, services, appointment slots, opening hours, clinic info and settings | Administrators only | `adminOnly` in `backend/src/routes/clinic.routes.ts`, plus `ADMINISTRATOR_TABS` in `frontend/src/pages/portal/administration/Administration.tsx` | Swap `adminOnly` for `requireStaff` on the route, and drop the tab from `ADMINISTRATOR_TABS` |
| Who may reverse stock movements and archive medicines | All staff. Every action is recorded with its actor in the stock ledger | `backend/src/routes/inventory.routes.ts` | Add `requireRole('administrator')` to those two routes |
| Upcoming bookings one patient account may hold | 3 | `clinic_settings.max_active_bookings_per_account` | SQL editor: `update clinic_settings set max_active_bookings_per_account = 5 where id = 1;` |
| How far ahead patients may book | 90 days | `clinic_settings.max_booking_days_ahead` | SQL editor: `update clinic_settings set max_booking_days_ahead = 120 where id = 1;` |
| Day-wide booking ceiling | None (only per-slot capacity applies) | `clinic_settings.daily_booking_capacity` | SQL editor; `null` means no ceiling |
| Staff idle sign-out | 20 minutes | `VITE_STAFF_IDLE_MINUTES` in the frontend's Vercel environment | Set the variable and redeploy |
| Service prices | The unconfirmed values in `supabase/CONFLICTS.md` | Services & Pricing screen | An administrator edits them in the portal |
| Password minimum | 8 characters plus upper case, digit and symbol | `frontend/src/lib/password.ts` and the hosted Auth setting | Change both together (see `PRODUCTION_CONFIG.md`) |

There is no portal screen yet for the three `clinic_settings` limits. An operator
changes them in the Supabase SQL editor of the right project. The booking
function reads them on every booking, so a change applies immediately.

## Not yet decided, not yet built

- **Staff two-step sign-in (MFA).** Supabase supports authenticator apps for free. Enforcing it for staff is planned: an enrol screen, a challenge screen, and an administrator reset.
- **Retention periods.** How long the system keeps notifications and guest-booking contact copies, and the medical-record retention the clinic follows under DOH rules.
