# Cash Flow Forecast - Technical & User Documentation

## Overview

The Cash Flow Forecast screen provides a **12-month rolling cash forecast** starting from the current month. It blends **actual data** from Premier ERP (past months) with **forecast data** from the internal Job Forecasts system (current + future months), applies configurable **payment timing rules** to model when cash actually moves, and presents everything in an interactive table with charts, drill-downs, and manual adjustment capabilities.

**URL:** `/cash-forecast`
**Permissions:** `cash-forecast.view` (read-only), `cash-forecast.edit` (modify settings/adjustments)

---

## Data Sources

### 1. Actuals (Past Months) - Premier ERP

Three Premier ERP tables feed actual data for the **3 months preceding** the current month:

| Source Table | What It Provides | Key Fields |
|---|---|---|
| `job_cost_details` | **All job costs** - wages, oncosts, vendor costs | `job_number`, `cost_item`, `amount`, `vendor`, `transaction_date` |
| `ap_posted_invoice_lines` | **GL overhead costs** (distribution_type = 'G', non-job) | `gl_account`, `purchase_category`, `amount`, `tax2` (GST), `vendor` |
| `ar_posted_invoices` | **Revenue** (client invoices billed) | `job_number`, `subtotal` (ex-GST), `tax2` (GST), `retainage`, `invoice_date` |

**Important:** The current month uses **forecast data exclusively** to avoid confusing partial actuals + remaining forecast.

### 2. Forecasts (Current + Future Months)

| Source Table | What It Provides |
|---|---|
| `job_forecast_data` (via `job_forecasts`) | Monthly forecast amounts per job + cost item |

The system always uses the **latest forecast** per job (by `MAX(forecast_month)` from `job_forecasts`).

### 3. Deduplication Logic

For past months where both actuals and forecasts exist:
- **Actuals take priority** - if an actual exists for a `job+cost_item+vendor+month`, the forecast for that combination is dropped.
- This prevents double-counting while preserving forecast data for items without actuals (e.g., wages not in AP).

### 4. General Transactions

User-defined recurring or one-off costs/income stored in `cash_forecast_general_costs`. These are **not** from Premier ERP - they represent overheads like rent, insurance, subscriptions, etc.

### 5. Retention Data

Auto-inferred from `ar_progress_billing_summaries` in Premier ERP, with optional user overrides stored in `job_retention_settings`.

---

## Payment Timing Rules

The core of the forecast is the **applyRules()** engine that transforms raw cost/revenue data into cash-timed rows. Each rule determines **when** cash actually moves (delay) and **whether GST applies**.

### Rule 1: Wages (cost items 01-01, 03-01, 05-01, 07-01)

```
70% net wages  -> paid same month (delay = 0)
30% tax        -> paid next month (delay = +1)
GST: None
```

The 70/30 split is configurable via `wage_tax_ratio` in `cash_forecast_settings` (default 0.30 = 30% tax).

### Rule 2: Oncosts (cost item prefixes 02, 04, 06, 08)

```
100% -> paid next month (delay = +1)
GST: None
```

Super, payroll tax, workers comp, etc.

### Rule 3: Vendor Costs (cost item prefixes 20-98) and GL Costs (GL-*)

```
100% + 10% GST -> paid next month (delay = +1)
GST: 10% (configurable via gst_rate setting)
```

For **actuals**, the actual GST from the invoice (`tax2` field) is used instead of calculating 10%.

### Rule 4: Revenue (cost item 99-99)

```
100% + 10% GST -> received +1 month (delay = +1)
GST: 10% collected
```

For **actuals**, the actual GST from AR invoice (`tax2`) is used. Revenue delay is configurable via `revenue_delay_months`.

### Rule 5: Retention (RET-HELD)

```
Retention amount -> deducted same delay as revenue (+1 month)
GST: None (retention is a deduction from revenue, not a separate taxable event)
```

Shows as a negative line item under Cash In.

### Rule 6: General Transactions

```
No delay - appears in the month they fall in
GST: Applied if the transaction is marked as "includes GST"
```

### Rule 7: GST Payable (Quarterly)

```
Net GST (collected - paid) -> paid in the configured quarter payment month
```

The system calculates net GST per calendar quarter and creates a cash outflow in the configured payment month. Quarters and their payment months are configurable in Settings.

### Default Rule

Any cost item not matching the above rules: **no delay, no GST calculated** (but actual GST from invoices is preserved).

---

## Configurable Settings

Accessible via the **Settings** button (gear icon). Stored in `cash_forecast_settings` table.

| Setting | Default | Description |
|---|---|---|
| `starting_balance` | 0 | Opening cash position for the forecast |
| `starting_balance_date` | Start of current month | Date the starting balance applies from |
| `gst_rate` | 0.10 (10%) | GST rate applied to vendor costs and revenue |
| `wage_tax_ratio` | 0.30 (30%) | Portion of wages paid as tax (delayed +1 month) |
| `default_retention_rate` | 0.05 (5%) | Default retention percentage for jobs without ERP data |
| `default_retention_cap_pct` | 0.05 (5%) | Default retention cap as % of contract value |
| `gst_q1_pay_month` | 4 (April) | Month when Q1 (Jan-Mar) GST is paid |
| `gst_q2_pay_month` | 8 (August) | Month when Q2 (Apr-Jun) GST is paid |
| `gst_q3_pay_month` | 11 (November) | Month when Q3 (Jul-Sep) GST is paid |
| `gst_q4_pay_month` | 2 (February) | Month when Q4 (Oct-Dec) GST is paid |

---

## Screen Layout & Features

### Summary Cards (Top)

Five cards showing headline figures for the entire 12-month forecast:

1. **Starting Balance** - the configured opening cash position
2. **Total Cash In** - sum of all cash inflows (revenue + GST collected + general income)
3. **Total Cash Out** - sum of all cash outflows (wages + oncosts + vendors + GST + general costs)
4. **Net Cashflow** - total cash in minus total cash out
5. **Ending Balance** - starting balance + net cashflow (projected position at end of forecast)

### Charts (Middle Row)

Three charts in a 3-column grid:

#### Monthly Cash Flow Bar Chart
- Green bars = cash in per month
- Red bars = cash out per month
- Shows the monthly pattern of money coming in vs going out

#### Cumulative Cash Position Area Chart
- Shows running total of net cashflow over time, starting from the starting balance
- Displays the ending balance beneath the chart
- Green when positive, red when negative

#### Cash Waterfall Chart
- Breaks down net cashflow by **cost type** (REV, LAB, LOC, MAT, SIT, GEN, EQH, PRO, GST, UNM, OVH)
- Cost types come from the `cost_codes.cost_type` mapping
- Configurable start/end month range via dropdowns
- **"View Unmapped" button** - links to a page showing cost items that don't have a `cost_type` mapping (helps identify data quality issues)

All three charts have a **fullscreen button** (expand icon) that opens them in a large modal.

### Main Table (Bottom)

A horizontally-scrollable table showing 12 months plus a Total column.

#### Table Structure

```
Category        | Feb '26 | Mar '26 | ... | Jan '27 | Total
---------------------------------------------------------------
Cash In (expandable)
  99-99 Revenue
    Job 101-00
    Job 102-00
  RET-HELD Retention Held
    Job 101-00
Cash Out (expandable)
  01-01 Wages
    Job 101-00
  02-01 Oncosts
    Job 101-00
  42-01 Materials
    Vendor A (Actual)
      Job 101-00
    Remaining Forecast
      Job 102-00
  GST-PAYABLE GST Payable to ATO
  GENERAL-RENT Rent & Lease
Net Cashflow
Running Balance
```

**Key interactions:**
- Click **Cash In** or **Cash Out** rows to expand/collapse the section
- Click a **cost item** row to expand and see jobs (cash in) or vendors (cash out)
- Click **any amount cell** to open the **Amount Breakdown Modal** showing line-by-line detail of how that number was computed
- The **current month** column is highlighted with a "Current" label

#### Data Source Indicators

Each row shows colored badges indicating data source:
- **Blue dot + "Actual"** = data from Premier ERP invoices
- **Amber dot + "Forecast"** = data from internal forecasts
- **Gradient dot + "Mixed"** = combination of both

For cash out vendor costs, actual data shows real vendor names from invoices, while forecast data appears under a pseudo-vendor called **"Remaining Forecast"**.

---

## Adjustment System

Three types of manual adjustments let users override the default payment timing rules.

### Cash In Adjustments

**Purpose:** Override when revenue for a specific job + month is received.

**How to use:**
1. Expand Cash In > expand a cost item > find the job row
2. Click the **"Adjust"** link on the job row
3. Select the **Billing Month** (month the invoice was issued)
4. Add **splits** specifying which months the payment will actually be received and how much
5. The split total must equal the billed amount (ex-GST)
6. Click **Save Adjustments**

**Example:** Job 101-00 billed $100K in January. Default rule delays +1 month (all received in February). Adjust to split: $50K in February, $50K in March.

**Quick actions:**
- "Same Month" = receive full amount in the source month
- "+1 Month", "+2 Months", "+3 Months" = receive full amount with that delay

### Cash Out Adjustments

**Purpose:** Override when a specific cost item + vendor payment is made.

**How to use:**
1. Expand Cash Out > expand a cost item > find the vendor/job row
2. Click the **"Adjust"** link
3. Select the **Source Month** and see the source amount
4. Add splits specifying which months payments are actually made
5. Click **Save Adjustments**

Cash out adjustments work at the **vendor level** - when set for a vendor + cost item + month, they proportionally apply to all jobs under that vendor.

### Vendor Payment Delays

**Purpose:** Override payment timing for **all** costs from a specific vendor in a given month.

**How to use:**
1. Click the **"Vendor Delays"** button in the header toolbar
2. Select a vendor from the dropdown
3. Select a **Source Month**
4. Add splits specifying when payments will actually be made
5. Click **Save Delays**

This is a higher-level override than individual cash out adjustments - it applies across all cost items for that vendor.

### Adjustment Hierarchy

When multiple adjustments could apply:
1. **Job-level cash out adjustment** (specific job + cost item + vendor) takes priority
2. **Vendor-level cash out adjustment** (`ALL` jobs + cost item + vendor) applies if no job-level exists
3. **Vendor payment delay** (all costs for a vendor) is the broadest override
4. **Default timing rules** apply when no adjustments exist

---

## General Transactions

**Purpose:** Add recurring or one-off cash flow items not tracked in Premier ERP (overheads, rent, subscriptions, expected income, etc.)

**Access:** Click the **"General Transactions"** button (+ icon) in the header.

### Fields

| Field | Required | Description |
|---|---|---|
| Name | Yes | Description of the transaction (e.g., "Office Rent") |
| Amount | Yes | Dollar amount (per occurrence) |
| Type | Yes | `Recurring` or `One-off` |
| Cash Flow | Yes | `Cash In` or `Cash Out` |
| Frequency | For recurring | `Weekly`, `Fortnightly`, `Monthly`, `Quarterly`, `Annually` |
| Category | No | Categorization (Rent, Utilities, Insurance, Software, Professional Services, Marketing, Equipment, Travel, Training, Other) |
| Includes GST | Yes | Whether the entered amount includes GST (checked by default) |
| Start Date | Yes | When the transaction begins |
| End Date | For recurring | When the recurring transaction stops |

### Category Labels in Table

General transactions appear in the table under cost item codes like `GENERAL-RENT`, `GENERAL-INSURANCE`, etc., with human-readable labels.

---

## GST Breakdown Report

**Access:** Reports dropdown > **GST Breakdown**

Shows a quarterly breakdown of:
- **GST Collected** (from revenue invoices) - listed by job number
- **GST Paid** (on vendor costs) - listed by vendor and cost item
- **Net GST Payable/Refund** per quarter

Each quarter tab shows:
- Summary cards (Collected, Paid, Net Payable/Refund with due date)
- Transaction-level detail in scrollable tables
- Actual vs Forecast source badges on each transaction

**Export to Excel:** Each quarter can be exported to an XLSX file with three sheets:
1. GST Collected (Revenue)
2. GST Paid (Costs)
3. Summary

---

## Retention System

**Access:** Reports dropdown > **Retention**

### How Retention Works

Retention (retainage) is money withheld from progress claims as security. The system:

1. **Auto-infers retention rates** from Premier ERP `ar_progress_billing_summaries` - by looking at the ratio of `retainage` to `subtotal` across a job's invoices
2. **Tracks retention to date** - cumulative retention already held per job
3. **Calculates cap** - retention stops being withheld once it reaches `retention_cap_pct` % of the contract sum
4. **Generates RET-HELD rows** - negative amounts under Cash In representing money not received due to retention

### Retention Modal Features

- View all jobs with retention data in a table
- See rate %, cap %, contract value, retained to date, cap status
- **Edit** any job to override the auto-inferred rate, cap, or set a release date
- **Reset to Auto** - remove manual override and revert to ERP-inferred values
- **Release Date** - when set, retention held up to that date is released back as cash in

### Data Source

| Column | Source |
|---|---|
| `retention_rate` | Auto: calculated from `retainage / subtotal` in progress billing. Override: `job_retention_settings` table |
| `retention_cap_pct` | Auto: default from settings (5%). Override: `job_retention_settings` table |
| `contract_sum` | From `ar_progress_billing_summaries.contract_sum` |
| `retainage_to_date` | Sum of `retainage` from `ar_posted_invoices` |

---

## Amount Breakdown Modal (Drill-Down)

**Access:** Click any dollar amount in the main table.

Shows every individual row that contributes to that cell's amount, including:

| Column | Description |
|---|---|
| Source Month | The original month the cost/revenue was incurred (highlighted amber if different from display month) |
| Job | Job number |
| Vendor | Vendor name (or `-` for non-vendor items) |
| Rule Applied | The payment timing rule that caused this row to land in this month |
| Ex-GST | Amount excluding GST |
| GST | GST component |
| Total | Gross amount (ex-GST + GST) |
| Source | Actual or Forecast badge |

Summary cards at the top show Ex-GST Total, GST Total, and Gross Total.

Paginated at 50 rows per page for large datasets.

---

## Payment Rules Help Dialog

**Access:** Click the **?** (help) button in the header.

Displays a summary of all 6 payment timing rules in a clean card layout:
1. Wages: 70% paid same month, 30% tax paid +1 month
2. Oncosts: Paid +1 month (no GST)
3. Vendor Costs: Paid +1 month, 10% GST included
4. Revenue: Received +1 month, 10% GST collected
5. GST Payable: Net GST due quarterly, paid month after quarter end
6. General Transactions: Overheads, rent, subscriptions, and income items

---

## Unmapped Transactions Page

**URL:** `/cash-forecast/unmapped?start_month=YYYY-MM&end_month=YYYY-MM`
**Access:** "View Unmapped" button on the Waterfall Chart

Shows cost items that exist in job cost details or forecasts but **don't have a `cost_type` mapping** in the `cost_codes` table. These items are categorized as "UNM" (Unmapped) in the waterfall chart. This page helps administrators identify data quality issues and add missing cost type mappings.

---

## Technical Architecture

### Backend Flow

```
CashForecastController::__invoke()
  1. Load configurable rules (getForecastRules)
  2. Load cash-in/out adjustments
  3. Load settings (starting balance, GST months)
  4. Load cost code descriptions + cost type mappings
  5. Load ACTUALS from Premier (past 3 months)
     - JobCostDetail (wages + oncosts + vendor costs)
     - ApPostedInvoiceLine (GL overhead costs)
     - ArPostedInvoice (revenue + retention)
  6. Load FORECASTS (past 2 months for lookback + current + future 12 months)
     - Only latest forecast per job (MAX forecast_month)
  7. Deduplicate: actuals take priority over forecasts for past months
  8. Generate RETENTION rows (auto-inferred or overridden)
  9. Combine actuals + forecasts + retention
  10. Apply payment timing RULES (applyRules) -> transformed rows with delays + GST
  11. Add GENERAL COST rows
  12. Calculate QUARTERLY GST PAYABLE
  13. Build MONTH HIERARCHY for table display
  14. Build BREAKDOWN ROWS for drill-down
  15. Build RETENTION SUMMARY
  16. Return all data to Inertia page
```

### Frontend Architecture

```
show.tsx (main page)
  |-- hooks/
  |     |-- use-cash-forecast-data.ts  (derived calculations: totals, running balances, charts)
  |     |-- use-cash-adjustments.ts    (adjustment modal state + save/reset logic)
  |
  |-- components/
  |     |-- summary-cards.tsx          (5 summary cards + source indicators)
  |     |-- charts.tsx                 (bar chart, cumulative chart, waterfall)
  |     |-- cash-flow-table.tsx        (table rows: section, cost item, job, vendor, net, balance)
  |     |-- modals.tsx                 (settings, general costs, adjustments, GST, retention, breakdown)
  |     |-- payment-rules.tsx          (help dialog)
  |
  |-- types.ts                         (all TypeScript types)
  |-- utils.ts                         (formatting, labels, helpers)
```

### API Routes

| Method | URL | Permission | Purpose |
|---|---|---|---|
| GET | `/cash-forecast` | `cash-forecast.view` | Main page |
| GET | `/cash-forecast/unmapped` | `cash-forecast.view` | Unmapped transactions |
| POST | `/cash-forecast/settings` | `cash-forecast.edit` | Update settings |
| POST | `/cash-forecast/general-costs` | `cash-forecast.edit` | Add general cost |
| PUT | `/cash-forecast/general-costs/{id}` | `cash-forecast.edit` | Update general cost |
| DELETE | `/cash-forecast/general-costs/{id}` | `cash-forecast.edit` | Delete general cost |
| POST | `/cash-forecast/cash-in-adjustments` | `cash-forecast.edit` | Save cash-in splits |
| POST | `/cash-forecast/cash-out-adjustments` | `cash-forecast.edit` | Save cash-out splits |
| POST | `/cash-forecast/vendor-payment-delays` | `cash-forecast.edit` | Save vendor delays |
| POST | `/cash-forecast/retention-settings` | `cash-forecast.edit` | Override retention per job |
| DELETE | `/cash-forecast/retention-settings/{job}` | `cash-forecast.edit` | Reset retention to auto |

### Database Tables

| Table | Purpose |
|---|---|
| `cash_forecast_settings` | Singleton row with all configurable rates and settings |
| `cash_forecast_general_costs` | User-defined recurring/one-off cash transactions |
| `cash_in_adjustments` | Manual overrides for revenue receipt timing |
| `cash_out_adjustments` | Manual overrides for cost payment timing |
| `vendor_payment_delays` | Manual overrides for vendor-wide payment timing |
| `job_retention_settings` | Manual overrides for per-job retention rates |

### Premier ERP Tables (Read-Only)

| Table | Purpose |
|---|---|
| `job_cost_details` | All job cost transactions (wages, oncosts, vendor costs) |
| `ap_posted_invoice_lines` | Accounts payable invoice lines (GL overhead costs) |
| `ar_posted_invoices` | Accounts receivable invoices (revenue billed) |
| `ar_progress_billing_summaries` | Progress billing data (contract values, retention) |
| `job_forecast_data` / `job_forecasts` | Internal forecasts by job |
| `cost_codes` | Cost code descriptions and cost type mappings |

---

## Cost Code Classification

The system classifies cost items by their numeric prefix to determine which payment rule applies:

| Prefix | Category | GST | Delay | Example |
|---|---|---|---|---|
| 01, 03, 05, 07 | Wages | No | Split 70/30 | 01-01 Base Wages |
| 02, 04, 06, 08 | Oncosts | No | +1 month | 02-01 Superannuation |
| 20-98 | Vendor Costs | 10% | +1 month | 42-01 Materials |
| 99 | Revenue | 10% | +1 month | 99-99 Revenue |
| GL-* | GL Overhead | 10% | +1 month | GL-6100 Office Supplies |
| GENERAL-* | General Transactions | Configurable | None | GENERAL-RENT |
| GST-PAYABLE | GST Payable | N/A | Quarterly | Auto-calculated |
| RET-HELD | Retention | No | Same as revenue | Auto-calculated |
