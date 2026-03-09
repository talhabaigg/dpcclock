# Premier ERP Data Model Documentation

This document describes all database tables related to Premier ERP integration, their data structure, and recommended sync frequencies.

---

## Core Job Data

### `locations`
**Purpose**: Projects/jobs synced from Premier
**Update Frequency**: **Daily** (or on-demand when new jobs are created in Premier)

**Key Fields**:
- `id` - Internal primary key
- `external_id` - Premier job number (links to Premier)
- `name` - Job/project name
- `state` - Job location state
- `eh_location_id` - EmployeeHub location ID
- `watermelon_id` - Legacy Watermelon ID
- `closed_at` - Job closure timestamp
- `dashboard_settings` - JSON settings

**Relationships**:
- Links to `cost_codes` via `location_cost_codes` pivot
- Links to `variations` (change orders)
- Links to `job_summaries` via `external_id = job_number`
- Links to `job_vendor_commitments` via `external_id = job_number`

---

### `job_summaries`
**Purpose**: High-level job financial summary from Premier
**Update Frequency**: **Daily** (financial snapshots)

**Key Fields**:
- `job_number` - Premier job number (FK to locations.external_id)
- `company_code` - SWC/GREEN/SWCP
- `start_date` - Job start date
- `estimated_end_date` - Planned completion
- `actual_end_date` - Actual completion
- `status` - Job status
- `original_estimate_cost` - Initial budgeted cost
- `current_estimate_cost` - Current budgeted cost
- `original_estimate_revenue` - Initial budgeted revenue
- `current_estimate_revenue` - Current budgeted revenue
- `over_under_billing` - Billing variance

**Relationships**:
- `belongsTo` Location (via job_number → external_id)
- `hasMany` JobVendorCommitment

---

### `job_report_by_cost_items_and_cost_types`
**Purpose**: Cost breakdown by cost item from Premier job reports
**Update Frequency**: **Daily** (cost tracking)

**Key Fields**:
- `job_number` - Premier job number
- `cost_item` - Cost code (e.g., "42-01")
- `original_estimate` - Initial budget
- `current_estimate` - Current budget
- `estimate_at_completion` - Projected final cost
- `estimate_to_completion` - Remaining budget
- `project_manager` - PM name

**Relationships**:
- Links to `locations` via job_number

---

## Cost Codes & Pricing

### `cost_codes`
**Purpose**: Premier cost item catalog (e.g., "42-01 Plasterboard")
**Update Frequency**: **Weekly** (or when new cost codes added in Premier)

**Key Fields**:
- `id` - Internal primary key
- `code` - Cost code (e.g., "42-01")
- `description` - Cost code name (e.g., "Plasterboard")
- `cost_type_id` - FK to cost_types (LAB/MAT/etc.)
- `is_active` - Active status

**Future Enhancement**:
- `division_code` - Category code (e.g., "42")
- `division_name` - Category name (e.g., "42 - GYPSUM")

**Relationships**:
- `belongsTo` CostType
- Links to `locations` via `location_cost_codes` pivot

**Premier API Source**: `/api/Job/GetCostItems`

---

### `location_cost_codes` (pivot)
**Purpose**: Project-specific cost code pricing and oncost ratios
**Update Frequency**: **On Premier sync** (when cost codes change for a job)

**Key Fields**:
- `location_id` - FK to locations
- `cost_code_id` - FK to cost_codes
- `variation_ratio` - Oncost % for variations (e.g., 45.02)
- `dayworks_ratio` - Oncost % for dayworks
- `waste_ratio` - Waste % for materials
- `prelim_type` - 'LAB' or 'MAT' (determines which ratio to use)

**Business Logic**:
- LAB prelim: applies to labour cost codes (01-08)
- MAT prelim: applies to material cost codes (all others)
- Used by ChangeOrderGenerator for variation oncosts

**Data Integrity**:
- Unique constraint on `(location_id, cost_code_id)`
- Fixed in 2026-02-24: Changed from `attach()` to `sync()` to prevent duplicates

---

## Vendor Commitments & POs

### `job_vendor_commitments`
**Purpose**: Subcontracts and POs from Premier
**Update Frequency**: **Daily** (commitment tracking)

**Key Fields**:
- `job_number` - Premier job number
- `company` - Company code
- `vendor` - Vendor name
- `subcontract_no` - SC number (if subcontract)
- `po_no` - PO number (if purchase order)
- `approval_status` - Approval state
- `project_manager` - PM name
- `original_commitment` - Initial commitment amount
- `approved_changes` - Change order total
- `current_commitment` - Current commitment (original + changes)
- `total_billed` - Billed to date
- `os_commitment` - Outstanding commitment
- `invoiced_amount` - Invoiced amount
- `retainage_percent` - Retention %
- `retainage` - Retention amount
- `paid_amount` - Paid to date
- `ap_balance` - AP balance

**Computed Fields**:
- `type` - "SC" (subcontract) or "PO" (purchase order) based on subcontract_no presence

**Relationships**:
- `belongsTo` Location (via job_number → external_id)
- `belongsTo` JobSummary (via job_number)

---

### `premier_po_headers`
**Purpose**: Cached Premier PO header data (for requisition linking)
**Update Frequency**: **On-demand** (60-minute cache, when PO details requested)

**Key Fields**:
- `premier_po_id` - Premier PO GUID
- `requisition_id` - FK to internal requisitions (if linked)
- `po_number` - PO number
- `vendor_id` - Vendor ID
- `vendor_code` - Vendor code
- `vendor_name` - Vendor name
- `job_id` - Premier job GUID
- `job_number` - Job number
- `po_date` - PO date
- `required_date` - Required by date
- `total_amount` - PO total
- `invoiced_amount` - Invoiced to date
- `status` - PO status
- `approval_status` - Approval state
- `description` - PO description
- `raw_data` - JSON blob (full Premier response)
- `synced_at` - Last sync timestamp

**Computed Fields**:
- `remaining_amount` - total_amount - invoiced_amount

**Relationships**:
- `belongsTo` Requisition
- `hasMany` PremierPoLine

**Cache Logic**:
- `isStale()` - Returns true if synced_at > 60 minutes ago
- `getOrphaned()` - Returns PO headers without linked requisitions

**Premier API Source**: `/api/PO/GetPurchaseOrder`

---

### `premier_po_lines`
**Purpose**: Cached Premier PO line items
**Update Frequency**: **Same as premier_po_headers** (60-minute cache)

**Key Fields**:
- `premier_po_id` - Premier PO GUID (FK to premier_po_headers)
- `line_number` - Line sequence
- `cost_code` - Cost code
- `description` - Line description
- `quantity` - Ordered quantity
- `uom` - Unit of measure
- `unit_price` - Price per unit
- `line_total` - Extended total
- `received_quantity` - Received to date
- `invoiced_quantity` - Invoiced to date
- `raw_data` - JSON blob

**Relationships**:
- `belongsTo` PremierPoHeader (via premier_po_id)

**Premier API Source**: `/api/PO/GetPurchaseOrder` (lines array)

---

## Accounts Payable

### `ap_posted_invoices`
**Purpose**: Posted AP invoices from Premier
**Update Frequency**: **Daily** (invoice tracking)

**Key Fields**:
- `client_id` - Client ID
- `company` - Company code
- `vendor_code` - Vendor code
- `vendor` - Vendor name
- `invoice_number` - Invoice number
- `unique_id` - Premier unique ID
- `job_number` - Job number
- `po_number` - PO number
- `sub_number` - Subcontract number
- `invoice_date` - Invoice date
- `due_date` - Payment due date
- `received_date` - Date received
- `transaction_date` - Transaction date
- `subtotal` - Subtotal amount
- `tax1`, `tax2` - Tax amounts
- `freight` - Freight charges
- `discount` - Discount amount
- `retainage` - Retention amount
- `invoice_total` - Total invoice amount
- `purchase_category` - Category
- `invoice_status` - Status
- `hold_code` - Hold code
- `hold_date` - Date placed on hold
- `release_date` - Date released from hold
- `approval_date` - Approval date
- `approval_status` - Approval state
- `notes`, `memo` - Text notes
- `key`, `batch` - Premier batch info

**Relationships**:
- `hasMany` ApPostedInvoiceLine (via unique_id)

**Premier API Source**: `/api/AP/GetPostedInvoices`

---

### `ap_posted_invoice_lines`
**Purpose**: Line items for AP invoices
**Update Frequency**: **Same as ap_posted_invoices** (daily)

**Key Fields**:
- `invoice_unique_id` - FK to ap_posted_invoices.unique_id
- `line_number` - Line sequence
- `cost_code` - Cost code
- `description` - Line description
- `quantity` - Quantity
- `uom` - Unit of measure
- `unit_price` - Price per unit
- `line_total` - Extended total

**Relationships**:
- `belongsTo` ApPostedInvoice (via invoice_unique_id → unique_id)

---

## Accounts Receivable

### `ar_progress_billing_summaries`
**Purpose**: Progress billing/payment application summaries from Premier
**Update Frequency**: **Weekly** (billing cycle tracking)

**Key Fields**:
- `client_id` - Client ID
- `company_code` - Company code
- `job_number` - Job number
- `progress_billing_report_number` - Report number
- `application_number` - Payment app number
- `description` - Description
- `from_date` - Period start
- `period_end_date` - Period end
- `status_name` - Status
- `this_app_work_completed` - Work completed this period
- `materials_stored` - Materials stored this period
- `total_completed_and_stored_to_date` - Cumulative to date
- `percentage` - % complete
- `balance_to_finish` - Remaining work
- `this_app_retainage` - Retention this period
- `application_retainage_released` - Retention released
- `original_contract_sum` - Original contract
- `authorized_changes_to_date` - Approved changes
- `contract_sum_to_date` - Current contract total
- `retainage_to_date` - Cumulative retention
- `total_earned_less_retainage` - Earned less retention
- `less_previous_applications` - Previous payments
- `amount_payable_this_application` - Net payable
- `balance_to_finish_including_retainage` - Remaining + retention
- `previous_materials_stored` - Prior stored materials
- `invoice_number` - Invoice number
- `active` - Active flag
- `insert_user`, `insert_date` - Created by/when
- `update_user`, `update_date` - Updated by/when

**Premier API Source**: `/api/AR/GetProgressBillingSummaries`

---

### `ar_posted_invoices`
**Purpose**: Posted AR invoices from Premier
**Update Frequency**: **Daily** (invoice tracking)

**Key Fields**:
- `client_id` - Client ID
- `company_code` - Company code
- `job_number` - Job number
- `invoice_number` - Invoice number
- `unique_id` - Premier unique ID
- `invoice_date` - Invoice date
- `due_date` - Due date
- `customer_code` - Customer code
- `customer_name` - Customer name
- `description` - Description
- `subtotal` - Subtotal
- `tax` - Tax amount
- `invoice_total` - Total amount
- `paid_amount` - Paid to date
- `balance` - Outstanding balance
- `status` - Invoice status

**Premier API Source**: `/api/AR/GetPostedInvoices`

---

## Change Orders (Variations)

### `variations`
**Purpose**: Change orders that sync to/from Premier
**Update Frequency**: **On-demand** (when created/exported to Premier)

**Key Fields**:
- `id` - Internal primary key
- `location_id` - FK to locations
- `drawing_id` - FK to drawings (optional)
- `co_number` - Change order number
- `premier_co_id` - Premier CO GUID (when synced)
- `type` - 'variation', 'dayworks', etc.
- `description` - CO description
- `status` - 'draft', 'pending', 'approved', 'exported'
- `co_date` - CO date
- `markup_percentage` - Client markup %
- `client_notes` - Notes for client
- `created_by`, `updated_by`, `deleted_by` - Audit fields

**Relationships**:
- `belongsTo` Location
- `belongsTo` Drawing
- `hasMany` VariationLineItem
- `hasMany` VariationPricingItem
- `hasMany` DrawingMeasurement

**Export Format**: QTMP change order file for Premier import

---

### `variation_line_items`
**Purpose**: Line items for change orders (exported to Premier)
**Update Frequency**: **Same as variations** (on CO create/update)

**Key Fields**:
- `variation_id` - FK to variations
- `drawing_measurement_id` - FK to drawing_measurements (optional)
- `takeoff_condition_id` - FK to takeoff_conditions (optional)
- `cost_code_id` - FK to cost_codes
- `line_type` - 'labour', 'material', 'prelim', 'revenue'
- `description` - Line description
- `quantity` - Quantity
- `unit` - Unit of measure
- `unit_rate` - Rate per unit
- `line_amount` - Extended amount
- `sort_order` - Display order

**Business Logic**:
- Generated by ChangeOrderGenerator service
- LAB prelims use variation_ratio from location_cost_codes
- MAT prelims use variation_ratio from location_cost_codes
- Revenue line uses 99-99 cost code with total sell price

**Relationships**:
- `belongsTo` Variation
- `belongsTo` DrawingMeasurement
- `belongsTo` TakeoffCondition
- `belongsTo` CostCode

---

### `variation_pricing_items`
**Purpose**: Pricing breakdown items shown to client (3-tab workflow)
**Update Frequency**: **On variation create/edit** (user-managed)

**Key Fields**:
- `variation_id` - FK to variations
- `item_type` - 'condition', 'custom', 'note'
- `description` - Item description
- `quantity` - Quantity
- `unit` - Unit (m2, lm, ea, etc.)
- `unit_rate` - Rate per unit
- `total_cost` - Extended cost
- `sort_order` - Display order
- `takeoff_condition_id` - FK to takeoff_conditions (if condition-based)

**Relationships**:
- `belongsTo` Variation
- `belongsTo` TakeoffCondition

**Usage**:
- Pricing tab: Build up pricing items (conditions + custom lines)
- Client tab: Format for client presentation
- Premier tab: Generate full CO with oncosts via Quick Gen

---

## Forecast Data

### `forecast_projects`
**Purpose**: Forecast project metadata (links to Premier jobs)
**Update Frequency**: **Monthly** (forecast planning cycles)

**Key Fields**:
- `id` - Internal primary key
- `name` - Forecast project name
- `job_number` - Premier job number (optional)
- `location_id` - FK to locations (optional)
- `start_date` - Project start
- `end_date` - Project end
- `status` - 'active', 'planned', 'completed'

**Relationships**:
- `belongsTo` Location
- `hasMany` ForecastProjectCostItem
- `hasMany` ForecastProjectRevenueItem
- `hasMany` JobForecastData

---

### `forecast_project_cost_items`
**Purpose**: Forecast cost items by month
**Update Frequency**: **Monthly** (forecast updates)

**Key Fields**:
- `forecast_project_id` - FK to forecast_projects
- `cost_code` - Cost code
- `month` - Forecast month (YYYY-MM-DD)
- `forecast_amount` - Forecasted cost

**Relationships**:
- `belongsTo` ForecastProject

---

### `forecast_project_revenue_items`
**Purpose**: Forecast revenue items by month
**Update Frequency**: **Monthly** (forecast updates)

**Key Fields**:
- `forecast_project_id` - FK to forecast_projects
- `month` - Forecast month (YYYY-MM-DD)
- `forecast_amount` - Forecasted revenue

**Relationships**:
- `belongsTo` ForecastProject

---

### `job_forecast_data`
**Purpose**: Detailed forecast data grid (cost/revenue by month)
**Update Frequency**: **Monthly** (forecast planning)

**Key Fields**:
- `job_forecast_id` - FK to job_forecasts
- `location_id` - FK to locations
- `forecast_project_id` - FK to forecast_projects
- `job_number` - Job number
- `grid_type` - 'cost', 'revenue'
- `cost_item` - Cost code
- `month` - Forecast month
- `forecast_amount` - Amount
- `note` - Notes

**Relationships**:
- `belongsTo` JobForecast
- `belongsTo` Location
- `belongsTo` ForecastProject

---

## Cash Forecasting

### `cash_in_adjustments`
**Purpose**: Manual cash in adjustments for forecasting
**Update Frequency**: **As needed** (user-managed)

**Key Fields**:
- `month` - Month (YYYY-MM-DD)
- `amount` - Adjustment amount
- `description` - Description
- `category` - Category

---

### `cash_out_adjustments`
**Purpose**: Manual cash out adjustments for forecasting
**Update Frequency**: **As needed** (user-managed)

**Key Fields**:
- `month` - Month (YYYY-MM-DD)
- `amount` - Adjustment amount
- `description` - Description
- `category` - Category

---

### `vendor_payment_delays`
**Purpose**: Vendor-specific payment delay settings
**Update Frequency**: **As needed** (user-managed)

**Key Fields**:
- `vendor_code` - Vendor code
- `delay_days` - Payment delay in days (from invoice date)

**Usage**: Used in cash flow forecasting to predict when vendor payments will occur

---

## Supporting Tables

### `cost_types`
**Purpose**: Cost type categorization (LAB, MAT, SUB, EQP, etc.)
**Update Frequency**: **Rarely** (reference data)

**Key Fields**:
- `id` - Primary key
- `code` - Type code (e.g., 'LAB', 'MAT')
- `name` - Type name (e.g., 'Labour', 'Material')
- `is_active` - Active flag

**Relationships**:
- `hasMany` CostCode

---

### `data_sync_logs`
**Purpose**: Audit log for Premier sync operations
**Update Frequency**: **On every sync** (continuous)

**Key Fields**:
- `sync_type` - Type of sync (e.g., 'cost_codes', 'job_summary')
- `job_number` - Job number (if applicable)
- `status` - 'success', 'failed', 'partial'
- `records_synced` - Count of records
- `error_message` - Error details
- `started_at` - Sync start timestamp
- `completed_at` - Sync end timestamp

**Usage**: Track sync history, diagnose sync issues, monitor sync performance

---

## Summary: Recommended Sync Frequencies

| Table | Frequency | Trigger | Notes |
|-------|-----------|---------|-------|
| `locations` | Daily | Scheduled | New jobs + updates |
| `cost_codes` | Weekly | Scheduled | New cost codes |
| `location_cost_codes` | On sync | Event | When cost codes change |
| `job_summaries` | Daily | Scheduled | Financial snapshots |
| `job_report_by_cost_items_and_cost_types` | Daily | Scheduled | Cost tracking |
| `job_vendor_commitments` | Daily | Scheduled | Commitment tracking |
| `premier_po_headers` | On-demand | Request | 60-min cache |
| `premier_po_lines` | On-demand | Request | With PO headers |
| `ap_posted_invoices` | Daily | Scheduled | Invoice tracking |
| `ap_posted_invoice_lines` | Daily | Scheduled | With invoices |
| `ar_progress_billing_summaries` | Weekly | Scheduled | Billing cycle |
| `ar_posted_invoices` | Daily | Scheduled | Invoice tracking |
| `variations` | On-demand | User action | CO create/export |
| `variation_line_items` | On-demand | User action | With variations |
| `forecast_project_*` | Monthly | User action | Forecast planning |
| `job_forecast_data` | Monthly | User action | Forecast planning |
| `cash_*_adjustments` | As needed | User action | Manual adjustments |
| `vendor_payment_delays` | As needed | User action | Payment settings |
| `data_sync_logs` | Continuous | Every sync | Audit trail |

---

## Key Business Rules

### Cost Code Sync
- Premier is source of truth for cost codes
- Local `sync()` ensures exact match with Premier
- Duplicate prevention via unique constraint on `(location_id, cost_code_id)`

### Variation Generation
1. User creates pricing items (conditions + custom)
2. Quick Gen calculates:
   - Base labour/material costs from conditions
   - LAB prelims using `variation_ratio` where `prelim_type = 'LAB'`
   - MAT prelims using `variation_ratio` where `prelim_type = 'MAT'`
   - Revenue line (99-99) with total sell price
3. Export to Premier as QTMP change order file

### PO Caching
- 60-minute cache to reduce API calls
- `synced_at` timestamp tracks freshness
- `isStale()` method checks if refresh needed

### Forecast Workflow
- Monthly planning cycle
- Links to Premier jobs via `job_number`
- Supports both active jobs and planned projects
- Manual adjustments tracked separately

---

## Future Enhancements

### Division Categorization
Add division layer for cost codes:
- New `divisions` table (division_code, division_name)
- Add `division_id` FK to `cost_codes`
- Available in Premier API but not yet implemented

**Data Available**:
- `DivisionCode` (e.g., "42")
- `DivisionName` (e.g., "42 - GYPSUM")

**Benefits**:
- Group cost codes by trade/category
- Improved reporting and filtering
- Better cost rollups

---

*Document Version: 1.0*
*Last Updated: 2026-03-10*
*Maintained by: Development Team*
