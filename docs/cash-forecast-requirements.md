# Cash Flow Forecast — Business Requirements

**Feature:** 12-Month Rolling Cash Flow Forecast
**Status:** Implemented
**Last Updated:** 2026-03-12

---

## 1. Business Need

Construction projects generate costs and revenue months before or after cash physically moves. Wages are paid weekly but PAYG tax remits monthly. Vendor invoices are paid on 30-day terms. Client progress claims are received 30–60 days after billing. Retention is withheld for months or years.

Without a cash-timing view, finance and management can only see **accrued** figures — what has been incurred or billed — not **when money actually enters or leaves the bank account**. This creates blind spots in liquidity planning and increases the risk of cash shortfalls.

**This feature exists to answer one question: "What will our bank balance look like over the next 12 months?"**

---

## 2. Stakeholders

| Stakeholder | Role | Interest |
|---|---|---|
| Finance Manager | Primary user | Manages cash position, plans payments, ensures liquidity |
| General Manager | Consumer | Reviews cash position for strategic decisions |
| Back-Office Staff | Contributor | Enters general transactions (rent, insurance), manages retention overrides |
| Project Managers | Indirect | Their job forecasts feed into the cash forecast — they do not directly use this feature |

---

## 3. Scope

### In Scope
- 12-month forward cash position forecast blending actuals and forecasts
- Payment timing rules that model when cash moves vs. when costs are incurred
- Manual adjustments to override default timing for specific jobs, vendors, or cost items
- General (non-project) recurring and one-off cash flow items
- Retention tracking and release scheduling
- Quarterly GST/BAS liability calculation
- Drill-down from summary to transaction-level detail
- Printable and exportable (GST) reports

### Out of Scope
- Modifying Premier data (read-only integration)
- Creating or editing job forecasts (separate feature)
- Bank account reconciliation
- Invoice generation or payment processing
- Multi-currency support

---

## 4. Business Rules

### BR-01: Data Priority

| ID | Rule |
|---|---|
| BR-01.1 | The forecast covers a rolling window: 3 months of history + the current month + 11 months forward. |
| BR-01.2 | Past months use **actual data from Premier**. The current month and all future months use **forecast data from internal Job Forecasts**. |
| BR-01.3 | The current month never mixes actuals and forecasts — it uses forecasts exclusively to avoid a confusing partial picture. |
| BR-01.4 | When both an actual and a forecast exist for the same job + cost item + vendor + month, the actual takes priority and the forecast is discarded. |
| BR-01.5 | Only the most recently submitted forecast per job is used. |
| BR-01.6 | Forecast data is loaded for 2 months prior to the current month as a lookback window, so that delayed cash flows (e.g. PAYG tax on last month's wages) propagate correctly into the current and future months. |

### BR-02: Payment Timing — When Cash Actually Moves

These rules translate accrual-basis figures into a cash-basis view. Each rule defines the delay between when a cost is incurred (or revenue billed) and when the corresponding cash movement occurs.

| ID | Category | Cash Timing Rule | GST Treatment |
|---|---|---|---|
| BR-02.1 | **Wages** (cost codes 01, 03, 05, 07) | 70% paid in the same month (net wages to employees). 30% paid in the following month (PAYG tax remittance to ATO). | No GST |
| BR-02.2 | **Labour Oncosts** (cost codes 02, 04, 06, 08) | Paid in the following month (super, payroll tax, workers comp, leave provisions). | No GST |
| BR-02.3 | **Vendor & GL Costs** (cost codes 20–98, GL items) | Paid in the following month (materials, subcontractors, hire, office overheads). | GST at configured rate (default 10%). For actuals, use the real GST amount from the invoice. |
| BR-02.4 | **Revenue** (cost code 99) | Received in the following month after billing. | GST collected at configured rate (default 10%). For actuals, use the real GST amount from the invoice. |
| BR-02.5 | **Retention Held** | Same delay as revenue (+1 month). Shown as a negative cash inflow — money that was billed but withheld by the client. | No GST |
| BR-02.6 | **General Transactions** | No delay — cash moves in the month the transaction falls in. | Configurable per transaction (user specifies whether GST is included). |
| BR-02.7 | **GST Payable (BAS)** | Paid in the configured BAS payment month for each quarter. | N/A (this is the GST settlement itself). |
| BR-02.8 | **Unclassified** | No delay applied. If the source invoice had GST, that amount is preserved as-is. | Actual GST only |

| ID | Configurability |
|---|---|
| BR-02.9 | The wage net/tax split ratio is configurable (default: 70% net / 30% tax). |
| BR-02.10 | The GST rate is configurable (default: 10%). |

### BR-03: Manual Adjustment Rules

Users can override default payment timing to reflect real-world situations (e.g. a client paying late, a vendor offering early-pay discounts, staged payments).

| ID | Rule |
|---|---|
| BR-03.1 | **Revenue timing override**: A user can specify when a specific job's billing for a given month is actually received. The full amount can be moved to a different month or split across multiple months. |
| BR-03.2 | **Cost payment override (job-level)**: A user can specify when a specific job + cost item + vendor payment is actually made. Supports splitting across months. |
| BR-03.3 | **Cost payment override (vendor-level)**: A user can apply a timing override to ALL jobs for a given cost item + vendor + month. The system distributes the override proportionally across jobs. |
| BR-03.4 | **Vendor payment delay**: A user can delay ALL cost items from a specific vendor in a given month. This is the broadest override. |
| BR-03.5 | **Split validation**: When a payment or receipt is split across months, the sum of all splits must equal the original source amount (ex-GST). The system must reject invalid splits. |
| BR-03.6 | **Reset**: Any adjustment can be reset to revert to the default timing rules. |

### BR-04: Adjustment Priority

When multiple overrides could apply to the same cash flow, the most specific one wins.

| Priority | Override Level | Scope |
|---|---|---|
| 1 (highest) | Job-level cash out adjustment | Specific job + cost item + vendor |
| 2 | Vendor-level cash out adjustment | All jobs for a cost item + vendor |
| 3 | Vendor payment delay | All cost items for a vendor |
| 4 (lowest) | Default timing rules | Applies when no overrides exist |

### BR-05: Retention

| ID | Rule |
|---|---|
| BR-05.1 | Retention is the portion of a progress claim withheld by the client as security. It is calculated as a percentage of the claim subtotal. |
| BR-05.2 | The retention rate is auto-calculated from Premier progress billing data (retainage / subtotal). If no Premier data exists, the configured default rate applies (default: 5%). |
| BR-05.3 | Retention accumulates per job. Once cumulative retention reaches the cap percentage of the contract value, no further retention is withheld on subsequent claims. Default cap: 5% of contract value. |
| BR-05.4 | Retention appears as a **negative cash inflow** — it reduces the cash received from a progress claim. |
| BR-05.5 | A user can set a **release date** per job. On the release date, all retention held up to that point flows back in as a positive cash inflow. |
| BR-05.6 | Users can override retention rate, cap percentage, and release date per job, or reset to auto-calculated values from Premier. |

### BR-06: GST / BAS Liability

| ID | Rule |
|---|---|
| BR-06.1 | Each calendar quarter, the system calculates: **Net GST = GST collected on revenue - GST paid on vendor costs**. |
| BR-06.2 | The net GST amount appears as a cash outflow in the configured BAS payment month for that quarter. |
| BR-06.3 | BAS payment months are configurable per quarter (defaults: Q1 Jan–Mar paid in April, Q2 Apr–Jun paid in August, Q3 Jul–Sep paid in November, Q4 Oct–Dec paid in February). |
| BR-06.4 | A quarterly GST breakdown report is available showing: GST collected (by transaction), GST paid (by transaction), and the net payable or refund. |
| BR-06.5 | The GST breakdown report is exportable to Excel. |

### BR-07: General Transactions

| ID | Rule |
|---|---|
| BR-07.1 | Users can record cash flow items that are not tracked in Premier — rent, insurance, subscriptions, expected income, loan repayments, etc. |
| BR-07.2 | A general transaction has: Name, Amount, Direction (Cash In or Cash Out), Type (Recurring or One-off), Frequency (Weekly / Fortnightly / Monthly / Quarterly / Annually), Category, whether GST is included, Start Date, and End Date (for recurring). |
| BR-07.3 | Recurring transactions are automatically expanded into monthly cash flow amounts across the forecast window based on their frequency. |
| BR-07.4 | Categories: Rent & Lease, Utilities, Insurance, Software & IT, Professional Services, Marketing, Equipment, Travel, Training, Other. |
| BR-07.5 | Deleted transactions are soft-deleted — they are removed from the forecast but preserved for audit. |

### BR-08: Forecast Calculation

| ID | Rule |
|---|---|
| BR-08.1 | **Cash In** = Revenue received (after timing rules) + Retention released + General transaction inflows. |
| BR-08.2 | **Cash Out** = Wages paid (after net/tax split) + Oncosts paid + Vendor costs paid + GST payable + General transaction outflows. |
| BR-08.3 | **Net Cashflow** = Cash In - Cash Out (per month). |
| BR-08.4 | **Running Balance** = Starting Balance + cumulative Net Cashflow through that month. |
| BR-08.5 | **Ending Balance** = Starting Balance + total Net Cashflow across all 12 months. |

---

## 5. Functional Requirements (User Capabilities)

### FR-01: View the Forecast

| ID | Requirement |
|---|---|
| FR-01.1 | A user can view a 12-month rolling cash forecast showing Cash In, Cash Out, Net Cashflow, and Running Balance by month. |
| FR-01.2 | A user can see summary totals: Starting Balance, Total Cash In, Total Cash Out, Net Cashflow, and Ending Balance. |
| FR-01.3 | A user can distinguish whether data for a given row/month is based on actuals, forecasts, or a mix. |
| FR-01.4 | A user can expand summary rows to see the underlying cost items, and further expand to see individual jobs or vendors. |
| FR-01.5 | A user can drill down into any dollar amount to see the transaction-level detail that produced it, including: source month, job, vendor, timing rule applied, ex-GST amount, GST, and total. |
| FR-01.6 | A user can identify which transactions had a timing delay applied (source month differs from display month). |

### FR-02: Adjust Payment Timing

| ID | Requirement |
|---|---|
| FR-02.1 | A user can override when revenue from a specific job and billing month is received, including splitting it across multiple receipt months. |
| FR-02.2 | A user can quickly set revenue timing to common scenarios: same month, +1, +2, or +3 months. |
| FR-02.3 | A user can override when a cost payment for a specific job + cost item + vendor is made, including splitting across months. |
| FR-02.4 | A user can apply a vendor-level payment delay to shift all of a vendor's costs in a given month. |
| FR-02.5 | A user can reset any adjustment to revert to default timing rules. |

### FR-03: Manage General Transactions

| ID | Requirement |
|---|---|
| FR-03.1 | A user can add a new general transaction (recurring or one-off) with all required attributes. |
| FR-03.2 | A user can edit an existing general transaction. |
| FR-03.3 | A user can delete a general transaction (soft delete). |

### FR-04: Manage Retention

| ID | Requirement |
|---|---|
| FR-04.1 | A user can view all jobs with retention: rate, cap, contract value, amount retained to date, and whether the cap has been reached. |
| FR-04.2 | A user can override the retention rate, cap percentage, or release date for a specific job. |
| FR-04.3 | A user can reset retention overrides to revert to auto-calculated values from Premier. |

### FR-05: View GST / BAS Liability

| ID | Requirement |
|---|---|
| FR-05.1 | A user can view a quarterly breakdown of GST collected, GST paid, and net payable/refund with the BAS due date. |
| FR-05.2 | A user can see transaction-level detail behind each quarterly GST figure, with Actual/Forecast indicators. |
| FR-05.3 | A user can export the GST breakdown to Excel (sheets: Collected, Paid, Summary). |

### FR-06: Configure Settings

| ID | Requirement |
|---|---|
| FR-06.1 | A user can set the starting cash balance and the date it applies from. |
| FR-06.2 | A user can configure the GST rate (default 10%). |
| FR-06.3 | A user can configure the wage PAYG tax ratio (default 30%). |
| FR-06.4 | A user can configure the default retention rate and cap (defaults 5% each). |
| FR-06.5 | A user can configure BAS payment months for each quarter. |

### FR-07: Review Unclassified Cost Items

| ID | Requirement |
|---|---|
| FR-07.1 | A user can view a list of cost items that do not have a cost type classification, meaning the system cannot apply the correct timing rule. |
| FR-07.2 | A user can filter unclassified items by date range. |
| FR-07.3 | Each unclassified item shows: month, job, cost item code, description, data source (Actual/Forecast), and amount. |

### FR-08: Print / Export

| ID | Requirement |
|---|---|
| FR-08.1 | A user can print the forecast for offline review or distribution. |
| FR-08.2 | The printed output includes the summary, charts, and forecast table in a format suitable for paper. |

---

## 6. Data Sources

| Source | Type | Data Provided |
|---|---|---|
| Premier — Job Cost Details | Read-only, actuals | All job costs: wages, oncosts, vendor costs. Fields: job number, cost item, amount, vendor, transaction date. |
| Premier — Accounts Payable Invoices | Read-only, actuals | GL overhead costs (non-job expenses). Fields: GL account, amount, GST, vendor. |
| Premier — Accounts Receivable Invoices | Read-only, actuals | Revenue billed. Fields: job number, subtotal ex-GST, GST, retainage, invoice date. |
| Premier — Progress Billing Summaries | Read-only, actuals | Retention data. Fields: contract value, retainage held, subtotals per job per progress claim. |
| Internal Job Forecasts | Read-only, forecasts | Projected costs and revenue by job, cost item, and month. |
| Cash Forecast Settings | Read-write | Starting balance, GST rate, wage tax ratio, retention defaults, BAS payment months. |
| Cash Forecast Adjustments | Read-write | Manual timing overrides for revenue, costs, and vendor delays. |
| General Transactions | Read-write | User-entered recurring/one-off cash flow items. |
| Retention Overrides | Read-write | Per-job overrides for retention rate, cap, and release date. |

---

## 7. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | The full forecast must be computed server-side and delivered in a single page load — no secondary loading for the initial view. |
| NFR-02 | The system must handle large datasets (hundreds of jobs, thousands of cost lines) without degraded performance. |
| NFR-03 | Deleted general transactions must be preserved for audit trail (soft delete). |
| NFR-04 | Saving adjustments must be atomic — if any part of the save fails, no partial changes are applied. |

---

## 8. Security & Permissions

| Permission | Grants |
|---|---|
| View | Access the forecast, view all data, drill down, view GST breakdown, view retention, print the report |
| Edit | All View capabilities plus: modify settings, add/edit/delete general transactions, create/reset adjustments, override retention |

Typically assigned to **admin** and **back-office** roles.

---

## 9. Assumptions & Dependencies

| ID | Assumption / Dependency |
|---|---|
| A-01 | Premier data is available and up-to-date. If Premier is unreachable, actuals will be stale. |
| A-02 | Job forecasts are maintained by project managers. The quality of the cash forecast depends directly on the quality and timeliness of job forecast submissions. |
| A-03 | Cost codes are correctly classified with a cost type. Unclassified cost codes will appear under "Unclassified" with no timing rule applied. |
| A-04 | The organisation uses quarterly BAS reporting (not monthly). |
| A-05 | All amounts are in AUD. Multi-currency is not supported. |
| A-06 | Retention is held on the revenue side only (client withholds from us). Retention we hold on subcontractors is not modelled. |

---

## 10. Glossary

| Term | Definition |
|---|---|
| **Actuals** | Real financial data from Premier (costs incurred, invoices issued). |
| **Forecast** | Projected future costs and revenue from internal Job Forecasts. |
| **Cash In** | Money received into the bank account (revenue collected, retention released, general inflows). |
| **Cash Out** | Money paid from the bank account (wages, vendor payments, GST remittance, general outflows). |
| **Timing Rule** | A business rule that determines the delay between when a cost/revenue is incurred and when cash moves. |
| **PAYG Tax** | Pay-As-You-Go tax withheld from employee wages and remitted to the ATO monthly. |
| **BAS** | Business Activity Statement — quarterly GST return submitted to the ATO. |
| **Retention** | A percentage of a progress claim withheld by the client as security until project completion or a release date. |
| **Retention Cap** | The maximum cumulative retention amount, expressed as a percentage of contract value. |
| **Progress Claim** | A periodic invoice to the client for work completed on a project. |
| **General Transaction** | A cash flow item not tied to a specific project or Premier data (e.g. rent, insurance). |
| **Ex-GST** | Amount excluding Goods and Services Tax. |
| **Oncosts** | Employer-borne costs on top of wages: superannuation, payroll tax, workers compensation, leave provisions. |
| **Cost Code** | A two-part code (e.g. 42-01) identifying the type of cost within a project. |
| **Cost Type** | A classification applied to a cost code that determines which timing rule and GST treatment to apply (Wages, Oncosts, Vendor, Revenue). |
| **Premier** | The external ERP system (Premier) that is the source of truth for actuals. |
