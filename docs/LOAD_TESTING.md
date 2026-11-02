# Load testing

`scripts/load/booking-load.js` is a [k6](https://k6.io/docs/get-started/installation/) script that checks HavenCare holds up under a busy clinic morning. Run it against **staging only**. It books real slots, and it cancels them again when it finishes.

## What it does

For about four and a half minutes, three things run at once:

| Scenario | Load | Why |
|---|---|---|
| `browse` | Ramps to 50 patients, each checking slot availability every 20–40 s | How the booking wizard is actually used |
| `race` | Every test patient books the same slot at the same moment, 90 s in | Proves `book_appointment`'s lock: no slot ends with more bookings than seats |
| `staff` | 3 portal sessions polling the dashboard every 15 s (only if staff credentials are set) | The front desk's view while patients book |

## Pass criteria

The run fails if any of these is not met:

- p95 response time under 800 ms, for responses that succeeded
- no 5xx responses (`server_errors` is 0)
- the contested slot has no more bookings than its capacity (`overbooked` is 0)

`rate_limited` counts 429 responses and is reported but does not fail the run. The pacing above keeps one machine under the public read limit (120 per minute per address), so a non-zero count means the limits or the pacing changed.

## Before the first run

On **staging**:

1. Create 3–10 patient accounts with confirmed emails and passwords, for example `load-1@example.test`. Use test addresses only, never real patients. The script signs them in and accepts the current privacy notice for any account that has not.
2. Pick a date that is open, not a holiday, and has a slot with fewer seats than you have test patients, so some of them lose the race. A date a few weeks ahead keeps the bookings out of the clinic's day.
3. Optional: a staff account for the dashboard scenario.

## Running it

From the repository root, with these set in your shell:

| Variable | Value |
|---|---|
| `CONFIRM_STAGING` | `yes`. The script refuses to start without it |
| `BASE_URL` | The staging **backend** origin, without `/api` |
| `SUPABASE_URL` | The staging Supabase URL |
| `SUPABASE_PUBLISHABLE_KEY` | The staging publishable (anon) key |
| `BOOKING_DATE` | `YYYY-MM-DD` from step 2 |
| `LOAD_PATIENTS` | `email:password` pairs, comma-separated |
| `STAFF_EMAIL`, `STAFF_PASSWORD` | Optional |

```bash
k6 run scripts/load/booking-load.js
```

Keep the passwords out of shell history and out of the repository. A local `.env` file loaded only for the run works.

## After the run

- Record the date, commit, p95, and the three counters in `docs/RUNBOOK.md`.
- If teardown failed partway, cancel the leftover `Load test booking` entries from the staff portal.
- Bookings that won the race appear in the staging audit log and notifications. That is expected.
