# User Licence / Ticket / Training Form — Structure & Field Map

**Source page:** `https://app.superiorgroup.com.au/user/521/user-licences/create`
**Page title:** Add licence, ticket or training — Superior Group - Building Tools
**Captured:** 2026-04-21

This document maps every dropdown (including nested / conditional dropdowns) and every form field on the "Add licence, ticket or training" page. Intended as the spec input for a gap analysis against the internal Employee file-type / licence-type data model.

---

## 1. Global / always-present fields

Regardless of which licence, ticket or training type is chosen, the form always renders:

| Field | HTML type | Required | Accepted inputs / notes |
|---|---|---|---|
| **Licence, ticket or training type** | `<select>` | Yes | See §2 below |
| **Front** (image upload) | `<input type="file" id="file">` | Yes | `accept="image/*,application/pdf"`, `capture="camera"`, single file only |
| **Back** (image upload) | `<input type="file" id="file_back">` | No (labelled "Optional") | `accept="image/*,application/pdf"`, `capture="camera"`, single file only |

**File type coverage:** The upload inputs accept only **images** (`image/*` — JPG, PNG, GIF, WebP, HEIC, etc.) and **PDFs** (`application/pdf`). They do **not** accept `.docx`, `.xlsx`, `.txt`, zip archives, or any other non-image / non-PDF format.

---

## 2. Top-level type dropdown ("Licence, ticket or training type")

Values (select `value` → display text):

| Value | Display text |
|---|---|
| `gcic` | General construction induction card (White/Blue card) |
| `qualifications` | Qualifications |
| `tickets_licences` | Tickets & licences |
| `short_courses` | Short courses |
| `hsr` | Health & safety representative training (HSR) |
| `quantitative_fit_test_card` | Quantitative fit test card |

The form is dynamic — each value reveals a different set of follow-on fields, detailed in §3.

---

## 3. Per-type nested fields

### 3.1 `gcic` — General construction induction card (White/Blue card)

No nested dropdowns. No extra fields.

Rendered fields: Licence type · Front · Back

### 3.2 `qualifications` — Qualifications

Reveals one nested dropdown:

- **Qualification** (`<select>`, required):

  | Value | Display text |
  |---|---|
  | `plastering` | Trade certificate - Cert III in plastering |
  | `carpentry` | Trade certificate - Cert III in carpentry |
  | `usi_transcript` | USI transcript |
  | `other` | Other |

- If **Qualification = `other`**, an additional text field is revealed:
  - **Qualification name** (`<input type="text">`)

No Completed date / Expiry date fields are rendered for Qualifications.

### 3.3 `tickets_licences` — Tickets & licences

Reveals one nested dropdown:

- **Tickets & licences** (`<select>`, required):

  | Value | Display text |
  |---|---|
  | `hrwl` | High risk work licence (HRWL) |
  | `ewp` | EWP - below 11m |
  | `telehandler` | Telehandler |
  | `work_safely_at_heights` | Work safely at heights |
  | `manual_handling` | Manual handling |
  | `other` | Other |

Per sub-value, additional fields appear as follows:

#### 3.3.1 `hrwl` — High risk work licence
- **Category** — a multi-select listbox (not a native `<select>`; implemented as `<ul role="listbox">`):
  - Boom WP - above 11m
  - Forklift
  - Other
- **Expiry date** (`<input type="date">`, Optional)
- If **Category = Other** → additional text field: **Other category name**

#### 3.3.2 `ewp` — EWP - below 11m
- **Category** — multi-select listbox:
  - Boom
  - Scissor
  - Vertical lift
  - VOC documentation
  - Other
- **Expiry date** (Optional)
- If **Category = Other** → additional text field: **Other category name**

#### 3.3.3 `telehandler` — Telehandler
- **Expiry date** (Optional)
- No Category listbox.

#### 3.3.4 `work_safely_at_heights`
- **Expiry date** (Optional)
- No Category listbox.

#### 3.3.5 `manual_handling`
- No Expiry date, no Category. (Front + Back only in addition to the top-level + ticket dropdown.)

#### 3.3.6 `other` (within Tickets & licences)
- **Ticket or licence name** (`<input type="text">`)
- **Expiry date** (Optional)

### 3.4 `short_courses` — Short courses

Reveals one nested dropdown:

- **Short courses** (`<select>`, required):

  | Value | Display text |
  |---|---|
  | `workplace_impairment_training` | Workplace impairment training |
  | `asbestos_awareness_training` | Asbestos awareness training |
  | `silica_awareness_training` | Silica awareness training |
  | `gender_equity_training` | Gender equity training |
  | `first_aid_cpr` | First Aid / CPR |
  | `other` | Other |

Plus, on every short course choice:
- **Completed date** (`<input type="date">`)
- **Expiry date** (`<input type="date">`)

If **Short courses = `other`** → additional text field: **Course name**

### 3.5 `hsr` — Health & safety representative training (HSR)

Reveals one nested dropdown:

- **HSR courses** (`<select>`, required):

  | Value | Display text |
  |---|---|
  | `full_course` | Full course (5 days) |
  | `refresher` | Refresher |

Plus:
- **Completed date**
- **Expiry date**

(No text-input "other" branch for HSR.)

### 3.6 `quantitative_fit_test_card` — Quantitative fit test card

No nested dropdown. Adds two date fields:
- **Completed date**
- **Expiry date**

---

## 4. Summary matrix

| Top-level type | Nested dropdown 1 | Nested dropdown 2 / listbox | Free-text "Other" field | Completed date | Expiry date |
|---|---|---|---|---|---|
| gcic | — | — | — | — | — |
| qualifications | Qualification (4 options) | — | Qualification name (when Other) | — | — |
| tickets_licences → hrwl | Tickets & licences | Category listbox (3 options) | Other category name (when Other) | — | Optional |
| tickets_licences → ewp | Tickets & licences | Category listbox (5 options) | Other category name (when Other) | — | Optional |
| tickets_licences → telehandler | Tickets & licences | — | — | — | Optional |
| tickets_licences → work_safely_at_heights | Tickets & licences | — | — | — | Optional |
| tickets_licences → manual_handling | Tickets & licences | — | — | — | — |
| tickets_licences → other | Tickets & licences | — | Ticket or licence name | — | Optional |
| short_courses (any) | Short courses (6 options) | — | Course name (when Other) | Yes | Yes |
| hsr | HSR courses (2 options) | — | — | Yes | Yes |
| quantitative_fit_test_card | — | — | — | Yes | Yes |

---

## 5. File-upload attribute details (raw)

Both file inputs share the same config:

```
<input type="file" id="file"      accept="image/*,application/pdf" capture="camera" multiple=false>
<input type="file" id="file_back" accept="image/*,application/pdf" capture="camera" multiple=false>
```

- Single-file only per slot (no multi-upload).
- `capture="camera"` → on mobile this prefers the device camera.
- No max file-size / MIME enforcement visible client-side beyond the `accept` list.

---

## 6. Gap-analysis questions to answer

When comparing against the internal Employee file-types / licence schema, the following are likely to surface gaps:

1. Does the internal schema expose all six top-level categories (`gcic`, `qualifications`, `tickets_licences`, `short_courses`, `hsr`, `quantitative_fit_test_card`)?
2. Does each category's enum of sub-types match the UI enum above (values + display text)?
3. Is the **Category** multi-select for HRWL and EWP persisted as an array, and do the allowed values match?
4. Are the conditional text fields (`Qualification name`, `Other category name`, `Ticket or licence name`, `Course name`) persisted on a shared `name` column or category-specific columns?
5. Which records require `completed_date` / `expiry_date` and which don't? (See matrix in §4.)
6. Are file attachments modelled as exactly **two** slots (Front + Back), both accepting `image/*` + `application/pdf`, or does the schema allow more slots / more MIME types?
7. Is the "Back" slot nullable in the DB (matches "Optional" in the UI)?
