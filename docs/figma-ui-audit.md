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

## User side to build after admin review

The USER Figma page is a mobile app layout with persistent bottom navigation: **Home, Book, History, Profile**. The deployed patient experience uses desktop-centered web pages and currently has no equivalent home screen or bottom navigation.

| Figma flow | Design notes | Current frontend gap |
| --- | --- | --- |
| Login | Email **or mobile number**, password, Remember me, Forgot Password, Create an Account | `/patient/login` accepts email only and has no Remember me control |
| Sign up | Full name, email, mobile number, password confirmation, Terms/Privacy checkbox | `/patient/signup` lacks password confirmation and checkbox |
| Home | Greeting, next appointment card, Book Appointment and Booking History shortcuts, reminders, recent activity | No patient home route |
| Book | Four screens: service, date/time, patient information, review/submit | `/book` has three steps: service, schedule, details; submission is on the details step |
| History | All, Upcoming, Completed, Cancelled filters; status cards and cancellation | `/patient/bookings` exists, with All, Upcoming, Past, Cancelled filters and cancel/reschedule actions; layout differs |
| Profile | Personal and contact information, emergency contact, password management, notification settings, Help & FAQs, Contact Us, logout | `/patient/account` currently shows email and change password only; other screens/routes are absent |

The user page also includes password recovery and several history/detail states. Capture those frame details during implementation. The current comment in `frontend/src/pages/public/BookingPage.tsx` saying the prototype has no patient booking frames is outdated and should be corrected when this work begins.

## Recommended order

1. Verify the signed-in Vercel admin pages against Figma; record any concrete visual or functional gaps.
2. Fix confirmed admin gaps without removing the added operational tabs.
3. Implement the patient mobile shell and Home, then the four-step booking flow, History, and Profile/settings screens.
4. Confirm how mobile-number login, notification settings, and emergency contacts should work in the backend before presenting them as functional controls.
