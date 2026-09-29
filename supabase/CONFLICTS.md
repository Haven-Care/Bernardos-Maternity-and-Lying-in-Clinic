# Design conflicts resolved in the seed

The Figma contradicts itself in a handful of places. A database cannot hold two
answers, so each was resolved to write `seed.sql`. This file records what was
chosen and why, so the design can be corrected to match rather than the two
drifting further apart.

**The rule applied throughout: the admin screens win.** Staff own pricing,
stock and records; the patient-facing screens display them. Where a conflict is
between an admin screen and a patient screen, the admin value is the one seeded.

---

## 1. Service prices disagree — and the mocks disagree with both

Three sources, three answers:

| Service | Admin *Services & Pricing* | Patient *Select Service* | `frontend/src/mocks/services.ts` |
|---|---|---|---|
| Pre-natal Check-up | ₱200 | ₱500 | **₱300** |
| Consultation | ₱200 | ₱350 | **₱200** |
| Ultrasound | ₱500 | ₱1,200 | **₱500** |
| Follow-up | ₱200 | ₱250 | **₱200** |

**Seeded from the mocks.** They are the most recent read of the Figma and they
are what the UI renders today, so seeding anything else would make the working
app change its own prices the day the backend lands.

> **These figures are not confirmed and must not be presented as the clinic's
> pricing.** The clinic sets its prices; we cannot dictate them. The pitch deck
> already avoids putting any peso figure on a slide, deliberately — keep it that
> way until Ana Melinda Bernardo confirms the real numbers.

## 2. "Other" had no service record

The patient booking wizard offers *Other — tell us during session*. Services &
Pricing lists only the four priced services, so an *Other* booking would arrive
pointing at a service row that does not exist.

**Seeded as a real service**, priced 0, because the fee is agreed at the visit.
The alternative — a nullable `service_id` — would weaken the column for every
other booking to accommodate one case.

## 3. Folic Acid was a tablet in one screen and an ointment in another

The Folart medicine record shows Form/Type `Ointment`; the Stock In and Stock
Out item pickers list `Folic Acid - Tablet, 5mg`. Both would be on screen in the
same demo.

**Seeded as `Tablet`.** Folic acid is an oral supplement; the ointment entry is
the error.

## 4. "All Categories" appeared inside a medicine record

The edit form's Category dropdown lists `All Categories` above the four real
classifications. That is a filter placeholder leaking into a data-entry field —
a medicine cannot *be* all categories.

**Not seeded, and not storable.** The list-screen filter should keep the option;
the record field should not offer it.

## 5. Clinic contact details disagree

Admin *Clinic Info* says 123 Llano Caloocan City, (02) 8123 4567,
bernardo1@havencare.ph, Saturday 8:00 AM – 12:00 PM. Patient *Contact Us* says
656 Llano Road Brgy 167, 0942 569 8248, a personal Gmail address, Saturday
9:00 AM – 3:00 PM.

**Seeded from Clinic Info**, including the Saturday half-day, which is why the
Saturday slot grid ends at 10:00. The patient screen should read from this
record rather than carrying its own copy.

## 6. Paracetamol B-2291 had two different countdowns

Expiration Tracker showed `5 days`; the dashboard Urgent Alert said `expiring in
32 days` — same batch, same stated expiry.

**Moot now.** Days-left is computed from `expires_at` in one place
(`medicine_stock` / the expiring query), so the two screens cannot disagree
again. Seeded at 5 days, which is what the Expiration Tracker showed.

---

## Not a conflict, but decided here

**`no_show` is not an appointment status.** It appears nowhere in the prototype.
Adding it would put a sixth wedge in a pie chart designed around five and a
sixth option in the status filter. Add it only if the clinic asks.

**Medicine category is free text, not an enum.** The four observed values are
the filter's options, not a closed set — the seed already needs `Obstetric` for
Oxytocin, which is not among them.
