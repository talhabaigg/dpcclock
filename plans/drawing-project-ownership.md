# Drawing Ownership: Project vs Location vs ForecastProject

**Status:** deferred. Feature is far from ready. Re-open when forecast-project takeoff becomes a real requirement.

## The problem

Today: drawings and all takeoff data (conditions, bid_areas, labour_cost_codes, pay_rate_templates, measurements) are owned by `Location` via `location_id` FK. A Location is a won/active project.

Future requirement: takeoff and pricing need to happen **before** a Location exists — during the pipeline/bid phase — so an estimator can price a job. There's already a `ForecastProject` model (6 rows) representing pipeline items. But it's structurally disconnected from Location (no FK either way today); the only natural link is `forecast_projects.project_number` = `locations.external_id` (for SWCP sub-jobs specifically).

Extra constraint surfaced during review: **takeoff must also work on old Locations that never had a ForecastProject** (2170 of them), because those locations can still generate variations, and variations need takeoff. So we can't gate drawings on "came through the pipeline."

## The lifecycle (as stated by the user)

One continuous project moving through stages:

1. Discovered lead
2. Qualified
3. Initiating takeoff
4. Pricing the bid
5. Placing the bid
6. Job won
7. Project starts
8. Location created in EH + Job created in Premier
9. Location synced from EH creates the Location record in this app

Stages 1–5 are pre-bid (no Location yet). Stage 9 is when Location enters this app. Variations and budget tracking are post-bid (Location-only).

## Shape of the data

| Concept | Where it should live | Pre-bid available? | Post-bid available? |
|---|---|---|---|
| Drawings | Project | ✓ | ✓ |
| TakeoffConditions, BidAreas, LabourCostCodes, PayRateTemplates | Project | ✓ | ✓ |
| Measurements (scope='takeoff') | Drawing (→ Project) | ✓ | ✓ |
| Measurements (scope='variation') | Drawing (→ Project) | — | ✓ (Location-linked) |
| Budget **calculation** (measurements × LCC rates) | derived from Project | ✓ (estimator preview) | ✓ |
| BudgetHoursEntry (actual hours used) | Location | — | ✓ |
| MeasurementStatus / SegmentStatus (progress) | Location | — | ✓ |
| Variations (change orders) | Location | — | ✓ |

## Decided architecture (tentative)

**Option X — ForecastProject becomes "the project" entity.** One table, universal ownership. Rename recommended but not required.

- `drawings.project_id → forecast_projects.id` (FK, renamed field — or rename the table to `projects`)
- `takeoff_conditions.project_id`, `bid_areas.project_id`, `labour_cost_codes.project_id`, `location_pay_rate_templates.project_id` (all move from `location_id`)
- `locations.forecast_project_id` (nullable FK — populated at EH-sync time by matching `locations.external_id` = `forecast_projects.project_number`)
- Project exists alone during pipeline; Location links in post-bid
- For old Locations needing a variation takeoff: auto-create a ForecastProject/Project on first drawing upload

**Handoff at bid-won** is now trivial: create the Location row (EH does this); sync-time logic matches on job number and sets `locations.forecast_project_id`. **No data moves.**

## Why not polymorphic (Option Y)

- Every query in DrawingController becomes polymorphic-aware (20+ sites)
- URL routing splits into `/projects/{id}/drawings` + `/forecast-projects/{id}/drawings`
- Mobile sync protocol has to learn `owner_type`
- Contradicts the user's "it is same project" mental model — two owners for one concept
- Handoff becomes a multi-table UPDATE

## Why not new `projects` table (Option B from earlier discussion)

`ForecastProject` already has the right shape and fields (name, project_number, status, budgets). Introducing a new empty `projects` table just to be "cleaner" adds migration cost without functional benefit. Rename later if the name bothers us.

## Open branches (unresolved)

### 1. Link timing
When EH sync creates a Location with `external_id` matching an existing `ForecastProject.project_number`, do we:
- **Auto-link** (risk: typo = no link, estimator's work looks orphaned)
- **Suggest + manual claim** (extra step, estimator forgets)

Recommendation: auto-link on exact match, show a "claim" UI for fuzzy/near matches.

### 2. Auto-created Projects for old Locations
When an old Location (no ForecastProject) first uploads a drawing, we auto-create a ForecastProject/Project. What fills the estimator-facing fields (`name`, `project_number`, `total_cost_budget`, `total_revenue_budget`, `status`)?

- **Option 1 (recommended)**: auto-fill from Location (`name ← locations.name`, `project_number ← locations.external_id`, budgets zero, status="active-retrofit")
- **Option 2**: make those fields nullable + add a `source` discriminator
- **Option 3**: don't auto-create; keep `location_id` as fallback owner for drawings (breaks the single-ownership rule — rejected)

Recommendation: Option 1 — treat every Project identically; retrofit projects just have zero budgets.

### 3. Rename `forecast_projects` → `projects`
The table's role will be far broader than "forecast" once this ships. Rename is cosmetically correct but touches many files. Decision: ship with original table name; rename in a follow-up PR.

### 4. Master condition library (OST-style)
Out of scope for this refactor. The architecture doesn't preclude it — a future `condition_templates` / `master_conditions` table can be imported into Project-scoped `takeoff_conditions`. Note this for later.

## Migration surface (estimated when we do ship)

- 1 new column: `locations.forecast_project_id` (nullable FK)
- 5 column renames across tables: `location_id` → `project_id` on `drawings`, `takeoff_conditions`, `bid_areas`, `labour_cost_codes`, `location_pay_rate_templates`
- Backfill: 2 existing ForecastProjects are already linked via project_number; historical Locations don't get auto-created Projects (lazy, on first drawing upload)
- Controller work: update `DrawingController` + `Api/DrawingController` to use `project_id` instead of `$drawing->project->id` chain
- Route work: `/projects/{project}/drawings/...` where `{project}` resolves to ForecastProject/Project, not Location
- Mobile sync work: `Api/SyncController` must pull drawings for Project (through Location's link), and the WatermelonDB schema needs a Project table or equivalent

## When to revisit

- When there's a concrete requirement to do takeoff on a ForecastProject (pipeline)
- When an estimator workflow needs budget preview pre-bid
- When variations on old Locations start generating enough friction to justify the refactor

## Supporting facts (for future sanity-checking)

- Current table row counts (2026-04-18): `locations=2201`, `forecast_projects=6`, `drawings=29` (all test data after cleanup), `takeoff_conditions=16`, `bid_areas=0`, `labour_cost_codes=2`
- Drawing module just went through a cleanup (killed Textract, AI comparison, alignment; adopted Spatie MediaLibrary) — this RFC assumes that baseline
- FK match pattern: `locations.external_id` = `forecast_projects.project_number` (SWCP sub-jobs only — other company Locations may not have this pattern)
- 2 of 6 ForecastProjects currently have matching Locations (NDC00, PAL00); the other 4 are pre-win pipeline
