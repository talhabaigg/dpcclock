# Safety Dashboard — Implementation Plan

**Status:** Phase 3 Complete | **Last Updated:** 2026-03-17

---

## Phased Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Data layer — migration, model, Excel import | Done |
| **Phase 2** | Safety Dashboard page — Monthly Overview + WHS Performance tables | Done |
| **Phase 3** | LTIFR column in WHS Performance table (man hours + LTIFR calc) | Done |
| **Phase 4** | Claims tab — Claims Overview + Claims Summary tables | Planned |

---

## Context

The organisation tracks incidents/injuries in an Excel register (`Incident_Injury Register (MASTER 2025).xlsx`, 281 rows across 21 projects). There is no incident management system in the app — only a boolean `safety_concern` flag on clock-out. The WHS Monthly Report PDF (e.g. `02_SWCP WHS Report [Feb_2026].pdf`) contains 4 pages: Monthly Overview, Claims Overview + Claims Summary, Key Issues + Charts, and Apprentice/Training info. This plan reproduces pages 1-2 in the app.

This plan introduces:

- A database table + model for incident reports (including claims fields)
- An Excel import (first Import class in the codebase, using already-installed `maatwebsite/excel`)
- A dashboard page with aggregated tables under Reports

---

# Phase 1: Data Layer — DONE

## Step 1: Migration — `incident_reports` table

**File:** `database/migrations/2026_03_17_000001_create_incident_reports_table.php`

Columns mapped from Excel (Sheet: REGISTER, row 2 = headers, data from row 4):

| DB Column | Excel Col | Type | Notes |
|---|---|---|---|
| id | — | bigIncrements | PK |
| report_number | A (NO) | unsignedInteger, nullable | Used for upsert on re-import |
| incident_date | B (DATE) | date | Excel serial → Carbon |
| day_of_week | C (DAY) | string(20), nullable | |
| employee_name | D (NAME) | string | |
| company | E (COMPANY) | string, nullable | Greenline / Superior / SWCP |
| project_name | F (PROJECT) | string | Free text, grouped in dashboard |
| location_id | — | FK nullable | Resolved during import via fuzzy name match |
| position | G (POSITION) | string, nullable | |
| nature_of_injury | H resolved | string, nullable | Resolved label (e.g. "Sprain/Strain") |
| nature_of_injury_code | H raw | smallInt, nullable | Numeric code from Excel |
| body_location | I | string, nullable | "Hands & Fingers", "Back", etc. |
| mechanism_of_incident | J | string, nullable | |
| agency_of_injury | K | string, nullable | |
| incident_type | L | string(50) | "LTI", "MTI", "First Aid Only", "Report Only", "Near Miss", "Journey Claim" |
| workcover_claim | M | boolean, default false | YES → true |
| days_lost | N | smallInt, default 0 | |
| days_suitable_duties | O | smallInt, default 0 | |
| medical_expenses_non_workcover | — | decimal(10,2), default 0 | Not in Excel, manual/future |
| status | P | string(20), default 'Open' | |
| comments | Q | text, nullable | |
| claim_active | R | boolean, default false | YES → true; is this an active claim? |
| claim_type | S | string(30), nullable | "Statutory" / "Common Law" |
| claim_status | T | string(20), nullable | "Active" / "Denied" / "Closed" |
| capacity | U | string(30), nullable | "Full Duties" / "Suitable Duties" / "No Capacity" |
| employment_status | V | string(30), nullable | "Full Time" / "Part Time" / etc. |
| claim_cost | W | decimal(12,2), default 0 | Individual claim cost ($) |
| uploaded_by | — | FK nullable | Auth user who imported |
| timestamps | — | | |

## Step 2: Model — `IncidentReport`

**File:** `app/Models/IncidentReport.php`

- All columns in `$fillable`
- **Casts:** `incident_date` → date, `workcover_claim` → boolean, `claim_active` → boolean, `days_lost` → integer, `days_suitable_duties` → integer, `medical_expenses_non_workcover` → decimal:2, `claim_cost` → decimal:2
- **Relationships:** `location()` → belongsTo Location, `uploader()` → belongsTo User
- **Scopes:** `scopeForMonth($year, $month)`, `scopeForFinancialYear($fyStartYear)` (Jul 1 – Jun 30), `scopeOfType($type)`, `scopeWithClaims()` (where `workcover_claim = true`)
- **Modified file:** `app/Models/Location.php` — added `incidentReports()` hasMany relationship

## Step 3: Import Class

**File:** `app/Imports/IncidentReportImport.php`

- Implements `ToCollection`, `WithStartRow(4)`, `WithChunkReading(100)`
- Column H numeric codes resolved via hardcoded const array (31 injury classifications)
- Column B: Excel serial date → Carbon
- Columns M, R: `strtoupper(trim()) === 'YES'` → boolean
- **Upsert** via `updateOrCreate` keyed on `report_number`

### Location Matching (Implemented)

Excel project names (e.g. "DGC", "COAST") don't match DB location names (e.g. "DGC00 - Contract Works", "COA00 - Coast - Luxury"). Three-strategy fuzzy matching implemented:

1. **Exact match** — `strtolower(project_name)` matches `strtolower(locations.name)`
2. **Name contains** — `locations.name` contains the project name (e.g. "DGC" in "DGC00 - Contract Works")
3. **Display name match** — strips code prefix (e.g. "DGC00 - " → "Contract Works") and checks bidirectional containment

**SWC Exclusion:** The old SWC company locations (e.g. "Old-COA00") are excluded — only SWCP Employment and Greenline Jobs nodes are searched. This prevents false matches like "TVH" matching "TVH00" (SWC) instead of "TVH02" (SWCP).

**Result:** 228 of 281 records matched to locations. Unmatched records have project names that don't correspond to any current EH location.

---

# Phase 2: Safety Dashboard — DONE

## Step 4: Controller

**File:** `app/Http/Controllers/SafetyDashboardController.php`

### `index()` — renders Inertia page
- Props: `currentMonth`, `currentYear`, `lastImport` timestamp, `totalRecords` count

### `importPage()` — separate import page
- Renders `reports/safety-dashboard-import` with `lastImport` and `totalRecords`

### `getMonthlyData(Request $request)` — JSON API
- Validates `year` + `month` params
- Groups incidents by `project_name`, computes per-project aggregates
- Returns `{ rows, totals }`

### `getFYData(Request $request)` — JSON API
- Calculates current Australian FY (Jul 1 – Jun 30)
- Same aggregation as monthly but for full FY range
- Additionally computes man hours and LTIFR (see Phase 3)
- Returns `{ rows, totals, fy_label }`

### `import(Request $request)` — POST, file upload
- Validates file (xlsx/xls, max 10MB)
- Returns JSON `{ imported, skipped, errors, total_records, last_import }`

## Step 5: Routes

**File:** `routes/web.php`

```php
Route::middleware('permission:reports.safety-dashboard')->group(function () {
    Route::get('/reports/safety-dashboard', [SafetyDashboardController::class, 'index']);
    Route::get('/reports/safety-dashboard/import', [SafetyDashboardController::class, 'importPage']);
    Route::get('/reports/safety-dashboard/monthly-data', [SafetyDashboardController::class, 'getMonthlyData']);
    Route::get('/reports/safety-dashboard/fy-data', [SafetyDashboardController::class, 'getFYData']);
    Route::post('/reports/safety-dashboard/import', [SafetyDashboardController::class, 'import']);
});
```

## Step 6: Permissions

- Added `'reports.safety-dashboard'` permission to seeder
- Assigned to backoffice and manager roles

## Step 7: Sidebar Navigation

- Added `ShieldAlert` icon + "Safety Dashboard" sub-item to reports group in `app-sidebar.tsx`

## Step 8: Frontend Pages

**File:** `resources/js/pages/reports/safety-dashboard.tsx` — Main dashboard
**File:** `resources/js/pages/reports/safety-dashboard-import.tsx` — Separate import page

- Two-tab layout: Monthly Overview + WHS Performance (FY to Date)
- Monthly tab: month/year selectors + Load Data button
- WHS Performance tab: auto-loads current FY data on mount
- Import is a separate page (linked from header)

---

# Phase 3: LTIFR Column — DONE

## What
Added **LTIFR** (Lost Time Injury Frequency Rate) and **Man Hours** columns to the WHS Performance (FY to Date) table.

## Formula
```
LTIFR = (Number of LTIs / Number of Man Hours Worked) × 1,000,000
```

## Man Hours Calculation (Implemented)

Man hours are aggregated from the `clocks` table using EmployeeHub location hierarchy traversal:

1. **Location hierarchy:** Group → Company (SWC/SWCP/GRE) → Jobs → Project → Tasks
2. **Clock data is at task level** — must traverse descendants to aggregate at project level
3. **SWC excluded** — only SWCP Employment and Greenline company locations used
4. **Filters applied:**
   - `status = 'processed'` — only processed clocks counted
   - `eh_worktype_id` filtered to base-rate work types only:
     - `01-01` (Wages & Apprentices)
     - `03-01` (Foreman)
     - `05-01` (Leading Hands)
     - `07-01` (Labourers)
   - `clock_out IS NOT NULL`
   - `clock_in` within FY date range (Jul 1 – Jun 30)

### Multi-Project Aggregation

The `buildProjectNameToLocationMap()` method maps incident project names to one or more location IDs. For example, "DGC" maps to DGC00 + DGC01 + DGC02 (all sub-projects on same physical site). Man hours are summed across all matched locations per incident project.

### Key Methods
- `getManHoursByProject()` — builds parent→children map, recursively collects descendant eh_location_ids per project, queries clocks once, aggregates per project
- `buildProjectNameToLocationMap()` — maps incident `project_name` → `[location_id, ...]` using same fuzzy matching as import

---

# Phase 4: Claims Tab — PLANNED

## What
Add a third tab — **"Claims"** — to the Safety Dashboard with two tables. No additional migration needed — claims columns were included in Phase 1 migration. All claims data comes from the same Excel register (cols R-W).

### Page Layout Update

```
Tabs
├─ Tab 1: "Monthly Overview" (existing)
├─ Tab 2: "WHS Performance (FY to Date)" (existing)
└─ Tab 3: "Claims"
    ├─ Month/Year selectors + "Load Data" button
    ├─ Table 3: Claims Overview (aggregated by entity)
    └─ Table 4: Claims Summary (individual claim records)
```

### Table 3: Claims Overview

Aggregated by entity (company) for the selected month. Matches PDF page 2 "CLAIMS OVERVIEW" table.

| Column | DB Source | Aggregation |
|---|---|---|
| Entity | `company` | Group by (G/Line, SWCPE) |
| Total Claims Lodged | `workcover_claim = true` | Count per entity |
| Total Active Statutory Claims | `claim_type = 'Statutory'` AND `claim_active = true` | Count |
| Total Active Common Law Claims | `claim_type = 'Common Law'` AND `claim_active = true` | Count |
| Claims Denied | `claim_status = 'Denied'` | Count |
| Comments | `comments` | Comma-joined from matching records |

Grand total row at bottom.

### Table 4: Claims Summary

Individual claim-level detail — all records where `workcover_claim = true` for the selected month. Matches PDF page 2 "CLAIMS SUMMARY" table.

| Column | DB Source | Notes |
|---|---|---|
| Name | `employee_name` | |
| SWCPE | `company` | Checkbox: true if company = 'SWCPE' or 'Superior' |
| GL | `company` | Checkbox: true if company = 'Greenline' |
| DOI | `incident_date` | Formatted as dd/mm/yyyy |
| Active | `claim_active` | YES / NO |
| Project | `project_name` | |
| Injury | `body_location` + `nature_of_injury` | Combined: "Left Arm Strain" |
| Cause of Injury | `mechanism_of_incident` | |
| MTI | `incident_type` | Checkbox: true if type = 'MTI' |
| LTI | `incident_type` | Checkbox: true if type = 'LTI' |
| Capacity | `capacity` | "Full Duties" / "Suitable Duties" / "No Capacity" |
| Employment Status | `employment_status` | "Full Time" / "Part Time" |
| Claim Cost | `claim_cost` | Formatted as currency ($X,XXX.XX) |

Total row at bottom showing sum of `claim_cost`.

### Changes
- **Backend:** New `getClaimsData(Request $request)` endpoint on `SafetyDashboardController`
  - Filters `IncidentReport::forMonth($year, $month)->where('workcover_claim', true)`
  - Returns `{ overview: [...], summary: [...], totals: {...} }`
- **Route:** `GET /reports/safety-dashboard/claims-data`
- **Frontend:** Add third tab with month/year selectors, Claims Overview table, and Claims Summary table

### Phase 4 Verification
1. Upload Excel with claims columns (R-W populated) — confirm claims fields stored
2. Navigate to Claims tab, select a month — verify Claims Overview groups by entity correctly
3. Verify Claims Summary shows individual records with checkboxes for SWCPE/GL/MTI/LTI
4. Verify Claim Cost total matches expected sum (e.g. $160,496.55 from PDF)

---

## Files Summary (All Phases)

### New Files (6)
1. `database/migrations/2026_03_17_000001_create_incident_reports_table.php` — Phase 1
2. `app/Models/IncidentReport.php` — Phase 1
3. `app/Imports/IncidentReportImport.php` — Phase 1 (fuzzy location matching, SWC exclusion)
4. `app/Http/Controllers/SafetyDashboardController.php` — Phase 2+3 (hierarchy traversal, man hours, LTIFR)
5. `resources/js/pages/reports/safety-dashboard.tsx` — Phase 2+3
6. `resources/js/pages/reports/safety-dashboard-import.tsx` — Phase 2 (separate import page)

### Modified Files (4)
1. `routes/web.php` — routes (Phase 2, to be extended Phase 4)
2. `database/seeders/RolesAndPermissionsSeeder.php` — permission + role assignments (Phase 2)
3. `resources/js/components/app-sidebar.tsx` — `ShieldAlert` nav item (Phase 2)
4. `app/Models/Location.php` — `incidentReports()` relationship (Phase 1)
