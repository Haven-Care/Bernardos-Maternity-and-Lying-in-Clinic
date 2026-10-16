# Design conflicts resolved in the seed

The Figma contradicts itself in a handful of places. A database cannot hold two
answers, so each was resolved to write `seed.sql`. This file records what was
chosen and why, so the design can be corrected to match rather than the two
drifting further apart. Verified clinic information takes precedence over the
prototype; the remaining conflicts use the admin screens.

---

## 1. Clinic services have no published prices

The clinic banner lists 17 services but no prices. The seed uses those service
names and stores 0 as an unknown-price marker. The patient booking flow displays
"Price at clinic" for that marker. Staff can enter confirmed prices later.

## 2. "Other" had no service record

The patient booking wizard offers *Other — tell us during session*. The
prototype's Services & Pricing screen had no row for it, so an *Other* booking
would arrive pointing at a service row that does not exist.

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

**Seeded the banner-confirmed address, mobile number, and email.** The banner
does not settle the landline or Saturday hours, so the existing values remain.
The patient screen should read from the clinic record rather than carrying its
own copy.

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
