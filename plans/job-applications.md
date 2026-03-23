# Employment Applications Feature

## Overview
Recruitment form (based on superiorgroup.com.au/enquire-now/) to capture employment applications from tradespeople. Public-facing form that stores applications for internal review, filtering, and reporting.

> **Naming:** "Employment application" (not "job application") — in construction, "job" can refer to a project/site.

## Source
- Form reference: https://superiorgroup.com.au/enquire-now/

---

## Schema Design

### Employment Application Tables

#### 1. `employment_applications`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| **Personal Details** |
| `surname` | string | yes | |
| `first_name` | string | yes | |
| `suburb` | string | yes | |
| `email` | string | yes | not unique — same person can apply multiple times, warn on duplicates |
| `phone` | string | yes | |
| `date_of_birth` | date | yes | |
| `why_should_we_employ_you` | text | yes | |
| `referred_by` | string | no | |
| `aboriginal_or_tsi` | boolean | no | yes/no radio |
| **Occupation** |
| `occupation` | string | yes | plasterer, carpenter, labourer, other |
| `apprentice_year` | tinyint, nullable | no | 1–4 if apprentice, null if qualified |
| `trade_qualified` | boolean | no | |
| `occupation_other` | string, nullable | no | free text if "other" selected |
| **Project/Site** |
| `preferred_project_site` | string | no | |
| **Licences & Tickets** |
| `safety_induction_number` | string | yes | Building Industry General Safety Induction |
| `ewp_below_11m` | boolean | no | EWP Operator Licence below 11m |
| `ewp_above_11m` | boolean | no | EWP Operator Licence above 11m (high risk) |
| `forklift_licence_number` | string | no | |
| `work_safely_at_heights` | boolean | yes | |
| `scaffold_licence_number` | string | no | |
| `first_aid_completion_date` | date | no | |
| `workplace_impairment_training` | boolean | yes | WIT |
| `wit_completion_date` | date | no | |
| `asbestos_awareness_training` | boolean | yes | |
| `crystalline_silica_course` | boolean | yes | 10830NAT |
| `gender_equity_training` | boolean | yes | |
| `quantitative_fit_test` | string | yes | "quantitative" or "no_fit_test" |
| **Medical History** |
| `workcover_claim` | boolean | no | last 2 years |
| `medical_condition` | string, nullable | no | |
| `medical_condition_other` | string, nullable | no | |
| **Acceptance / Declaration** |
| `acceptance_full_name` | string | yes | |
| `acceptance_email` | string | yes | |
| `acceptance_date` | date | yes | |
| `declaration_accepted` | boolean | yes | |
| **Pipeline** |
| `status` | string | yes | default `'new'` — see Status Flow below |
| `declined_at` | timestamp, nullable | no | when declined |
| `declined_by` | FK → users, nullable | no | who declined |
| `declined_reason` | text, nullable | no | why declined |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### 2. `employment_application_references` (up to 4 per application)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `employment_application_id` | FK → employment_applications | yes | cascade delete |
| `sort_order` | tinyint | yes | 1–4 |
| `company_name` | string | yes | |
| `position` | string | yes | |
| `employment_period` | string | yes | |
| `contact_person` | string | yes | |
| `phone_number` | string | yes | |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### 3. `skills` (admin-managed master list)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `name` | string | yes | |
| `is_active` | boolean | yes | default true, controls form visibility |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

**Seeded values:** Erecting Framework, Concealed Grid, Setting, Decorative Cornice, Set Out, Fix Plasterboard, Exposed Grid, Cornice

#### 4. `employment_application_skills`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `employment_application_id` | FK → employment_applications | yes | cascade delete |
| `skill_id` | int, nullable | no | references skills.id (soft ref, no FK constraint). Null = custom skill |
| `skill_name` | string | yes | snapshot of skill name at time of application, or custom free text |
| `is_custom` | boolean | yes | false = from master list, true = applicant-entered |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### 5. `employment_application_employee` (junction — Phase 6)

Links applications to employee records post-hire. Many-to-many because:
- One application can result in employee profiles across multiple sister companies (SWCP, Greenline, SWC)
- One employee can have multiple applications over time (rehires, reapplications)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `employment_application_id` | FK → employment_applications | yes | cascade delete |
| `employee_id` | FK → employees | yes | cascade delete |
| `linked_at` | timestamp | yes | when the link was made |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

---

### Comments System (generic, polymorphic — reusable across all models)

Replaces the earlier `employment_application_notes` table with a full-featured comments system.

#### `comments`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `commentable_type` | string | yes | polymorphic (e.g. `App\Models\EmploymentApplication`) |
| `commentable_id` | bigint | yes | polymorphic. Composite index with `commentable_type` |
| `user_id` | FK → users | yes | who posted |
| `body` | text | yes | comment text |
| `parent_id` | FK → comments, nullable | no | for threaded replies. Null = top-level comment |
| `metadata` | JSON, nullable | no | flexible data — e.g. `{"status_change": "new → reviewing"}` for system events |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |
| `deleted_at` | timestamp, nullable | auto | soft delete |

#### `comment_attachments`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `comment_id` | FK → comments | yes | cascade delete |
| `file_path` | string | yes | S3 path |
| `file_name` | string | yes | original filename |
| `file_size` | int | yes | bytes |
| `mime_type` | string | yes | e.g. `image/jpeg`, `application/pdf` |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

---

### Checklist System (generic, polymorphic — reusable across all models)

#### `checklist_templates` (admin-managed blueprints)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `name` | string | yes | e.g. "Reference Check", "Phone Screen", "Site Induction" |
| `model_type` | string, nullable | no | limit to a model class, or null = usable anywhere |
| `auto_attach` | boolean | yes | default false. If true, automatically attached when a new record of `model_type` is created |
| `is_active` | boolean | yes | default true |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### `checklist_template_items` (steps within a template)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `checklist_template_id` | FK → checklist_templates | yes | cascade delete |
| `label` | string | yes | e.g. "Contact Reference #1" |
| `sort_order` | int | yes | display order |
| `is_required` | boolean | yes | default true |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### `checklists` (instance of a template attached to a record)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `checklist_template_id` | FK → checklist_templates, nullable | no | SET NULL on delete. Null = ad-hoc checklist |
| `checkable_type` | string | yes | polymorphic (e.g. `App\Models\EmploymentApplication`) |
| `checkable_id` | bigint | yes | polymorphic. Composite index with `checkable_type` |
| `name` | string | yes | copied from template, or "General" for ad-hoc |
| `sort_order` | int | yes | display order when multiple checklists on one record |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### `checklist_items` (individual items within an attached checklist)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `checklist_id` | FK → checklists | yes | cascade delete |
| `label` | string | yes | copied from template item, or user-entered |
| `sort_order` | int | yes | display order |
| `is_required` | boolean | yes | copied from template item, default true for ad-hoc |
| `completed_at` | timestamp, nullable | no | null = not done |
| `completed_by` | FK → users, nullable | no | who ticked it |
| `notes` | text, nullable | no | context when completing |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

---

## Status Flow

```
new → reviewing → phone_interview → reference_check → face_to_face → approved → contract_sent → contract_signed → onboarded
 ↕       ↕              ↕                  ↕               ↕            ↕            ↕               ↕
Users can move status forward or backward freely. Declined can happen from any stage. Reopened returns to previous stage.
```

| # | Status | Meaning |
|---|--------|---------|
| 1 | `new` | Submitted, unreviewed |
| 2 | `reviewing` | Someone is looking at it |
| 3 | `phone_interview` | Phone screen stage |
| 4 | `reference_check` | Contacting references |
| 5 | `face_to_face` | In-person interview stage |
| 6 | `approved` | Approved to hire |
| 7 | `contract_sent` | Contract sent |
| 8 | `contract_signed` | Contract returned |
| 9 | `onboarded` | Done, linked to employee |
| — | `declined` | Rejected (any stage) |

### Status Rules

- **Free movement** — users can move status forward or backward to any stage (no enforced linear progression)
- **Declined** is an exit from any stage — captured with `declined_at`, `declined_by`, `declined_reason`
- **Reopen** — a declined application can be reopened, which clears `declined_*` fields and restores the previous status (stored in the comments timeline via `metadata.status_change`)
- **Checklist gate** — status cannot be moved to `approved` unless all `is_required` checklist items across all attached checklists are completed. This is the only enforced gate.

---

## Duplicate Applicant Detection

- **Soft check, not a constraint** — `email` is NOT unique on `employment_applications`. Same person can apply multiple times legitimately.
- **Warm warning on submission** — when a new application is submitted, the backend checks for existing applications with the same email (or phone). If found, a warning banner is shown on the admin detail view: "This applicant has X previous application(s)" with links.
- **Admin list view** — duplicate indicator badge on rows where the email matches another application.

---

## Document Collection (Phase 5 — future)

Separate from the application form. After screening, the applicant receives a link (via SMS/email) to upload supporting documents.

- **Signed URL** — unique per application, expires after X days
- **Document types** — trade certificates, safety induction cards, licences, right-to-work, etc.
- **Storage** — S3 (existing infrastructure)
- **Schema** — separate `employment_application_documents` table (not part of the comments system — these are applicant-uploaded, not internal)

*Detailed schema to be designed when this phase begins.*

---

## Design Decisions

1. **Occupation as single string** — applicant selects one trade per application. `apprentice_year` (1–4) pairs with it for apprentices.

2. **Skills: master list + snapshot approach** — form checkboxes are driven by `skills` table (admin-managed). Selected skills are stored in `employment_application_skills` with the skill name copied as a snapshot. No FK constraint so master list changes don't affect historical applications. `skill_id` is a soft reference to allow re-rendering the form with correct checkboxes ticked.

3. **Custom skills** — the frontend displays a single free-text textarea for custom skills. On submit, the backend splits the text (comma or newline delimited) into individual `employment_application_skills` rows with `is_custom = true` and `skill_id = null`. When viewing/editing, custom skills render separately from checkbox skills.

4. **References normalized** — up to 4 employment references per application in a separate table with `sort_order` for display ordering.

5. **EWP licence as two booleans** — small fixed set, no need for a separate table.

6. **No JSON columns** — everything is fully queryable with standard SQL. Exception: `comments.metadata` uses JSON for flexible system event data (status changes, etc.) — not queried for filtering.

7. **Application ↔ Employee is many-to-many** — a worker can be hired into multiple sister companies (SWCP, Greenline, SWC) from a single application, and can reapply/get rehired over time. Junction table deferred to Phase 6.

8. **Status + Checklists are separate concerns** — status tracks pipeline position (single column), checklists track tasks within a stage (multiple items). Status is moved manually by the user; checklists are ticked off independently.

9. **Checklists are generic and polymorphic** — `HasChecklists` trait on any model. Admin manages templates via UI (no code changes for new checklist requirements). Templates are copied into live items when applied, so template edits don't affect existing checklists.

10. **Ad-hoc checklist items** — "General" checklist auto-created for one-off items. Same table, `checklist_template_id = null`.

11. **Comments system replaces notes** — generic polymorphic `comments` table with `HasComments` trait. Supports threaded replies (`parent_id`), file attachments (`comment_attachments`), and system events via `metadata` JSON (e.g. status changes). Soft-deletable. Reusable across any model.

12. **Declined can be reopened** — clearing `declined_*` fields restores the application to the pipeline. The reopen event is recorded in comments with `metadata.status_change`.

13. **Free status movement** — users can move status forward or backward without restriction. Only gate: `approved` requires all `is_required` checklist items to be completed.

14. **Auto-attach checklists** — templates with `auto_attach = true` and a `model_type` are automatically copied onto new records via the `HasChecklists` trait's `booted()` method.

15. **Checklist audit via `spatie/laravel-activitylog`** — already installed (`^4.10`). `ChecklistItem` uses the `LogsActivity` trait to automatically log who checked/unchecked items, when, and what changed (old → new values). No custom audit table needed.

16. **Duplicate detection is a warm warning, not a block** — email is not unique. Backend flags existing applications with the same email/phone on the admin detail view. Allows legitimate reapplications while surfacing potential duplicates.

17. **Document collection is applicant-facing, comments are internal** — documents uploaded by the applicant via a signed link go in a separate table. Photos/files uploaded by staff during discussions go in `comment_attachments`. Two different audiences, two different systems.

18. **Checklist templates are admin-only** — only users with admin role can create/edit/delete checklist templates. All users with `employment-applications.screen` can tick items and add ad-hoc items.

---

## Permissions

New categories in `RolesAndPermissionsSeeder`:

```php
'Employment Applications' => [
    'employment-applications.view'   => 'View employment applications',
    'employment-applications.screen' => 'Screen applications (change status, add comments, tick checklists)',
],

'Checklists' => [
    'checklists.manage-templates' => 'Create, edit, delete checklist templates (admin only)',
],
```

- `admin` gets all three permissions
- `backoffice` gets `employment-applications.view` + `employment-applications.screen`
- `manager` optionally gets `employment-applications.view` only

---

## Implementation Steps

### Phase 1: Database — Application Capture ✅
- [x] Migration: `create_employment_applications_table` (including `status`, `declined_*` columns)
- [x] Migration: `create_employment_application_references_table`
- [x] Migration: `create_skills_table`
- [x] Migration: `create_employment_application_skills_table`
- [x] Seeder: `SkillsSeeder` (8 initial skills)
- [x] Models: `EmploymentApplication`, `EmploymentApplicationReference`, `Skill`, `EmploymentApplicationSkill`

### Phase 2: Backend — Public Form + Admin API ✅
- [x] Form request validation (with duplicate email/phone warning)
- [x] Controller (store, show, index, updateStatus, reopen, decline)
- [x] Routes (public form submission + authenticated admin views)
- [x] Add permissions to seeder
- [x] Duplicate detection logic (query by email/phone, return warning with links)

### Phase 3: Frontend — Form + Admin Views ✅
- [x] Public application form (React + Inertia) — built, needs rename from `job-applications/` to `employment-applications/`
- [x] Wire form to backend (Inertia useForm POST, receive skills as props)
- [x] Admin list view with filtering (by status, occupation, date range) + duplicate badges
- [x] Admin detail view with status pipeline, comments, checklists, duplicate warning banner
- [ ] Skills management page (CRUD for master list) — deferred

### Phase 4: Comments System (generic) ✅
- [x] Migration: `create_comments_table` (polymorphic, soft deletes)
- [x] Migration: `create_comment_attachments_table`
- [x] Models: `Comment`, `CommentAttachment`
- [x] Trait: `HasComments` (polymorphic relationship + helpers)
- [x] Controller: `CommentController` (store, update, destroy, with attachment upload)
- [x] Frontend: comment thread UI with file upload, threaded replies
- [x] System comments: auto-post on status change with `metadata.status_change`

### Phase 5: Checklist System (generic) ✅
- [x] Migration: `create_checklist_templates_table`
- [x] Migration: `create_checklist_template_items_table`
- [x] Migration: `create_checklists_table` (polymorphic)
- [x] Migration: `create_checklist_items_table`
- [x] Models: `ChecklistTemplate`, `ChecklistTemplateItem`, `Checklist`, `ChecklistItem` (`LogsActivity` trait for audit)
- [x] Trait: `HasChecklists` (polymorphic relationship + helpers, auto-attach logic, required-items gate)
- [x] Seeder: default checklist templates for employment application stages
- [x] Admin UI: template management (CRUD templates + items) — admin only
- [x] Inline checklist UI on employment application detail view
- [x] Enforce gate: block `approved` status if required checklist items incomplete

### Phase 6: Application ↔ Employee Linking (future)
- [ ] Migration: `create_employment_application_employee_table`
- [ ] Add `belongsToMany` relationships on `EmploymentApplication` and `Employee` models
- [ ] Admin UI to link an application to employee record(s) when hired
- [ ] Transition status to `onboarded` when linked

### Phase 7: Document Collection (future)
- [ ] Design `employment_application_documents` schema
- [ ] Signed URL generation + expiry logic
- [ ] Public upload form (applicant-facing, no auth required)
- [ ] SMS/email delivery of upload link
- [ ] Admin view of uploaded documents on application detail
