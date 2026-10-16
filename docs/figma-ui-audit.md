# HavenCare UI comparison — 16 October 2026

## References and verification scope

- [Admin Figma page](https://www.figma.com/design/HN1MtjiHtwzJKvBLXCjWqC/HavenCare-Prototype?node-id=2676-3)
- [User Figma page](https://www.figma.com/design/HN1MtjiHtwzJKvBLXCjWqC/HavenCare-Prototype?node-id=2676-2)
- [Vercel frontend](https://havencare-frontend-ruddy.vercel.app)

The public `/book` and `/patient/login` pages were viewed on Vercel. The Vercel admin route redirected to `/login` because this browser has no staff session. The admin comparison below therefore uses the Figma guest view, the local Hannah admin preview at `http://127.0.0.1:5174/admin`, and the merged frontend source. It is **not** a verified page-by-page comparison against the signed-in Vercel admin UI. Figma's guest canvas also intermittently failed to render, so detailed visual fidelity remains unverified.

## Admin side

The Figma admin page has frames for Dashboard; Appointment Booking Requests and Calendar; Inventory Medicine List, Stock Movement, Low Stock, and Expiring Soon; Patient Records; Administration My Account, Services & Pricing, Appointment Slots, and Clinic Info; and staff login/password reset. **The user confirmed that Administration → My Account should be removed; that Figma frame is outdated scope.** The merged frontend otherwise contains corresponding admin pages and tabs. The local dashboard preview shows the clinic header, icon navigation, five summary tiles, inventory summary, and alert area.

Differences visible in the source and partial Figma view:

| Area | Figma | Current merged frontend |
| --- | --- | --- |
| Inventory heading | `Inventory Management` in the visible Low Stock frame | `Medicine Inventory` |
| Administration tabs | Four named frames, including the now-outdated My Account | Keep Patient Accounts, Services & Pricing, Appointment Slots, and Clinic Info; remove My Account |
| Appointments tabs | Booking Requests and Calendar frames | Adds a `Reschedules` queue |
| Staff provisioning | No frame observed | Administrator-only `/admin/system` page |

Patient Accounts and the Reschedules queue serve existing application features. The My Account frame is outside the agreed admin scope. Before calling the deployed admin UI approved, sign in on Vercel and visually check Dashboard, all three Appointment tabs, all four Inventory tabs, Patient Records, and the four retained Administration tabs at desktop width. Check interactions and real data separately from visual matching.

## Patient mobile implementation status

The USER Figma page is a mobile app layout with persistent bottom navigation: **Home, Book, History, Profile**. The `feat/mobile-patient-ui` branch now implements that navigation and a signed-in Home route. This is a source review; the deployed Vercel build has not been checked against the Figma frames.

| Figma flow | Branch implementation | Remaining gap |
| --- | --- | --- |
| Login | Email sign-in, password reset, sign-up link; successful default lands on Home | Mobile-number sign-in and Remember me need an auth decision. Supabase currently signs in by email and persists sessions. |
| Sign up | Full name, email, mobile number, password confirmation | Terms/Privacy content and consent flow have not been supplied. Do not display a checkbox that points to nonexistent policies. |
| Home | Greeting, next appointment from live bookings, shortcuts, recent activity | Reminder data and exact Figma visual matching remain open. |
| Book | Four steps: service, schedule, details, review and confirm | Visual matching and a signed-in end-to-end booking check remain open. |
| History | All, Upcoming, Completed, Cancelled filters; existing cancel and reschedule actions | Visual matching and live interaction checks remain open. |
| Profile | Editable name and mobile, email notification setting, password management, clinic contact links, logout | Emergency contact is stored on the clinical patient record, not the account API. Help & FAQs content and a patient edit flow are still needed. |

The user page also includes password recovery and several history/detail states. Capture those frame details during a visual comparison against the signed-in deployment.

## Next checks

1. Run a mobile-width walkthrough with a confirmed patient account against a working backend: sign in, book, review, view History, edit Profile, and log out.
2. Compare each mobile route with its Figma frame and resolve visual differences.
3. Decide the mobile-number authentication path and provide Terms/Privacy and Help & FAQs content.
4. Design a patient-safe emergency-contact API before adding editable emergency-contact fields to Profile.
