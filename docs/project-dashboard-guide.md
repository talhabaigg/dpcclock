# Project Dashboard — User Guide

## What Is the Project Dashboard?

The Project Dashboard is a real-time, per-project reporting hub built directly into the Portal. It consolidates financial, labour, production, and commitment data from **Premier ERP**, **EmployeeHub**, and **uploaded production reports** into a single customizable view — eliminating the need for a separate Power BI dashboard or manual Excel reconciliation.

Navigate to it from **Locations → [Project Name] → Dashboard**.

---

## Problems It Solves (vs Power BI)

| Pain Point with Power BI | How the Project Dashboard Fixes It |
|---|---|
| **Resource-intensive refreshes** — Power BI had daily morning refreshes, but they required loading all tables across every project. This was slow and consumed significant server/gateway resources. | Data is refreshed on a **custom refresh cycle** that uses date filters to load only relevant data for the specific project and period — avoiding reloading data that has already been synced and making the process significantly more efficient. |
| **Fragile production data pipeline** — Power BI relied on a Power Automate flow to receive production CSVs via email, save them to a SharePoint folder, and trigger a full semantic model refresh. If the automation failed or the file had issues, there was no easy way to know — data simply wouldn't appear. Multiple reports in a single day meant multiple full model refreshes across all tables. | **Built-in CSV upload with instant validation** — drag-and-drop your DPC production export directly in the Portal. The system previews the data, flags any row-level errors immediately, and shows summary statistics before you confirm. No email chains, no SharePoint, no waiting for a model refresh. Multiple uploads per day have zero impact on other data. |
| **One layout for everyone** — Power BI dashboards are published as-is; individual users cannot rearrange widgets or hide irrelevant KPIs. | **Drag-and-drop grid layout** — every user can reposition, resize, show/hide any of the 14 widget cards. Layout is saved per-project. |
| **Per-user licence cost** — Power BI Pro licences cost $14–20/user/month per viewer. This adds up quickly for site-based staff like Foremen and Leading Hands who only need to glance at project KPIs — paying a full BI licence for occasional dashboard access is hard to justify. | No extra licence. Every Portal user with project access sees the dashboard at no additional cost, making it practical to give site supervisors and foremen direct visibility into project performance without a per-head BI spend. |


---

## How to Access and Use

1. Go to **Locations → [Project Name] → Dashboard**.
2. Use the **left/right arrows** or **calendar picker** in the toolbar to change the reporting month.
3. Use the **job selector** dropdown to switch between projects.
4. Click the **pencil icon** (top-right) to enter Edit Mode — drag widgets to reposition, resize by pulling the bottom-right handle, or toggle widgets on/off via the **Widgets** button.
5. Click the **pencil icon** again to save and exit Edit Mode.
6. Use the **reset button** to restore the default layout at any time.

---

## Production Data Upload

### Where

Navigate to **Locations → [Project Name] → Production Data** (sidebar link).

### How

1. Click **Upload Production Data**.
2. **Step 1 — Select File**: Drag-and-drop or browse for a DPC production CSV. Pick the **Report Date** (the month the data represents).
3. **Step 2 — Preview**: The system parses the CSV and shows:
   - Total rows parsed
   - Summary statistics (estimated hours, earned hours, used hours, % complete, variance)
   - Any error rows with reasons (e.g., missing required fields)
4. Click **Upload** to save. The file is stored on S3 and all rows are imported.
5. Return to the **Dashboard** to visualize the data.

### What the CSV Parser Expects

The parser reads specific columns from a standard DPC production export format:

| Field | Description |
|---|---|
| area | Work area / zone |
| code_description | Description of the cost code |
| cost_code | Cost code identifier |
| est_hours | Estimated (budgeted) hours |
| percent_complete | % complete of this line |
| earned_hours | Hours earned based on % complete |
| used_hours | Actual hours used |
| actual_variance | Difference between earned and used |
| remaining_hours | Hours remaining to complete |
| projected_hours | Projected total hours at completion |
| projected_variance | Projected variance at completion |

Subtotal and summary rows (empty area or description) are automatically skipped. Numeric values handle commas, percentage signs, and parenthetical negatives (e.g., `(1,234.56)` = `-1234.56`).

### Managing Uploads

- The **Production Data** page shows a history table of all uploads for the project.
- Each upload shows: filename, report date, row count, error count, uploader, upload date.
- Click **View** on any upload to inspect individual rows.
- Click **Delete** to remove an upload (soft-delete).

---

## Navigating Between Projects and Dates

### Date Navigation

The toolbar at the top of the dashboard has:
- **Left/Right arrow buttons** to move one month back/forward.
- A **calendar picker** to jump to any specific month.
- **Keyboard shortcuts**: Arrow Left / Arrow Right while focused on the toolbar.

When you change the date, all financial data (project income, labour budget, variations, commitments) is recalculated as-of that date.

### Job Selector

The **job selector dropdown** in the toolbar lets you quickly switch between projects without leaving the dashboard view. Your current date selection carries over.

### Production Upload Selector

When production uploads exist, a **dropdown** appears in the toolbar to select which upload's data to display in the Production tab and production-dependent widgets.

---

## Data Sources Summary

| Data | Source | Refresh Mechanism |
|---|---|---|
| Project Income (contract sums, claims) | Premier ERP | Live query on page load / date change |
| Labour Budget (cost items, hours, actuals) | Premier ERP (`job_report_by_cost_items_and_cost_types`) | Live query on page load / date change |
| Vendor Commitments (PO / SC) | Premier ERP | Live query on page load |
| Variations (approved, pending, rejected) | Portal database | Live query on page load |
| Employees on Site (headcount, trend) | EmployeeHub (clocks table) | Live query on page load |
| Industrial Action Hours | EmployeeHub (clocks table, worktype 2585103) | Live query on page load |
| Production Data (hours, variance, % complete) | CSV upload (DPC production export) | Manual upload, then selectable on dashboard |
| Payroll Hours by Worktype | EmployeeHub (clocks table) | Live query on page load |

---

## Key Differences at a Glance

| Feature | Power BI | Portal Project Dashboard |
|---|---|---|
| Data refresh | Daily bulk refresh of all tables (resource-intensive) | Custom refresh cycle with date filters — loads only new/changed data |
| Production data | Requires custom ETL pipeline | Built-in CSV upload with preview |
| Layout customisation | Fixed by report author | Per-user drag-and-drop grid |
| Cost | Per-user Pro licence ($14–20/mo) | Included with Portal access |
| Variance trending | Manual setup required | Automatic from upload history |
| Analysis mappings | Hard-coded or parameter-driven | User-configurable per project |
