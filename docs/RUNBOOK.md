# Operations runbook

For the people who keep HavenCare running for Bernardo's Maternity and
Lying-in Clinic. The clinic is the personal information controller under RA
10173 (the Data Privacy Act); the team that operates the system is its
personal information processor. Monitoring, backups and the release process
are added here in Phase 5.

## Personal data breach

> Draft procedure. The clinic's Data Protection Officer (DPO) and legal adviser
> must confirm it, including the current National Privacy Commission (NPC)
> rules and deadlines, before go-live.

A breach is any unauthorised access to, disclosure of, change to, or loss of
personal information. Examples: a lost laptop holding a backup, a leaked secret
key, a staff account used by someone else, or a patient record shown to the
wrong person.

### 1. Report it at once

Anyone on the team who suspects a breach tells the operators and the clinic's
DPO **immediately**, even before they are sure. The processing agreement sets
the deadline (proposed: within 24 hours). Write down what you saw, when, and how
you found out.

| Role | Name | Contact |
|---|---|---|
| Clinic DPO | _to fill_ | |
| Operator 1 | _to fill_ | |
| Operator 2 | _to fill_ | |

### 2. Contain

Pick what fits; record each step and its time.

- **Leaked secret key:** rotate the Supabase secret key (Project Settings → API Keys), update the Vercel Production variable, and redeploy the backend.
- **Compromised staff account:** deactivate it in System Access. Access ends on that account's next request.
- **Suspicious sessions:** revoke them from the Supabase dashboard (Authentication → Users → user → sign out).
- **Lost device or backup file:** treat every key it held as leaked, and rotate them.
- **Bad deployment exposing data:** roll back in Vercel (Deployments → previous → Promote).

### 3. Assess

Use the activity log (System Access → Activity Log, or the SQL editor) to find
what was reached. The log records who opened which record, never the values.

```sql
-- Everything one account did in the last week.
select occurred_at, action, patient_id, details
from audit_log
where actor_id = '<account id>' and occurred_at > now() - interval '7 days'
order by occurred_at desc;

-- Unusual volume: who opened the most records or documents in a day.
select actor_id, action, count(*)
from audit_log
where action in ('patient.view', 'patient.export', 'document.open', 'clinical_record.view')
  and occurred_at > now() - interval '1 day'
group by actor_id, action
order by count(*) desc;
```

Establish:
- Which patients are affected, and how many.
- Which kinds of data were exposed. Health information is sensitive personal information.
- Whether the data was encrypted, and whether it was actually seen or taken.
- Whether it could lead to identity fraud or other serious harm.

### 4. Notify

The clinic, as controller, decides and notifies. Under NPC rules (NPC Circular
16-03, *Personal Data Breach Management*), a breach involving sensitive personal
information that is likely to cause real risk of serious harm must be reported
to the NPC, and the affected patients told, within **72 hours** of the clinic
knowing about it. The operators prepare the facts from step 3 for the DPO.

The notice to patients says, in plain language:
- what happened
- what information was involved
- what the clinic has done
- what the patient can do
- whom to contact

### 5. Record and review

Keep a breach record even when no notification was needed:
- dates and times
- facts
- people affected
- containment steps
- the notification decision and its reasons
- follow-up actions

Within two weeks, review what allowed it and change the system or process so it
cannot happen the same way again.

## Data-subject requests

Patients file requests from **Profile → Your Privacy**. They appear in **System
Access → Privacy Requests**, and the desk gets a notification.

- **Access (copy of their information):** open the patient in Patient Records, choose **Export record**, and send the file to the patient's own email address. The export is logged. Document files are listed in the export; open and send them individually if the patient asks.
- **Correction:** edit the record, then resolve the request saying what changed.
- **Deletion:** medical records are kept for the period DOH rules require. Close the patient's sign-in account if they ask, and say what was kept and why.
- **Objection or withdrawn consent:** stop online booking for the account by closing it, and record the reply.

Write every reply in the resolution note. The patient reads it in their profile.

## Routine jobs

- **Notification retention:** `select purge_expired_notifications();` deletes notifications older than `clinic_settings.notification_retention_days` (365 by default). Run it monthly until Phase 5 schedules it.
