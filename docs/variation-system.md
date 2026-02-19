# Variation / Change Order System

Complete documentation for the DPC Clock variation (change order) system covering architecture, data model, business logic, user workflows, and Premier ERP integration.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model](#2-data-model)
3. [Pricing Engine](#3-pricing-engine)
4. [Change Order Generator](#4-change-order-generator)
5. [User Workflows](#5-user-workflows)
6. [API Reference](#6-api-reference)
7. [Premier ERP Integration](#7-premier-erp-integration)
8. [Permissions & Authorization](#8-permissions--authorization)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Key Scenarios](#10-key-scenarios)
11. [Gotchas & Edge Cases](#11-gotchas--edge-cases)

---

## 1. Overview

The variation system manages construction change orders (COs) - modifications to the original project scope that affect cost and revenue. A variation flows through three stages:

```
Pricing Items  -->  Client Quote  -->  Premier Line Items
(what changed)      (what to charge)   (ERP cost breakdown)
```

### Entry Points

| Entry Point | URL | Use Case |
|---|---|---|
| Standalone CRUD | `/variations`, `/variations/create` | Full variation management with 4-step wizard |
| Drawing Workspace | `/drawings/{id}/variations` | Quick variation creation from within the drawing viewer |
| Takeoff Sidebar | `/drawings/{id}/takeoff` (panel) | Link measurements to variations while doing takeoff |

### Key Entities

- **Variation** - The change order header (CO number, type, status, dates)
- **VariationPricingItem** - Human-readable scope items with cost breakdown (the "what")
- **VariationLineItem** - Premier ERP cost lines in QTMP format (the "how much")
- **TakeoffCondition** - Project-scoped pricing template defining rates per unit

---

## 2. Data Model

### Entity Relationship Diagram

```
Location (= Project)
  |-- has many --> Variation
  |                 |-- has many --> VariationPricingItem
  |                 |                 |-- belongs to --> TakeoffCondition (optional)
  |                 |-- has many --> VariationLineItem
  |                 |                 |-- belongs to --> CostCode (optional)
  |                 |                 |-- belongs to --> DrawingMeasurement (optional)
  |                 |-- has many --> DrawingMeasurement (scope=variation)
  |                 |-- belongs to --> Drawing (optional)
  |
  |-- belongs to many --> CostCode (pivot: location_cost_codes)
  |                        pivot: variation_ratio, prelim_type (LAB/MAT)
  |
  |-- has many --> TakeoffCondition
                    |-- has many --> TakeoffConditionCostCode (unit_rate method)
                    |-- has many --> TakeoffConditionMaterial (build_up method)
                    |-- has many --> ConditionLabourCode
                    |-- belongs to --> ConditionType
```

### Variation

The central entity representing a change order.

| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | |
| `co_number` | string | e.g. `CO-001`, `VAR-003` |
| `type` | string | `APPROVED`, `PENDING`, `extra`, `dayworks`, `variations` |
| `description` | string | Scope description |
| `status` | string | `pending`, `sent`, `Approved`, `draft`, `rejected` |
| `co_date` | date | Change order date |
| `location_id` | FK | The project this CO belongs to |
| `drawing_id` | FK nullable | If created from a specific drawing |
| `premier_co_id` | string nullable | Premier ERP reference after sync |
| `markup_percentage` | decimal(5,2) | Legacy/optional markup |
| `client_notes` | text nullable | Notes shown on client quote |
| `created_by` | string | User name who created |
| `deleted_at` | timestamp | Soft delete |

### VariationPricingItem

Human-readable scope items. Sits between the variation header and the ERP line items.

| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | |
| `variation_id` | FK | Parent variation |
| `takeoff_condition_id` | FK nullable | null = manual entry |
| `description` | string | e.g. "Wall Cladding - External" |
| `qty` | decimal(12,4) | Measured quantity |
| `unit` | string(20) | `EA`, `LM`, `m2`, `m3`, `HR`, `DAY`, `LOT` |
| `labour_cost` | decimal(12,2) | Computed or manual labour cost |
| `material_cost` | decimal(12,2) | Computed or manual material cost |
| `total_cost` | decimal(12,2) | labour + material |
| `sell_rate` | decimal(12,2) nullable | Client rate per unit (always stored in primary unit) |
| `sell_total` | decimal(12,2) nullable | qty x sell_rate |
| `sort_order` | integer | Display ordering |

### VariationLineItem

Premier ERP cost lines in QTMP format. Generated from pricing items.

| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | |
| `variation_id` | FK | Parent variation |
| `line_number` | bigint | Sequential line number |
| `description` | string | Line description |
| `qty` | decimal(10,2) | Usually 1 for generated lines |
| `unit_cost` | decimal(10,2) | Rate |
| `total_cost` | decimal(10,2) | qty x unit_cost |
| `cost_item` | string | Cost code e.g. `01-01`, `42-01` |
| `cost_type` | string | `LAB`, `MAT`, `LOC`, `CON`, `REV`, etc. |
| `revenue` | decimal(10,2) | Revenue amount |
| `drawing_measurement_id` | FK nullable | Source measurement |
| `takeoff_condition_id` | FK nullable | Source condition |
| `cost_code_id` | FK nullable | Linked cost code |

### TakeoffCondition

Project-scoped pricing template. Defines how to compute cost for a measured quantity.

| Column | Type | Description |
|---|---|---|
| `id` | bigint PK | |
| `location_id` | FK | Project scope |
| `name` | string | e.g. "External Wall Cladding" |
| `type` | enum | `linear`, `area`, `count` |
| `pricing_method` | enum | `unit_rate` or `build_up` |
| `height` | decimal nullable | For linear: converts LM to m2 (multiplier) |
| `labour_unit_rate` | decimal nullable | Unit rate method: $/unit for labour |
| `labour_rate_source` | enum | Build-up: `manual` or `template` |
| `manual_labour_rate` | decimal nullable | Build-up, manual: hourly rate |
| `production_rate` | decimal nullable | Build-up: units/hour |
| `pay_rate_template_id` | FK nullable | Build-up, template: hourly rate source |
| `color` | string(7) | Hex colour for map overlay |
| `pattern` | enum | `solid`, `dashed`, `dotted`, `dashdot` |
| `condition_type_id` | FK nullable | Category/type grouping |

**Sub-tables:**

- **`takeoff_condition_cost_codes`** (unit_rate method): `{condition_id, cost_code_id, unit_rate}` - maps material cost codes to per-unit rates
- **`takeoff_condition_materials`** (build_up method): `{condition_id, material_item_id, qty_per_unit, waste_percentage}` - material consumption per unit
- **`condition_labour_codes`**: `{condition_id, labour_cost_code_id, production_rate, hourly_rate}` - labour code overrides

### location_cost_codes Pivot

Links cost codes to a project with ratio percentages used for oncost generation.

| Column | Type | Description |
|---|---|---|
| `location_id` | FK | Project |
| `cost_code_id` | FK | Cost code |
| `variation_ratio` | decimal(5,2) | % of base cost applied as oncost |
| `prelim_type` | string | `LAB` or `MAT` - which base the ratio applies to |
| `dayworks_ratio` | decimal(5,2) | For dayworks (not used in variation gen) |
| `waste_ratio` | decimal(5,2) | Waste factor |

---

## 3. Pricing Engine

**Service:** `app/Services/VariationCostCalculator.php`

Converts a `TakeoffCondition` + a quantity into base labour and material costs.

```php
$calculator = new VariationCostCalculator();
$result = $calculator->compute($condition, $qty);
// Returns: { labour_base, material_base, total_cost, effective_qty, breakdown }
```

### Unit Rate Method

```
effective_qty = qty x unit_rate_multiplier
               (multiplier = height for linear type with height > 0, else 1.0)

labour_base   = effective_qty x labour_unit_rate

For each cost code on the condition:
    line_cost = effective_qty x cost_code.unit_rate
    material_base += line_cost
```

**Example:** Condition "External Cladding" (linear, height=2.7m, labour_unit_rate=$10/m2)
- Cost code 42-01 at $12/m2
- Qty: 50 LM
- effective_qty = 50 x 2.7 = 135 m2
- labour_base = 135 x $10 = $1,350
- material_base = 135 x $12 = $1,620
- total = $2,970

### Build-Up Method

```
hours         = qty / production_rate
labour_base   = hours x effective_labour_rate
               (rate from manual_labour_rate OR payRateTemplate.hourly_rate)

For each material:
    effective_qty_per_unit = qty_per_unit x (1 + waste_percentage / 100)
    unit_cost = location override or material_item.unit_cost
    line_cost = effective_qty_per_unit x unit_cost x qty
    material_base += line_cost
```

**Example:** Condition "Plasterboard" (area, production_rate=5 m2/hr, manual_labour_rate=$45/hr)
- Material: Plaster sheet, 1.2 per m2, 5% waste, $8/sheet
- Qty: 100 m2
- hours = 100 / 5 = 20 hrs
- labour_base = 20 x $45 = $900
- effective_qty = 1.2 x 1.05 = 1.26 per m2
- material_base = 1.26 x $8 x 100 = $1,008
- total = $1,908

---

## 4. Change Order Generator

**Service:** `app/Services/ChangeOrderGenerator.php`

Orchestrates the full set of Premier line items from pricing data. Depends on `VariationCostCalculator`.

### Single Condition Generation (`generate`)

Used by the drawing workspace variation panel.

```
Input: condition, qty, location
Output: { line_items[], summary }

1. Compute base costs via VariationCostCalculator
2. Create "Base Labour" line (cost_item from LAB base code, e.g. 01-01)
3. Create "Base Material" line (cost_item from MAT base code, e.g. 42-01)
4. For each location cost code with variation_ratio > 0:
   - If prelim_type = LAB: oncost = labour_base x (ratio / 100)
   - If prelim_type = MAT: oncost = material_base x (ratio / 100)
   - Create oncost line item
```

### Full Generation from Pricing Items (`generateFromPricingItems`)

Used by the "Generate Premier Lines" button on the Premier tab. This is the primary generation path.

```
Input: variation (with pricingItems), location
Output: All line items saved to variation (existing items wiped first)

Phase 1 - Collect costs:
  totalLabour = sum of all pricing items' labour_cost
  materialByCostCode = {} (grouped material costs by cost code)

  For each condition-linked pricing item:
    Re-compute condition for that item's qty
    Extract cost_code breakdown from the condition
    Accumulate into materialByCostCode[code]

Phase 2 - Labour oncost lines (Quick Gen):
  For each location cost code where prelim_type starts with "LAB":
    line_amount = totalLabour x (variation_ratio / 100)
    Create line item

Phase 3 - Direct material lines:
  For each entry in materialByCostCode:
    Create line item with that cost code's total

Phase 4 - Material oncost lines (Quick Gen):
  For each location cost code where prelim_type starts with "MAT":
    line_amount = totalMaterial x (variation_ratio / 100)
    Create line item
```

### Preview (`preview`)

Same as `generate()` but returns a summary without saving:
```json
{
  "labour_base": 1350.00,
  "material_base": 1620.00,
  "labour_oncosts": 425.25,
  "material_oncosts": 162.00,
  "total_cost": 3557.25,
  "line_count": 12
}
```

---

## 5. User Workflows

### Workflow A: Full 4-Step Wizard (Standalone)

**Route:** `/variations/create` or `/variations/{id}/edit`

#### Step 1 - Details

Fill in variation header:
- **Location** (project) - searchable combobox
- **Type** - `dayworks`, `variations`, or custom types
- **CO Number** - e.g. `VAR-001`
- **Date** - change order date
- **Description** - scope description

Must have location, CO number, and description to proceed.

#### Step 2 - Pricing

Add scope items that define what work is being varied. Two modes:

**From Condition:**
1. Select a condition from the project's condition library
2. Enter quantity (in the condition's unit - LM, m2, or EA)
3. System computes labour + material costs via `VariationCostCalculator`
4. Item added to pricing list

**Manual:**
1. Enter description, qty, unit
2. Enter labour $/unit and material $/unit
3. Total computed as qty x (labour + material)

Items can be reordered, edited inline, or deleted. Condition items auto-recalculate when qty changes.

**Condition Manager:** Opens a full CRUD dialog for managing the project's TakeoffConditions directly from this step. Supports both `unit_rate` and `build_up` pricing methods.

#### Step 3 - Client

Set sell rates for each pricing item to produce a client-facing quote.

- **Cost Rate** - auto-calculated from total_cost / qty
- **Multiplier %** - enter a markup percentage (e.g. 220 = 2.2x markup)
- **Sell Rate** - auto-calculated from multiplier, or enter directly
- **Sell Total** - qty x sell_rate

**UOM Toggle:** For linear conditions with height, toggle between LM and m2 display. The sell rate is always stored in the primary unit (LM); display converts by dividing/multiplying by height.

**Propagate Multiplier:** Click the down-arrow on any multiplier to apply that percentage to all rows below (with confirmation).

**Client Notes:** Free text area included on the printed quote.

**Print Quote:** Opens a print-optimized Blade page (`/variations/{id}/client-quote`) in a new tab. Includes project details, itemized rates table, and totals.

#### Step 4 - Premier

Generate Premier ERP line items from the pricing items.

1. **Generate Premier Lines** - calls `generateFromPricingItems()` server-side
   - Wipes all existing line items
   - Creates base labour/material lines
   - Creates oncost lines using `location_cost_codes.variation_ratio`
   - Returns the full line item set

2. **Review in AG Grid** - editable grid showing all line items
   - Line Number, Cost Item, Cost Type, Description, Qty, Unit Cost, Total Cost, Revenue
   - Cost Item/Type cells have searchable dropdown editors
   - Changing qty/unit_cost auto-recalculates total_cost

3. **Quick Gen** (manual alternative) - dialog to apply ratios manually
   - Enter a base amount ($)
   - Choose Labour or Material
   - Generates oncost lines using the same ratio logic client-side

4. **Download Excel** - exports QTMP-format CSV for manual import
5. **Send to Premier** - POSTs to Premier API directly

#### Save

The save button (available on all steps) either:
- Creates the variation via `quick-store` (if new) then persists pricing items
- Updates via Inertia POST

### Workflow B: Drawing Workspace (Quick Creation)

**Route:** `/drawings/{id}/variations`

1. View the drawing with the Leaflet tile viewer
2. Select or create a variation from the sidebar
3. Use measurement tools (line/area/count) to draw on the map
4. Measurements are created with `scope=variation` and amber colour
5. View pricing items and costs in the sidebar
6. Click "Generate Premier" to create line items

### Workflow C: Takeoff Sidebar Panel

**Route:** `/drawings/{id}/takeoff` (variation panel in sidebar)

A streamlined 3-step flow within the takeoff tab:
1. **Select Variation** from dropdown (or create new via dialog)
2. **Pick Condition** from the project's condition library
3. **Enter Quantity** and preview costs
4. **Generate Change Order** - creates line items directly

---

## 6. API Reference

### Standard CRUD (Inertia)

| Method | URL | Permission | Description |
|---|---|---|---|
| GET | `/variations` | `variations.view` | Index page (paginated, filterable) |
| GET | `/locations/{location}/variations` | `variations.view` | Location-scoped index |
| GET | `/variations/create` | `variations.create` | Create form |
| POST | `/variations/store` | `variations.create` | Store (Inertia redirect) |
| GET | `/variations/{variation}/edit` | `variations.edit` | Edit form |
| POST | `/variations/{variation}/update` | `variations.edit` | Update (Inertia redirect) |
| GET | `/variations/{id}` | `variations.delete` | Soft delete |
| GET | `/variations/{variation}/duplicate` | `variations.create` | Duplicate with `-COPY` suffix |

### JSON API (Drawing Workspace)

| Method | URL | Permission | Description |
|---|---|---|---|
| POST | `/variations/quick-store` | `variations.create` | Create minimal variation, returns JSON |
| GET | `/drawings/{drawing}/variation-list` | `variations.view` | List variations for drawing's project |
| POST | `/locations/{location}/variation-preview` | `variations.view` | Preview costs for condition+qty |
| POST | `/locations/{location}/variation-generate` | `variations.create` | Generate and save CO line items |

### Pricing Items API

| Method | URL | Permission | Description |
|---|---|---|---|
| GET | `/variations/{variation}/pricing-items` | `variations.view` | List pricing items |
| POST | `/variations/{variation}/pricing-items` | `variations.edit` | Add pricing item |
| PUT | `/variations/{variation}/pricing-items/{item}` | `variations.edit` | Update pricing item |
| DELETE | `/variations/{variation}/pricing-items/{item}` | `variations.edit` | Delete pricing item |
| POST | `/variations/{variation}/sell-rates` | `variations.edit` | Batch update sell rates |
| POST | `/variations/{variation}/generate-premier` | `variations.edit` | Generate Premier line items |
| GET | `/variations/{variation}/client-quote` | `variations.view` | Print client quote (Blade) |

### Export & ERP

| Method | URL | Permission | Description |
|---|---|---|---|
| GET | `/variations/{id}/download/excel` | `variations.export` | Download QTMP CSV |
| GET | `/variations/{variation}/send-to-premier` | `variations.send` | Send to Premier API |
| GET | `/locations/{location}/variations/sync` | `variations.sync` | Import from Premier |

### Takeoff Conditions (used by pricing)

| Method | URL | Permission | Description |
|---|---|---|---|
| GET | `/locations/{location}/takeoff-conditions` | `takeoff.view` | List all conditions |
| POST | `/locations/{location}/takeoff-conditions` | `takeoff.edit` | Create condition |
| PUT | `/locations/{location}/takeoff-conditions/{id}` | `takeoff.edit` | Update condition |
| DELETE | `/locations/{location}/takeoff-conditions/{id}` | `takeoff.edit` | Delete condition |
| GET | `/locations/{location}/material-items/search` | `takeoff.view` | Search materials |
| GET | `/locations/{location}/cost-codes/search` | `takeoff.view` | Search cost codes |

---

## 7. Premier ERP Integration

### Export CSV Format (QTMP)

Headers:
```
Company Code, Job Number, CO Number, Description, CO Date, Internal CO, Extra Days,
Line, Cost Item, Cost Type, Department, Location, Line Description, UofM, Qty,
Unit Cost, Cost, Revenue, Vendor Name, Subcontract, PO, Memo, RFI
```

- `Cost Item` is wrapped as `="01-01"` to prevent Excel scientific notation
- Only the first row has the header fields populated; subsequent rows only have line-level fields

### Send to Premier API

**Endpoint:** `POST {premier_url}/api/ChangeOrder/CreateChangeOrders`

**Payload:**
```json
{
  "Company": "3341c7c6-2abb-49e1-8a59-839d1bcff972",
  "JobSubledger": "SWCJOB",
  "Job": "{location.external_id}",
  "ChangeOrderNumber": "{co_number}",
  "Description": "{description}",
  "ChangeOrderDate": "{co_date}",
  "ChangeOrderLines": [
    {
      "LineNumber": 1,
      "JobCostItem": "01-01",
      "JobCostType": "LAB",
      "LineDescription": "Base Labour",
      "Quantity": 1,
      "UnitCost": 1350.00,
      "Amount": 1350.00
    }
  ]
}
```

**On success:** Variation status is set to `sent`. Edit and resend are disabled in the UI.

### Sync from Premier

`LoadVariationsFromPremierJob` is dispatched via `/locations/{location}/variations/sync`. Imports existing COs from Premier into the local database.

---

## 8. Permissions & Authorization

Authorization uses Spatie permissions checked via route middleware.

| Permission | Who | Controls |
|---|---|---|
| `variations.view` | admin, backoffice, manager | Read list, view quotes, preview costs |
| `variations.create` | admin, backoffice | Create, duplicate, quick-store |
| `variations.edit` | admin, backoffice | Edit, manage pricing items, generate Premier |
| `variations.delete` | admin, backoffice | Soft delete |
| `variations.sync` | admin | Import from Premier |
| `variations.send` | admin, backoffice | Send to Premier |
| `variations.export` | admin, backoffice | Download CSV |
| `takeoff.view` | admin, backoffice, manager | Read conditions (needed for pricing tab) |
| `takeoff.edit` | admin, backoffice | Create/update conditions |

**Manager restriction:** Users with `manager` role are filtered to only see variations for locations they manage (via `managedKiosks` EmployeeHub join).

**Status locking:** Variations with `status = 'sent'` or `status = 'Approved'` have Edit and Send to Premier actions disabled throughout the UI.

---

## 9. Frontend Architecture

### Component Hierarchy

```
create.tsx (4-step wizard)
  Step 1: Inline form (location, type, CO#, date, description)
  Step 2: VariationPricingTab
            ConditionPricingPanel (condition picker + manual add)
            ConditionManager (full CRUD dialog, opened via "Manage" button)
  Step 3: ClientVariationTab (sell rates, UOM toggle, print quote)
  Step 4: PremierVariationTab (generate, review grid, send/export)
            VariationLineGrid (AG Grid with custom editors/renderers)
```

### State Management

The `create.tsx` page manages state with Inertia's `useForm` for the main form data and React `useState` for pricing items:

```
useForm(data)           -> location_id, type, co_number, date, description, line_items
useState(savedVariationId)  -> set after quick-store or from variation prop
useState(pricingItems)      -> PricingItem[]; flows through all tabs
useState(localConditions)   -> TakeoffCondition[]; updated by ConditionManager
useState(activeStep)        -> 1 | 2 | 3 | 4
```

Data flows downward through props; changes bubble up via `onPricingItemsChange`, `onLineItemsChange`, and `onClientNotesChange` callbacks.

### Unsaved Items

Pricing items created before the variation is saved have `id: undefined` and display an amber "Unsaved" badge. On form submit:
1. `quick-store` creates the variation record
2. Each unsaved item is POSTed to `/variations/{id}/pricing-items`
3. Then the Inertia form submit runs

### AG Grid Configuration

The Premier line items grid uses AG Grid Community with:
- Custom cell editors: `CostItemSearchEditor` (popover command palette), `CostTypeSearchEditor`
- Custom cell renderers: `CurrencyRenderer` ($X.XX format), `LineNumberRenderer` (circular badge), `ActionsCellRenderer` (delete button)
- Auto-calculation: changing qty or unit_cost recalculates total_cost
- Auto-fill: changing cost_item auto-populates cost_type and description
- Resizable height (drag handle, persisted to localStorage)

---

## 10. Key Scenarios

### Scenario 1: Simple Manual Variation

1. Go to `/variations/create`
2. Fill in location, CO number, description
3. Step 2: Add manual pricing items (no condition needed)
   - e.g. "Additional painting" - 1 EA - $500 labour - $200 material
4. Step 3: Set sell rates (e.g. 2.2x multiplier = $1,540)
5. Step 4: Generate Premier lines
6. Save and send to Premier

### Scenario 2: Condition-Based Variation from Drawing

1. Open a drawing takeoff: `/drawings/{id}/takeoff`
2. Open the variation panel in the sidebar
3. Create a new variation (quick-store)
4. Select a condition (e.g. "External Cladding")
5. Enter quantity (e.g. 50 LM)
6. Preview costs -> see labour/material/oncost breakdown
7. Generate Change Order -> line items created automatically

### Scenario 3: Multi-Item Variation with Mixed Sources

1. Create variation in the wizard
2. Step 2: Add condition-linked items:
   - "Wall Cladding" - 200 m2 from "External Cladding" condition
   - "Ceiling" - 150 m2 from "Plasterboard" condition
3. Step 2: Add manual item:
   - "Supervision" - 8 HR - $85/hr labour only
4. Step 3: Set different sell rates per item
5. Step 4: Generate Premier lines
   - Labour oncosts calculated from total labour ($200 cladding + $150 plaster + $680 supervision)
   - Material lines grouped by cost code from conditions
   - Material oncosts calculated from total material cost
6. Review, adjust if needed, send to Premier

### Scenario 4: Duplicate and Modify

1. From the variation index, click Duplicate on an existing variation
2. System creates a copy with `-COPY` suffix on CO number
3. Edit the duplicate: modify pricing items, regenerate Premier lines
4. Save as a new variation

### Scenario 5: Sync and Reconcile with Premier

1. From location-scoped variation index, click "Sync"
2. System dispatches `LoadVariationsFromPremierJob`
3. Existing COs from Premier appear in the list with their `premier_co_id`
4. Compare local vs Premier data

---

## 11. Gotchas & Edge Cases

### Data Type Coercion
API returns numeric fields as strings. Always use `Number()` in frontend `reduce()` calls to avoid NaN or string concatenation.

### prelim_type Must Be Populated
The `prelim_type` field on `location_cost_codes` must be set to `LAB` (codes 01-08) or `MAT` (remaining codes). If NULL, the generator skips that cost code entirely, producing incomplete line items.

### Sell Rate UOM Storage
Sell rates are **always stored in the primary unit** (LM for linear conditions). When the UI displays in m2 mode (for linear conditions with height), it divides by height for display and multiplies back on input. The client quote Blade template does the same conversion server-side using `$uomM2Ids` from query params.

### Quick Gen vs Server Generate
- **Quick Gen** (Step 4 dialog): Client-side only. Reads `location.cost_codes[].pivot.variation_ratio` and `prelim_type` directly. Generates oncost lines locally.
- **Generate Premier Lines** (Step 4 button): Server-side via `POST /variations/{id}/generate-premier`. Uses `ChangeOrderGenerator->generateFromPricingItems()`. Wipes and regenerates all line items.

Both produce the same mathematical result but Quick Gen allows manual base amount input while the server path derives amounts from pricing items.

### Inertia vs JSON Endpoints
The `store()` endpoint does an Inertia redirect (not suitable for AJAX). Use `quickStore()` for JSON API calls that need a variation ID back without a page navigation.

### Status Locking
Variations with `status = 'sent'` or `status = 'Approved'` cannot be edited or re-sent. The UI disables these actions. To modify a sent variation, duplicate it first.

### Manual Items in Generation
Manual pricing items (no `takeoff_condition_id`) contribute their `labour_cost` to the total labour pool for oncost calculation, but their `material_cost` is **not** included in the material cost code breakdown (since there's no condition to derive cost codes from).

### Windows Shell Issue
Windows PowerShell strips `$` from PHP commands. When running tinker or artisan commands with `$variables`, use temp script files instead of inline `--execute`.

### Unit Rate Multiplier
For `unit_rate` pricing with `linear` type and `height > 0`, the quantity is multiplied by height to convert LM to m2. This means a 50 LM measurement at 2.7m height becomes 135 m2 for costing purposes. The UI shows a hint: "LM -> m2" when this applies.

### Condition Manager Reuse
The `ConditionManager` component is shared between the takeoff page and the variation pricing tab. Changes made to conditions in either location affect the same underlying data.

### Soft Deletes
Variations use soft deletes. The `destroy()` method sets `deleted_by` to the current user's name before soft-deleting. Soft-deleted variations are excluded from all queries by default.