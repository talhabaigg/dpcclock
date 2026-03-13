# Cash Flow Forecast — Requirements

**Status:** Implemented | **Last Updated:** 2026-03-13

---

## Purpose

Answer one question: **"What will our bank balance look like over the next 12 months?"**

Translates accrual-basis figures from Premier into a cash-basis view by applying payment timing rules, manual adjustments, retention schedules, and GST obligations.

---

## Core Forecast

### Data Priority

| ID | Rule |
|---|---|
| BR-01.1 | Rolling window: 3 months history + current month + 11 months forward. |
| BR-01.2 | Past months use **actuals from Premier**. Current month and forward use **forecast data**. |
| BR-01.3 | Current month uses forecasts exclusively — never mixed with partial actuals. |
| BR-01.4 | When an actual and forecast exist for the same job + cost item + vendor + month, the actual wins and the forecast is dropped. |
| BR-01.5 | Only the most recent forecast submission per job is used. |
| BR-01.6 | Forecast lookback of 2 months ensures delayed cash flows (e.g. PAYG tax) propagate into the current month. |

### Payment Timing Rules

| ID | Category | When Cash Moves | GST |
|---|---|---|---|
| BR-02.1 | **Wages** (01, 03, 05, 07) | 70% same month (net pay), 30% next month (PAYG tax) | None |
| BR-02.2 | **Oncosts** (02, 04, 06, 08) | +1 month (super, payroll tax, workers comp, leave) | None |
| BR-02.3 | **Vendor & GL** (20–98, GL-*) | +1 month | 10% (actuals use invoice GST) |
| BR-02.4 | **Revenue** (99) | +1 month | 10% (actuals use invoice GST) |
| BR-02.5 | **Retention Held** | +1 month, shown as negative cash inflow | None |
| BR-02.6 | **General Transactions** | Same month (no delay) | Per-transaction config |
| BR-02.7 | **GST Payable** | Configured BAS payment month | N/A |
| BR-02.8 | **Unclassified** | Same month (no delay) | Actual GST only |

Wage split ratio (default 70/30) and GST rate (default 10%) are configurable.

### Forecast Calculation

| Line | Formula |
|---|---|
| Cash In | Revenue received + Retention released + General inflows |
| Cash Out | Wages + Oncosts + Vendor costs + GST payable + General outflows |
| Net Cashflow | Cash In - Cash Out (per month) |
| Running Balance | Starting Balance + cumulative Net Cashflow |

### Viewing

Users can drill down from monthly summary -> cost item -> job/vendor -> transaction detail (source month, timing rule, ex-GST, GST, total). Actual vs forecast indicators shown throughout.

---

## Payment Timing Adjustments

Override default timing for real-world situations (late client payments, early-pay discounts, staged payments).

| ID | Override Type | Scope |
|---|---|---|
| BR-03.1 | Revenue timing | Specific job + billing month. Can split across receipt months. |
| BR-03.2 | Cost payment (job-level) | Specific job + cost item + vendor. Can split across months. |
| BR-03.3 | Cost payment (vendor-level) | All jobs for a cost item + vendor + month. Distributed proportionally. |
| BR-03.4 | Vendor payment delay | All cost items from a vendor in a month. |

**Priority** (most specific wins): Job-level > Vendor-level cost > Vendor delay > Default rules.

Split amounts must equal the original source amount (ex-GST). Any adjustment can be reset to defaults.

---

## Retention

| ID | Rule |
|---|---|
| BR-05.1 | Retention = % of progress claim subtotal withheld by client as security. |
| BR-05.2 | Rate auto-calculated from Premier billing data. Fallback: configured default (5%). |
| BR-05.3 | Accumulates per job until cap reached (default: 5% of contract value). |
| BR-05.4 | Shown as negative cash inflow (reduces cash received from claims). |
| BR-05.5 | On the release date, all held retention flows back as positive cash inflow. |
| BR-05.6 | Users can override rate, cap, and release date per job, or reset to Premier values. |

---

## GST / BAS Liability

| ID | Rule |
|---|---|
| BR-06.1 | **Net GST = GST collected (revenue) - GST paid (vendor costs)** per quarter. Past months use actuals only — forecast figures excluded since invoices are finalized. Current month and forward use forecast data. |
| BR-06.2 | Net GST appears as cash outflow in the configured BAS payment month. |
| BR-06.3 | BAS payment months configurable per quarter (defaults: Q1->Apr, Q2->Aug, Q3->Nov, Q4->Feb). |
| BR-06.4 | Quarterly breakdown report with transaction-level detail (collected, paid, net). |
| BR-06.5 | Exportable to Excel (Collected, Paid, Summary sheets). |

---

## General Transactions

Non-project cash items not tracked in Premier (rent, insurance, subscriptions, loan repayments, etc.).

| ID | Rule |
|---|---|
| BR-07.1 | Attributes: Name, Amount, Direction (In/Out), Type (Recurring/One-off), Frequency (Weekly/Fortnightly/Monthly/Quarterly/Annually), Category, GST included flag, Start/End dates. |
| BR-07.2 | Recurring items auto-expanded into monthly amounts across the forecast window. |
| BR-07.3 | Categories: Rent & Lease, Utilities, Insurance, Software & IT, Professional Services, Marketing, Equipment, Travel, Training, Other. |
| BR-07.4 | Soft delete — removed from forecast but preserved for audit. |
| BR-07.5 | All fields are editable after creation (name, amount, direction, type, frequency, category, GST flag, dates). |

---

## Unclassified Cost Items

Users can review cost items without a cost type classification (no timing rule can be applied). Filterable by date range. Shows: month, job, cost item code, description, source, amount.

---

## Configuration

| Setting | Default |
|---|---|
| Starting cash balance + effective date | — |
| GST rate | 10% |
| Wage PAYG tax ratio | 30% |
| Retention rate & cap | 5% each |
| BAS payment months (per quarter) | Month after quarter end |

---

## Print / Export

Users can print the forecast (summary, charts, table) for offline review.

---

## Data Sources

| Source | Type | Data |
|---|---|---|
| Premier — Job Cost Details | Actuals | Wages, oncosts, vendor costs (job, cost item, amount, vendor, date) |
| Premier — AP Invoices | Actuals | GL overhead costs (account, amount, GST, vendor) |
| Premier — AR Invoices | Actuals | Revenue billed (job, subtotal, GST, retainage, date) |
| Premier — Progress Billing | Actuals | Retention data (contract value, retainage, subtotals) |
| Internal Job Forecasts | Forecasts | Projected costs/revenue by job, cost item, month |
| Cash Forecast Settings | Read-write | All configuration values |
| Cash Forecast Adjustments | Read-write | Manual timing overrides |
| General Transactions | Read-write | User-entered recurring/one-off items |
| Retention Overrides | Read-write | Per-job rate, cap, release date overrides |

---

## Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Full forecast computed server-side, delivered in a single page load. |
| NFR-02 | Must handle hundreds of jobs and thousands of cost lines without performance degradation. |
| NFR-03 | Soft-deleted general transactions preserved for audit. |
| NFR-04 | Adjustment saves are atomic — no partial changes on failure. |

---

## Security

| Permission | Grants |
|---|---|
| View | Read all data, drill down, GST breakdown, retention, print |
| Edit | View + modify settings, general transactions, adjustments, retention overrides |

Assigned to **admin** and **back-office** roles.

---

## Assumptions

| ID | Assumption |
|---|---|
| A-01 | Premier data is available and current. Stale if Premier is unreachable. |
| A-02 | Job forecasts maintained by project managers. Forecast quality depends on their submissions. |
| A-03 | Cost codes correctly classified with cost types. Unclassified items get no timing rule. |
| A-04 | Organisation uses quarterly BAS reporting (not monthly). |
| A-05 | All amounts in AUD. No multi-currency. |
| A-06 | Retention modelled on revenue side only (client withholds from us). Subcontractor retention not modelled. |

---

## Glossary

| Term | Definition |
|---|---|
| **Actuals** | Real financial data from Premier. |
| **Forecast** | Projected costs/revenue from internal Job Forecasts. |
| **Cash In / Cash Out** | Money received into / paid from the bank account. |
| **Timing Rule** | Delay between when a cost/revenue is incurred and when cash moves. |
| **PAYG Tax** | Tax withheld from wages, remitted to ATO monthly. |
| **BAS** | Business Activity Statement — quarterly GST return to the ATO. |
| **Retention** | % of progress claim withheld by client as security. |
| **Retention Cap** | Max cumulative retention as % of contract value. |
| **General Transaction** | Cash flow item not in Premier (rent, insurance, etc.). |
| **Ex-GST** | Amount excluding GST. |
| **Oncosts** | Employer costs on top of wages (super, payroll tax, workers comp, leave). |
| **Cost Code** | Two-part code (e.g. 42-01) identifying cost type within a project. |
| **Cost Type** | Classification determining which timing rule and GST treatment applies. |
| **Premier** | External ERP system, source of truth for actuals. |
