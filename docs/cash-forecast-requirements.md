# Cash Flow Forecast — Requirements Document

**Feature:** 12-Month Rolling Cash Flow Forecast
**Status:** Implemented
**Access:** Cash Forecast page in sidebar navigation
**Security:** View-only and Edit permission levels

---

## 1. Purpose

Provide a forward-looking 12-month cash position forecast that blends actual Premier data with internal job forecasts, applies configurable payment timing rules, and presents an interactive drill-down view with manual adjustment capabilities. The goal is to give finance and management visibility into **when cash actually moves** — not just when costs are incurred or revenue is billed.

---

## 2. Functional Requirements

### FR-01: Data Blending (Actuals + Forecasts)

| ID | Requirement |
|---|---|
| FR-01.1 | Load **actual** cost and revenue data from Premier for the **3 months preceding** the current month. |
| FR-01.2 | Load **forecast** data from the internal Job Forecasts for the current month through 12 months forward. |
| FR-01.3 | Load forecast data for 2 months prior to the current month as a lookback window, so delayed portions (e.g. wages tax, revenue) propagate correctly into the current/future months. |
| FR-01.4 | The current month must use **forecast data exclusively** — no partial actuals for the current month to avoid a confusing mix. |
| FR-01.5 | When both actuals and forecasts exist for a past month, **actuals take priority**. If an actual exists for a given job + cost item + vendor + month, the forecast for that same combination is dropped. |
| FR-01.6 | Always use the **latest forecast** per job (most recent forecast submission). |

### FR-02: Data Sources from Premier (Read-Only)

| ID | Source | Data Provided |
|---|---|---|
| FR-02.1 | Job Cost Details | All job costs: wages, oncosts, vendor costs — with job number, cost item, amount, vendor, and transaction date. |
| FR-02.2 | Accounts Payable Invoices | GL overhead costs (non-job expenses like office supplies, admin) — with GL account, amount, GST, and vendor. |
| FR-02.3 | Accounts Receivable Invoices | Revenue (client invoices billed) — with job number, subtotal ex-GST, GST, retainage, and invoice date. |
| FR-02.4 | Progress Billing Summaries | Retention data: contract value, retainage held, and subtotals per job per progress claim. |

### FR-03: Payment Timing Rules

The system applies configurable rules that determine **when cash actually moves** based on the type of cost or revenue.

| ID | Rule | What It Covers | When Cash Moves | GST |
|---|---|---|---|---|
| FR-03.1 | Wages | Base wages, apprentice wages, casual wages, subcontract labour | 70% paid same month (net wages), 30% paid next month (PAYG tax) | None |
| FR-03.2 | Oncosts | Superannuation, payroll tax, workers comp, leave provisions | Paid next month (+1) | None |
| FR-03.3 | Vendor / GL Costs | Materials, subcontractors, hire, office overheads (cost codes 20–98 and GL items) | Paid next month (+1) | +10% GST (or actual GST from the invoice if available) |
| FR-03.4 | Revenue | Client progress claims | Received next month (+1) | +10% GST collected (or actual GST from invoice) |
| FR-03.5 | Retention Held | Money withheld from progress claims as security | Same delay as revenue (+1 month), shown as negative under Cash In | None |
| FR-03.6 | General Transactions | Rent, insurance, subscriptions, other overheads | No delay — appears in the month it falls in | Configurable per transaction |
| FR-03.7 | GST Payable | Quarterly BAS payment to ATO | Paid in the configured quarter payment month | N/A |
| FR-03.8 | Default | Any unmatched cost item | No delay | No calculated GST (actual invoice GST preserved if available) |

| ID | Additional Detail |
|---|---|
| FR-03.9 | The wage net/tax split ratio is configurable (default 70% net / 30% tax). |
| FR-03.10 | The GST rate is configurable (default 10%). |
| FR-03.11 | For actual data from Premier, the real GST amount from the invoice is used instead of calculating a percentage. |

### FR-04: Manual Adjustments

#### FR-04a: Cash In Adjustments (Revenue Timing)

| ID | Requirement |
|---|---|
| FR-04a.1 | Users can override when revenue for a specific job and billing month is received. |
| FR-04a.2 | A single billing month's revenue can be split across multiple receipt months (e.g. $100K billed in Jan → $50K received Feb, $50K received Mar). |
| FR-04a.3 | The sum of all splits must equal the source billing amount (ex-GST). The system must validate this. |
| FR-04a.4 | Quick-action buttons for common scenarios: "Same Month", "+1 Month", "+2 Months", "+3 Months" — each sets the full amount to a single receipt month. |
| FR-04a.5 | Users can reset adjustments to revert to default timing rules. |

#### FR-04b: Cash Out Adjustments (Cost Payment Timing)

| ID | Requirement |
|---|---|
| FR-04b.1 | Users can override when a specific job + cost item + vendor payment is made. |
| FR-04b.2 | Payments can be split across multiple months with validation that splits sum to the source amount. |
| FR-04b.3 | Support vendor-level adjustments — when set for "ALL" jobs, the adjustment applies proportionally to all jobs under that vendor for the given cost item and month. |

#### FR-04c: Vendor Payment Delays

| ID | Requirement |
|---|---|
| FR-04c.1 | Users can override payment timing for **all** cost items from a specific vendor in a given month. |
| FR-04c.2 | This is a blanket override — broader than individual cost-item-level adjustments. |

#### FR-04d: Adjustment Priority (Highest to Lowest)

| ID | Requirement |
|---|---|
| FR-04d.1 | **Job-level** cash out adjustment (specific job + cost item + vendor) takes highest priority. |
| FR-04d.2 | **Vendor-level** cash out adjustment ("ALL" jobs for a cost item + vendor) applies if no job-level override exists. |
| FR-04d.3 | **Vendor payment delay** (all costs for a vendor across all cost items) is the broadest override. |
| FR-04d.4 | **Default timing rules** apply when no manual adjustments exist. |

### FR-05: General Transactions

| ID | Requirement |
|---|---|
| FR-05.1 | Users can add recurring or one-off cash flow items not tracked in Premier (rent, insurance, subscriptions, expected income, etc.). |
| FR-05.2 | Each transaction requires: Name, Amount, Type (Recurring / One-off), Direction (Cash In / Cash Out), Frequency (Weekly / Fortnightly / Monthly / Quarterly / Annually), Category, Includes GST flag, Start Date, and End Date (for recurring). |
| FR-05.3 | Recurring transactions are automatically expanded into monthly amounts across the forecast range based on their frequency. |
| FR-05.4 | Available categories: Rent & Lease, Utilities, Insurance, Software & IT, Professional Services, Marketing, Equipment, Travel, Training, Other. |
| FR-05.5 | Deleted general transactions are soft-deleted (preserved for audit trail). |
| FR-05.6 | General transactions appear in the forecast table grouped by their category. |

### FR-06: Retention System

| ID | Requirement |
|---|---|
| FR-06.1 | Automatically calculate retention rates from Premier progress billing data (retainage / subtotal ratio). |
| FR-06.2 | Track cumulative retention held per job. |
| FR-06.3 | Apply a retention cap — stop withholding once total retention reaches the cap percentage of the contract value. |
| FR-06.4 | Show retention as a negative line item under Cash In, representing money invoiced but not yet received. |
| FR-06.5 | Allow per-job manual overrides of retention rate, cap percentage, and release date. |
| FR-06.6 | When a release date is set, all retention held up to that date is released back as a cash inflow. |
| FR-06.7 | Users can reset overrides to revert to the auto-calculated values from Premier. |
| FR-06.8 | Default retention rate and cap are configurable in global settings (default 5% each). |

### FR-07: Quarterly GST Calculation

| ID | Requirement |
|---|---|
| FR-07.1 | Calculate net GST per calendar quarter: GST collected on revenue minus GST paid on vendor costs. |
| FR-07.2 | Show a GST Payable cash outflow in the configured BAS payment month for each quarter. |
| FR-07.3 | GST payment months are configurable per quarter (e.g. Q1 Jan–Mar → paid in April). |
| FR-07.4 | Provide a GST Breakdown report showing collected vs paid by quarter with transaction-level detail. |
| FR-07.5 | GST Breakdown report is exportable to Excel with three sheets: Collected, Paid, Summary. |

### FR-08: Configurable Settings

| ID | Setting | Default | Description |
|---|---|---|---|
| FR-08.1 | Starting Balance | $0 | Opening cash position for the forecast period |
| FR-08.2 | Starting Balance Date | Start of current month | The date the starting balance applies from |
| FR-08.3 | GST Rate | 10% | GST rate applied to vendor costs and revenue |
| FR-08.4 | Wage Tax Ratio | 30% | Portion of wages delayed by one month as PAYG tax |
| FR-08.5 | Default Retention Rate | 5% | Retention percentage when no Premier data exists |
| FR-08.6 | Default Retention Cap | 5% | Retention cap as a percentage of contract value |
| FR-08.7 | Q1 GST Payment Month | April | When Q1 (Jan–Mar) BAS is paid |
| FR-08.8 | Q2 GST Payment Month | August | When Q2 (Apr–Jun) BAS is paid |
| FR-08.9 | Q3 GST Payment Month | November | When Q3 (Jul–Sep) BAS is paid |
| FR-08.10 | Q4 GST Payment Month | February | When Q4 (Oct–Dec) BAS is paid |

---

## 3. Screen & UI Requirements

### UI-01: Summary Cards

| ID | Requirement |
|---|---|
| UI-01.1 | Display 5 summary cards across the top: Starting Balance, Total Cash In, Total Cash Out, Net Cashflow, Ending Balance. |
| UI-01.2 | Ending Balance = Starting Balance + Net Cashflow. |
| UI-01.3 | Each card shows a data source indicator (Actual / Forecast / Mixed). |

### UI-02: Charts

| ID | Requirement |
|---|---|
| UI-02.1 | **Monthly Cash Flow Bar Chart** — green bars for cash in, red/amber bars for cash out, one pair per month. |
| UI-02.2 | **Cumulative Cash Position Chart** — running total starting from the starting balance. Green when positive, red when negative. Shows the ending balance. |
| UI-02.3 | **Cash Waterfall Chart** — breaks down net cashflow by cost type (Revenue, Labour, Labour Oncosts, Materials, Site Costs, General, Equipment Hire, Professional, GST, Unmapped, Overhead). User can select the month range via dropdowns. |
| UI-02.4 | Waterfall chart includes a "View Unmapped" button linking to a page showing cost items missing a cost type classification. |
| UI-02.5 | All three charts have a fullscreen expand button. |
| UI-02.6 | Charts are responsive and resize correctly on different screen sizes. |

### UI-03: Main Forecast Table

| ID | Requirement |
|---|---|
| UI-03.1 | Horizontally-scrollable table with 12 month columns plus a Total column. |
| UI-03.2 | Expandable row hierarchy: **Section** (Cash In / Cash Out) → **Cost Item** → **Job** (for revenue) or **Vendor → Job** (for costs). |
| UI-03.3 | Click any section row to expand/collapse it. |
| UI-03.4 | Click any cost item row to see the jobs or vendors beneath it. |
| UI-03.5 | The **current month** column is visually highlighted with a "Current" label. |
| UI-03.6 | Each row shows a data source badge: blue = Actual, amber = Forecast, gradient = Mixed. |
| UI-03.7 | For vendor costs, actuals show the real vendor name; forecast data appears under "Remaining Forecast". |
| UI-03.8 | Bottom rows show **Net Cashflow** (Cash In minus Cash Out) and **Running Balance** (cumulative from starting balance). |
| UI-03.9 | Job and vendor rows display an "Adjust" link to open the timing adjustment dialog. |

### UI-04: Amount Breakdown (Drill-Down)

| ID | Requirement |
|---|---|
| UI-04.1 | Clicking any dollar amount in the table opens a breakdown showing how that number was calculated. |
| UI-04.2 | Shows line-by-line detail: Source Month, Job, Vendor, Rule Applied, Ex-GST, GST, Total, and data source. |
| UI-04.3 | Rows where the source month differs from the display month are highlighted (indicates a timing delay was applied). |
| UI-04.4 | Summary totals at top: Ex-GST, GST, and Gross Total. |
| UI-04.5 | Paginated at 50 rows for large datasets. |

### UI-05: Settings Dialog

| ID | Requirement |
|---|---|
| UI-05.1 | Accessible via gear icon in the header toolbar. |
| UI-05.2 | Allows editing of starting balance and GST payment months (one per quarter). |

### UI-06: General Transactions Dialog

| ID | Requirement |
|---|---|
| UI-06.1 | Accessible via "+" icon in the header toolbar. |
| UI-06.2 | Lists all existing general transactions with edit and delete actions. |
| UI-06.3 | Includes a form to add new transactions with all fields from FR-05.2. |

### UI-07: Cash In Adjustment Dialog

| ID | Requirement |
|---|---|
| UI-07.1 | Opened from "Adjust" link on a Cash In job row. |
| UI-07.2 | Shows the source job number and billing month. |
| UI-07.3 | Allows adding/removing receipt month splits with dollar amounts. |
| UI-07.4 | Validates that splits sum to the source amount. Shows a warning if exceeded. |
| UI-07.5 | Quick-action buttons: "Same Month", "+1 Month", "+2 Months", "+3 Months". |
| UI-07.6 | "Reset" action to clear all adjustments and revert to default timing. |

### UI-08: Cash Out Adjustment Dialog

| ID | Requirement |
|---|---|
| UI-08.1 | Opened from "Adjust" link on a Cash Out vendor/job row. |
| UI-08.2 | Shows the source cost item, vendor, and amount. |
| UI-08.3 | Allows splitting payments across multiple months with validation. |

### UI-09: Vendor Payment Delay Dialog

| ID | Requirement |
|---|---|
| UI-09.1 | Accessible from the header toolbar "Vendor Delays" button. |
| UI-09.2 | Dropdown listing all vendors with cost data. |
| UI-09.3 | Select a source month, then add payment month splits. |

### UI-10: Retention Dialog

| ID | Requirement |
|---|---|
| UI-10.1 | Accessible from the header toolbar "Retention" button. |
| UI-10.2 | Table showing all jobs with retention: rate %, cap %, contract value, retained to date, and cap status. |
| UI-10.3 | Edit action per job to override retention rate, cap, or set a release date. |
| UI-10.4 | "Reset to Auto" action to revert to Premier-calculated values. |

### UI-11: GST Breakdown Dialog

| ID | Requirement |
|---|---|
| UI-11.1 | Accessible from the header toolbar "GST Breakdown" button. |
| UI-11.2 | Quarterly tabs showing GST Collected, GST Paid, and Net Payable/Refund with due date. |
| UI-11.3 | Transaction-level detail with Actual/Forecast indicators. |
| UI-11.4 | Export to Excel button per quarter (3 sheets: Collected, Paid, Summary). |

### UI-12: Payment Rules Help

| ID | Requirement |
|---|---|
| UI-12.1 | Accessible via "?" help button in the header toolbar. |
| UI-12.2 | Displays all payment timing rules in a clear card layout with plain-English explanations. |

### UI-13: Print

| ID | Requirement |
|---|---|
| UI-13.1 | Print button in header generates a print-friendly version of the forecast. |
| UI-13.2 | Print version includes the charts. |
| UI-13.3 | Print layout is clean and suited for paper output (no interactive elements). |

### UI-14: Unmapped Transactions Page

| ID | Requirement |
|---|---|
| UI-14.1 | Separate page accessible from the waterfall chart's "View Unmapped" button. |
| UI-14.2 | Shows cost items that don't have a cost type classification, in a filterable table. |
| UI-14.3 | Date range filtering via start/end month selectors. |
| UI-14.4 | Columns: Month, Job, Cost Item, Description, Source (Actual/Forecast), Amount. |

---

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | All forecast data is computed on the server and delivered in a single page load — no secondary loading or spinners for the initial view. |
| NFR-02 | The page must perform well with large datasets (hundreds of jobs, thousands of cost lines). Key data lookups are indexed for speed. |
| NFR-03 | Deleted general transactions are preserved for audit trail (soft delete). |
| NFR-04 | All editing actions (adjustments, settings, general transactions) require the Edit permission. |
| NFR-05 | All viewing actions require the View permission. |
| NFR-06 | Saving adjustments is atomic — if any part of the save fails, no partial changes are applied. |
| NFR-07 | The Cash Forecast must appear in the sidebar navigation for users with the appropriate permission. |

---

## 5. Security & Permissions

| Permission | Grants |
|---|---|
| View | Access the forecast page, view all data, drill down into amounts, view GST breakdown, view retention, print the report |
| Edit | All View permissions plus: modify settings, add/edit/delete general transactions, create/reset adjustments, override retention settings |

Typically assigned to admin and back-office roles.

---

## 6. Cost Code Classification Reference

| Code Range | Category | GST Applies | Payment Delay | Example |
|---|---|---|---|---|
| 01, 03, 05, 07 | Wages | No | 70% same month / 30% next month | 01-01 Base Wages |
| 02, 04, 06, 08 | Oncosts | No | +1 month | 02-01 Superannuation |
| 20–98 | Vendor Costs | Yes (10%) | +1 month | 42-01 Materials |
| 99 | Revenue | Yes (10%) | +1 month | 99-99 Revenue |
| GL codes | Overheads | Yes (10%) | +1 month | GL-6100 Office Supplies |
| General | General Transactions | Configurable | None | Rent & Lease |
| GST Payable | BAS Payment | N/A | Quarterly | Auto-calculated |
| Retention Held | Retention | No | Same as revenue | Auto-calculated |

---

## 7. Waterfall Chart Cost Type Groups

The waterfall chart groups all costs and revenue into the following categories for a high-level view:

| Group | Description |
|---|---|
| Revenue | Client billing / progress claims |
| Labour | Wages (base, apprentice, casual, subcontract labour) |
| Labour Oncosts | Superannuation, payroll tax, workers comp, leave |
| Materials | Material purchases from vendors |
| Site Costs | Site-related vendor costs |
| General | Rent, insurance, subscriptions, and other overheads |
| Equipment Hire | Equipment and plant hire |
| Professional | Professional services (engineering, consultants, etc.) |
| GST | Quarterly GST payable to ATO |
| Unmapped | Cost items that haven't been classified yet |
| Overhead | GL overhead costs (non-job admin expenses) |
