# FEAT: Retention Report under Finance Group

## Problem Statement

The finance team currently has no dedicated view to track retention amounts held across active projects. Retention data is scattered across Premier's AR progress billing records, posted invoices, and in some cases lives entirely in legacy systems ("old world") with no digital record in the current platform. This makes it difficult to understand total retention exposure, forecast when retention will be released, and reconcile actual holdings against expected amounts.

## Solution

Build a **Retention Report** page under the Finance sidebar group that consolidates retention data into a single table. The report pulls contract values from JobSummary, customer names from AR invoices, and actual retention held from AR progress billing summaries — with support for manual overrides (audited via Spatie Activity Log) to account for legacy system data. It calculates expected retention at standard rates (5% / 2.5%) and projects two release dates based on estimated project completion.

## User Stories

1. As a finance manager, I want to see a list of all projects with retention held, so that I can understand our total retention exposure at a glance.
2. As a finance manager, I want to see the revised contract value for each project, so that I can verify retention calculations are based on current figures.
3. As a finance manager, I want to see the expected 5% retention value per project, so that I can compare expected vs actual retention held.
4. As a finance manager, I want to see the expected 2.5% retention value per project, so that I know the expected release amounts per tranche.
5. As a finance manager, I want to see the current cash holding retention (excl GST) sourced from AR progress billing, so that I know exactly how much retention is currently held per job.
6. As a finance manager, I want to manually adjust the retention held for jobs that exist in legacy systems (e.g. Anura, QTMP), so that the report reflects the true total including old-world data.
7. As a finance manager, I want manual adjustments to support negative values, so that I can correct for retention already released in legacy systems.
8. As a finance manager, I want a full audit trail (via Spatie Activity Log) of every manual retention adjustment, so that I can see who changed what and when.
9. As a finance manager, I want to see the 1st retention release date (estimated end date + 30 days), so that I can plan cash inflows.
10. As a finance manager, I want to see the 1st retention release amount (2.5% of contract value), so that I know how much to expect at first release.
11. As a finance manager, I want to see the 2nd retention release date (estimated end date + 12 months), so that I can plan longer-term cash inflows.
12. As a finance manager, I want to see the 2nd retention release amount (remaining 2.5%), so that I know the final retention recovery amount.
13. As a finance manager, I want jobs with no estimated end date to show "TBC" for release dates, so that missing data is flagged clearly rather than appearing as a bug.
14. As a finance manager, I want to filter the report by company, so that I can view retention for a specific entity.
15. As a finance manager, I want a totals row at the bottom of the report, so that I can see aggregate retention figures across all visible projects.
16. As a finance manager, I want to export the report to Excel, so that I can share it with stakeholders or perform further analysis in a spreadsheet.
17. As a finance manager, I want the report to only show jobs with non-zero retention (either from AR data or manual override), so that the report isn't cluttered with irrelevant jobs.
18. As an admin, I want the retention report gated behind a `reports.retention` permission, so that access can be controlled per user/role.
19. As an admin, I want manual retention edits gated behind a `reports.retention.edit` permission, so that only authorized users can adjust figures.

## Implementation Decisions

### Modules to Build/Modify

1. **Database Migration** — Add `manual_retention_held` column (decimal 10,2, nullable, default null) to the `job_retention_settings` table.

2. **JobRetentionSetting Model Update** — Add `manual_retention_held` to fillable and casts. Add Spatie `LogsActivity` trait with `logOnlyDirty()` and `logFillable()` configuration, following the existing pattern used by Requisition and other models.

3. **RetentionReportController (new)** — Single `index` method that:
   - Accepts optional `company` filter parameter
   - Queries JobSummary for `current_estimate_revenue` and `estimated_end_date`
   - Joins Location for job name
   - Pulls `contract_customer_name` from ArPostedInvoice (one per job)
   - Pulls `retainage_to_date` from ArProgressBillingSummary (latest per job)
   - Pulls `manual_retention_held` from JobRetentionSetting
   - Calculates: 5% retention, 2.5% retention, release dates (+30 days, +12 months), "TBC" for missing dates
   - Column 6 (Current Cash Holding) = `retainage_to_date` + `manual_retention_held` (additive)
   - Filters to only jobs with non-zero retention
   - Returns Inertia render with data, filters, and company list
   - Separate `updateManualRetention` method (POST) for saving manual overrides

4. **React Page (`reports/retention.tsx`)** — Table with 10 columns following the WIP report pattern:
   - Company filter dropdown
   - Inline editable `manual_retention_held` field (for users with `reports.retention.edit` permission)
   - Totals row summing columns 3-6, 8, 10
   - "TBC" display for missing estimated end dates
   - Excel export via ExcelJS (client-side, same pattern as WIP report)

5. **Permission Seeder Update** — Add to RolesAndPermissionsSeeder:
   - `reports.retention` — View retention report
   - `reports.retention.edit` — Edit manual retention values

6. **Sidebar Update** — Add "Retention Report" to Finance group in `app-sidebar.tsx`, positioned below WIP, gated by `reports.retention` permission.

7. **Routes** — Register in `web.php`:
   - `GET /retention-report` → `RetentionReportController@index` (middleware: `permission:reports.retention`)
   - `POST /retention-report/manual` → `RetentionReportController@updateManualRetention` (middleware: `permission:reports.retention.edit`)

### Data Source Mapping

| Column | Source |
|--------|--------|
| Job Name | `Location.name` via `JobSummary.location` relationship |
| Customer Name | `ArPostedInvoice.contract_customer_name` (any invoice for job) |
| Revised Contract Value | `JobSummary.current_estimate_revenue` |
| Retention 5% | Hardcoded: `current_estimate_revenue * 0.05` |
| Retention 2.5% | Hardcoded: `current_estimate_revenue * 0.025` |
| Current Cash Holding | `ArProgressBillingSummary.retainage_to_date` + `JobRetentionSetting.manual_retention_held` |
| 1st Release Date | `JobSummary.estimated_end_date + 30 days` (or "TBC") |
| 1st Release Amount | Same as Retention 2.5% |
| 2nd Release Date | `JobSummary.estimated_end_date + 12 months` (or "TBC") |
| 2nd Release Amount | Same as Retention 2.5% |

### Architectural Decisions

- **Manual override is additive, not a replacement** — `manual_retention_held` is added to `retainage_to_date`, not substituted. This handles partial old-world jobs (e.g. QTMP with ~$9k in legacy + remainder in Premier). Negative values are supported for corrections.
- **Retention rates are hardcoded at 5% / 2.5%** — Not pulled from `JobRetentionSetting.retention_cap_pct`. These columns represent standard expected retention, not actual per-job configured rates.
- **Client-side Excel export** — Using ExcelJS in the browser, consistent with the WIP report. No server-side export endpoint needed.
- **Route base is `/retention-report`** — Not nested under `/reports/`.
- **Spatie Activity Log on JobRetentionSetting** — Tracks exact field-level changes to `manual_retention_held` including who changed it and when.

## Testing Decisions

**What makes a good test:** Tests should verify external behavior (HTTP responses, data correctness, permission enforcement) — not implementation details like which query builder methods are called.

**Modules to test:**
- **RetentionReportController** — The core module with business logic:
  - Verify correct data assembly: contract values, retention calculations, release dates
  - Verify "TBC" handling when `estimated_end_date` is null
  - Verify Column 6 calculation: `retainage_to_date + manual_retention_held` (including negatives)
  - Verify filtering: only non-zero retention jobs appear
  - Verify company filter works correctly
  - Verify permission enforcement: unauthenticated and unauthorized users get 403
  - Verify manual retention update endpoint saves correctly and triggers activity log
  - Verify Spatie Activity Log records changes to `manual_retention_held`

**Prior art:** Follow the existing test patterns in the codebase (Laravel Feature tests with `actingAs`, factory-based test data, assertion on Inertia responses).

## Out of Scope

- Per-job configurable retention rates (columns 4/5 are hardcoded 5%/2.5%)
- Automatic sync of old-world (Anura/QTMP) retention data — these remain manual overrides
- Retention release tracking (marking retention as actually released vs. projected)
- GST calculations on retention amounts
- Chart/graph visualizations — this is a table-only report
- Integration with the existing Cash Forecast retention logic (separate feature)
- Notifications or alerts for upcoming retention release dates

## Further Notes

- The Anura project is entirely in the old world system and will need its full retention amount entered manually. QTMP has approximately $9k of retention in the old world, with the remainder tracked in Premier — the additive manual override handles this split cleanly.
- Spatie Activity Log is already installed (`spatie/laravel-activitylog ^4.10`) and used by 9+ models. The implementation should follow the existing `getActivitylogOptions()` pattern with `logOnlyDirty()` and `logFillable()`.
- The Finance sidebar group already contains Turnover Forecast, Cashflow Forecast, WIP, Manage Receipts, and Budget Management. Retention Report slots in after WIP.
