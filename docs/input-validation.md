# Input validation coverage

Validation runs in the shared form controls and before modal Save actions. Real forms validate on submission, including Enter and requestSubmit. Errors appear after leaving an invalid field or trying to submit; rejected numeric characters show an immediate explanation. The first invalid field receives focus, and its message is linked through aria-describedby.

The API repeats persistent-data validation. Existing database rules continue to enforce remaining stock, matching lot expiry, active staff, and allowed booking times. Optional clinical fields remain optional. Existing stored records are not rewritten by this update.

| Area | Text boxes / controls | Rule added or strengthened | Purpose |
|---|---|---|---|
| Batch actions | Quantity Disposed, Quantity Dispensed, Quantity Difference | Digits only; positive whole units; removal cannot exceed batch balance; increases cannot overflow the database integer | Reject letters, decimals, signs, exponents, negative counts, and overdraws |
| Receive Stock | Quantity Received | Positive whole units within the remaining integer capacity | Prevent malformed receipts and overflow |
| Receive Stock | Manufacturer Lot Number | Optional, at most 64 characters; letters, digits, spaces, #, _, ., /, hyphens | Match the database lot format while preserving packaging references |
| Receive Stock | Expiration Date | Real date, today or later; selected existing batch date is read-only | Prevent expired receipts and accidental expiry changes |
| Stock actions / history | Receipt Note, Reason / Reference, Correction Reason | Required after trimming; at most 2,000 characters | Keep a usable audit explanation |
| Medicine details | Generic Name, Brand Name, Dosage, Supplier Name, Supplier Contact, Storage Location | At most 200 characters; generic name and dosage required; control characters rejected | Bound metadata and reject blank required values without restricting valid product punctuation |
| Medicine details | Reorder Level, Target Stock | Nonnegative whole units; target must be at least reorder level | Keep alert and replenishment rules consistent |
| Pricing | Unit Cost, Selling Price, Service Price | Nonnegative finite amounts; at most two decimal places and 99,999,999.99 | Preserve centavos without silent rounding or database overflow; unspecified service price remains optional |
| Services / clinic | Service Name, Clinic Name, Category, License No., Address | Required names cannot be blank; names 200, category/license 100, address 1,000 characters | Prevent empty or excessively long catalogue and clinic metadata |
| People | Full Name on signup, profile, booking, patient record, staff account; Emergency Contact, Attending Physician, Provider | At least two characters and a letter when supplied; at most 200 characters; Unicode and punctuation accepted | Reject blank/numeric-only names without excluding accented or international names |
| Booking / patient profile | Mobile Number | Valid Philippine mobile formats (09…, +639…, 639…) with spaces, parentheses, and hyphens; at most 30 characters | Retain a usable contact number |
| Patient / staff / clinic records | Contact Number, Emergency Contact Number, Landline | 7–15 digits with standard phone formatting; at most 30 characters | Permit landlines and international phone formats while rejecting arbitrary text |
| Account / clinic / patient | Email fields, including sign-in and password recovery | Email syntax and at most 254 characters; optional clinical/clinic email may be blank | Catch malformed contact and authentication addresses |
| Clinic | Website | HTTP/HTTPS or a valid bare domain; at most 2,048 characters; no embedded credentials or executable URL schemes | Keep the website field usable as a web address |
| Patient record | Date of Birth, Last Menstrual Period | Real dates from 1900 through the current Manila day | Reject impossible and future historical dates |
| Patient record | Expected Delivery Date | Real date; cannot precede Last Menstrual Period when both exist | Catch inconsistent maternity dates while retaining historical records |
| Patient record | Gravida, Para | Optional nonnegative whole counts; para cannot exceed gravida | Keep obstetric counts consistent |
| Patient record | Occupation, Relationship, Allergies, Medical Conditions, Address | Occupation 200, relationship 100, clinical notes 2,000, address 1,000 characters; optional blanks allowed | Bound record text without demanding unknown clinical details |
| Clinical history | Consultation / Scan, Diagnosis & Findings, Provider, Date & Time | Required text; title/provider 200, findings 10,000 characters; valid date/time from 1900 through now | Keep complete, bounded historical entries |
| Booking | Reason for Visit | 5–2,000 characters after trimming | Provide enough context for the clinic |
| Rescheduling | New Date, New Time | Required real date from today onward; time must be an available dropdown option | Prevent incomplete schedules; the database still rechecks availability |
| Appointment slots | Time, Capacity | Required valid time and positive whole-number capacity | Prevent malformed schedules and fractional or zero capacity |
| Passwords | Password, Temporary Password, New Password, confirmations | Bounded lengths; temporary/new passwords have an eight-character minimum; existing new-password complexity and matching checks retained; new-password maximum 128 | Prevent oversized values and preserve the existing password policy without trimming password contents |
| Search / filters | Shared search boxes, dropdowns | Search limited to 200 characters; selected values must be offered options | Keep searches flexible while preventing excessive input or stale selections |
| Patient documents | File picker and upload metadata | JPG/PNG/WebP/HEIC/PDF, nonempty, at most 10 MB, filename 1–255 characters; visible upload errors | Match existing storage limits before uploading |

Existing safeguards retained: six numeric recovery-code digits, ordered date-range selection, allowed dropdown values, medicine-photo JPG/PNG/WebP and 5 MB limits, and physical-disposal acknowledgment. These are not presented as newly added rules.

## Patient Profile settings

The mobile Profile & Settings page provides five expandable panels: Personal Information, Password Management, Notification Settings, Contact Us, and Help & FAQs. All start collapsed so their titles are visible. Desktop shows all panel content. Personal information and email notification preferences have separate Save actions; changing one does not save the other. Contact details come from the configured clinic record, and the FAQs explain the implemented booking and account flows.

## Verification

DOM interaction tests cover rejected typed/pasted quantity text, blocked modal Save, batch balance bounds, centavo editing, correction after an invalid entry, keyboard/programmatic form submission, accessible errors, and independent mobile settings/notification saving. Pure validation and API boundary tests cover malformed text, dates, numbers, money, file metadata, and invalid medicine requests.

Run frontend/backend lint, build, and tests plus the contract synchronization check. Supabase integration tests require a local stack. Browser visual QA was unavailable while local browser use was disabled in Work settings.
