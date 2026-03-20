# Recruitment Pipeline — Concept Design

## The Funnel

```
PUBLIC FORM  ->  APPLICATION INBOX  ->  SCREENING  ->  PHONE INTERVIEW  ->  REFERENCE CHECK + FACE-TO-FACE  ->  CONTRACT  ->  ONBOARD
```

---

## Stage 0: Public Application Form

- Hosted on a public URL, embeddable as iframe on company website or job boards
- Collects: name, phone, email, trade/skill, years of experience, certifications/tickets (White Card, EWP, etc.), preferred work location, availability start date, resume upload, reference contacts (minimum 2)
- On submit: applicant gets a confirmation ("We've received your application")

---

## Stage 1: Application Inbox

- All submissions land in a single list visible to foremen
- Each application shows: name, trade, date submitted, status badge
- Status: **New** — waiting for review
- Foreman can filter/sort by trade, date, location preference
- No action required until the foreman is actively hiring

---

## Stage 2: Screening Decision

- Foreman opens an application and reviews the details
- Two actions available:
  - **Proceed** — moves to Phone Interview stage
  - **Decline** — marks as rejected (optionally with a reason)
- Declined applicants receive a polite rejection notification (email/SMS)

---

## Stage 3: Phone Interview

- Foreman calls the applicant using the phone number on file
- During/after the call, foreman records:
  - Free-text **comments** (attitude, communication, availability, salary expectations)
  - A simple **rating or disposition** (strong / maybe / weak)
- Decision after phone interview:
  - **Advance to Face-to-Face** — foreman sets an **interview date & time**
  - **Decline** — rejected with reason

---

## Stage 4: Reference Check (runs in parallel before face-to-face)

- System shows the references provided by the applicant (name, phone, relationship)
- Foreman (or admin) calls each reference and records:
  - Date contacted
  - Comments received (work ethic, reliability, skills, would they rehire?)
  - Outcome: **Satisfactory / Unsatisfactory / Unable to Contact**
- All reference notes are stored against the application
- This must be completed **before or by the time** the face-to-face happens

---

## Stage 5: Face-to-Face Interview

- Conducted on the scheduled date
- Foreman follows a **structured checklist** specific to the worker type (e.g., labourer vs. carpenter vs. crane operator), covering:
  - Safety awareness questions
  - Trade-specific competency questions
  - Scenario/behavioural questions
  - Physical fitness / PPE requirements
  - Right to work verification
- Each question has a field to **record the applicant's response**
- Foreman marks an overall outcome: **Pass / Fail**

---

## Stage 6: Employment Contract

- Triggered **immediately** after a successful face-to-face
- System selects the correct **contract template** based on worker type (casual labourer, subcontractor, full-time tradesman, etc.)
- Placeholder fields are auto-filled: applicant name, start date, pay rate, site location, etc.
- Contract is sent to the applicant for **digital signature** (email/SMS link)
- Applicant reviews and signs electronically
- Signed contract PDF is stored against their profile

---

## Stage 7: Manager Review & Onboard Request

- Construction Manager sees a summary view of the completed pipeline:
  - Application details
  - Phone interview notes + rating
  - Reference check results
  - Face-to-face checklist + responses + outcome
  - Signed contract (viewable/downloadable)
- Manager either:
  - **Approves** — triggers an onboard request (into EmployeeHub or wherever workers are managed)
  - **Sends Back** — flags an issue for the foreman to resolve before proceeding

---

## Status Lifecycle Summary

| Status | Who Acts | What Happens |
|---|---|---|
| New | — | Application received, sitting in inbox |
| Under Review | Foreman | Foreman is looking at it |
| Phone Interview | Foreman | Call scheduled/completed |
| Reference Check | Foreman/Admin | Calling references |
| Face-to-Face Scheduled | Foreman | Interview date set |
| Interview Complete | Foreman | Checklist filled, passed |
| Contract Sent | Applicant | Awaiting digital signature |
| Contract Signed | — | Signed PDF stored |
| Pending Onboard | Construction Manager | Final review |
| Onboarded | — | Done, worker is in the system |
| Declined | — | Rejected at any stage |

---

## Key Principles

1. **Foreman-driven** — they control the pace; no forced timelines
2. **Linear but flexible** — stages flow in order, but reference checks run parallel to interview scheduling
3. **Everything recorded** — every call, comment, and decision is logged against the application
4. **Template-based contracts** — no manual drafting, just fill placeholders per worker type
5. **Manager as gatekeeper** — nothing gets onboarded without construction manager sign-off

---

## Design Decision: Digital Signatures

### Approach: Custom In-App Signing (over DocuSign)

**Why not DocuSign / third-party e-signature services:**
- Cost per envelope ($1-2+ per send) adds up fast with high-volume trades hiring
- Overkill for internal employment contracts that don't need the same legal weight as commercial contracts
- External dependency and API integration complexity
- Applicants need email access — some labourers don't check email regularly

**How custom signing works:**
- Applicant receives an SMS/email link to a simple page
- Page shows the pre-filled contract as a readable document
- Applicant types their name, ticks "I agree", and taps sign
- System captures: full name, timestamp, IP address, device info
- Generates a signed PDF with the signature block and stores it

**Why this fits better:**
- **Zero per-signature cost** — construction hires in volume
- **SMS-first** — tradies are more likely to open a text than an email
- **Simple UX** — no account creation, no app download
- **Fast** — applicant can sign on their phone in 30 seconds on site
- **Full control** — ties directly into the pipeline status without webhook complexity
- **Legally sufficient** — for employment contracts in Australia, a typed name + intent to sign + timestamp is valid under the Electronic Transactions Act 1999

**What gets stored per signature:**
- Signed PDF (generated from template)
- Signer's full name (typed)
- Timestamp (UTC)
- IP address
- User agent / device info
