# Job Applications Feature

## Overview
Recruitment form (based on superiorgroup.com.au/enquire-now/) to capture job applications from tradespeople. Public-facing form that stores applications for internal review, filtering, and reporting.

## Source
- Form reference: https://superiorgroup.com.au/enquire-now/

---

## Schema Design

### 4 Tables

#### 1. `job_applications`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| **Personal Details** |
| `surname` | string | yes | |
| `first_name` | string | yes | |
| `suburb` | string | yes | |
| `email` | string | yes | |
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
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

#### 2. `job_application_references` (up to 4 per application)

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `job_application_id` | FK → job_applications | yes | cascade delete |
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

#### 4. `job_application_skills`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| `id` | bigint PK | auto | |
| `job_application_id` | FK → job_applications | yes | cascade delete |
| `skill_id` | int, nullable | no | references skills.id (soft ref, no FK constraint). Null = custom skill |
| `skill_name` | string | yes | snapshot of skill name at time of application, or custom free text |
| `is_custom` | boolean | yes | false = from master list, true = applicant-entered |
| `created_at` | timestamp | auto | |
| `updated_at` | timestamp | auto | |

---

## Design Decisions

1. **Occupation as single string** — applicant selects one trade per application. `apprentice_year` (1–4) pairs with it for apprentices.

2. **Skills: master list + snapshot approach** — form checkboxes are driven by `skills` table (admin-managed). Selected skills are stored in `job_application_skills` with the skill name copied as a snapshot. No FK constraint so master list changes don't affect historical applications. `skill_id` is a soft reference to allow re-rendering the form with correct checkboxes ticked.

3. **Custom skills** — applicants can enter free-text skills (`is_custom = true`, `skill_id = null`). These render separately from checkbox skills when viewing/editing.

4. **References normalized** — up to 4 employment references per application in a separate table with `sort_order` for display ordering.

5. **EWP licence as two booleans** — small fixed set, no need for a separate table.

6. **No JSON columns** — everything is fully queryable with standard SQL.

---

## Implementation Steps

### Phase 1: Database
- [ ] Migration: `create_job_applications_table`
- [ ] Migration: `create_job_application_references_table`
- [ ] Migration: `create_skills_table`
- [ ] Migration: `create_job_application_skills_table`
- [ ] Seeder: `SkillsSeeder` (8 initial skills)
- [ ] Models: `JobApplication`, `JobApplicationReference`, `Skill`, `JobApplicationSkill`

### Phase 2: Backend
- [ ] Form request validation
- [ ] Controller (store, show, index)
- [ ] Routes (public form submission + authenticated admin views)

### Phase 3: Frontend
- [ ] Public application form (React + Inertia)
- [ ] Admin list view with filtering
- [ ] Admin detail view (re-rendered form)
- [ ] Skills management page (CRUD for master list)
