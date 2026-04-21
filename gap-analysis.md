# Gap Analysis — "Create File Type" dialog vs "Add licence, ticket or training" form

**Dialog source:** `https://portal.superiorgroup.com.au/employee-file-types` → "+ Add File Type"
**Target form:** `https://app.superiorgroup.com.au/user/{id}/user-licences/create`

Scope: the dialog's **form fields only** (conditions block intentionally out of scope).

---

## 1. "Create File Type" dialog — fields captured

| Field | Control | Notes |
|---|---|---|
| Document Name | text input | e.g. "White Card" |
| Category | text input | **Free-text**, not an enum. Placeholder: "e.g. General License, Training Certificate" |
| Description | textarea | Optional |
| Has back side (two-sided document) | toggle | Boolean flag |
| Active | toggle | Boolean flag, default on |

That's the full set of attributes this dialog lets you define on a file type.

---

## 2. What the user-licences form requires per record

From `user-licences/create`, a single licence/ticket/training record can carry:

1. Top-level type (enum of 6)
2. Sub-type (enum, depends on top-level; 2–6 options)
3. Category (multi-select enum; only for HRWL and EWP)
4. "Other"-branch free-text name (Qualification name / Other category name / Ticket or licence name / Course name)
5. Completed date (date)
6. Expiry date (date)
7. Front image/PDF (required)
8. Back image/PDF (optional)

---

## 3. Field-by-field coverage

| Need from user-licences form | Supported by dialog? | Where it maps / gap |
|---|---|---|
| Top-level type grouping (6 fixed values) | ⚠️ Partial | Only as free-text "Category". No enum, no validation, no hierarchy. |
| Sub-type enum (per top-level) | ❌ No | Dialog has no second-level field, no enum list, no parent-child link. Must model each sub-type as its own separate File Type row (loses the grouping relationship). |
| Multi-select Category listbox (HRWL / EWP) | ❌ No | Dialog has no multi-select / array field definition. |
| Conditional "Other" free-text capture | ❌ No | Dialog has no way to say "if sub-type = Other, capture extra text". No conditional UI rules. |
| Completed date | ❌ No | Dialog has no "tracks completed date" flag. |
| Expiry date | ❌ No | Dialog has no "tracks expiry date" flag. This is a major gap — many licences expire. |
| Front upload slot | ✅ Implicit | Every File Type is assumed to have a primary upload. |
| Back upload slot (optional) | ✅ Yes | "Has back side (two-sided document)" toggle covers this. |
| File MIME restriction (image/* + pdf) | ❌ Not exposed | Dialog has no "accepted file types" control; whatever the upload widget enforces is global. |
| Description metadata | ✅ Yes | Description textarea. |
| Active / inactive | ✅ Yes | Active toggle. |

---

## 4. Verdict

**The "Create File Type" dialog does NOT support all fields the user-licences form needs.** Critical gaps:

1. **No enum / dropdown definition** — Document Name and Category are both free-text. The live form relies on strict enums (6 top-level × N sub-types) that cannot be expressed here.
2. **No hierarchical type modelling** — the 3-level nesting (Top-level → Sub-type → Category listbox) collapses into a single free-text Category field.
3. **No multi-select sub-category** — HRWL and EWP both use multi-select; no support.
4. **No date-tracking flags** — neither Completed date nor Expiry date can be declared as part of a File Type's schema. Since most Tickets & licences / Short courses / HSR / Quantitative fit test records need at least one date, this is a blocker for parity.
5. **No conditional free-text "Other" field** — the dialog cannot express "when value = Other, also capture a name".
6. **No per-type MIME / file-size rules** — accepted file types (image/* + application/pdf) can't be tightened or loosened per document.

What the dialog *does* cover well: Document Name, free-text Category, Description, two-sided flag, Active flag.

---

## 5. Recommended additions to the dialog to reach parity

To cover what the user-licences form needs, the Create File Type dialog would need at minimum:

1. **Sub-type enum editor** — allow defining a list of allowed sub-type values (with optional display labels) per File Type.
2. **Multi-select category editor** — for types like HRWL / EWP where a record needs 1..n categories.
3. **"Allow Other" toggle** — with a linked text field label, so the form can prompt "Qualification name", "Course name", etc.
4. **Dates captured:** two toggles — "Track completed date" and "Track expiry date" (optional/required per type).
5. **Accepted file types** — multi-select of allowed MIME groups (images, PDF, docs, etc.).
6. **Back-side requirement** — extend the current toggle to tri-state: none / optional / required.
7. **Parent/child linkage** — optional "parent File Type" reference so sub-types keep their grouping (White card / Qualifications / Tickets & licences / etc.).

---

## 6. Quick reference — one-row summary

> Dialog = just `{name, free-text category, description, has-back-side, active}` + conditions. It does **not** model enums, sub-types, multi-select categories, expiry/completed dates, or conditional "Other" text inputs — all of which are required by the user-licences create form.
