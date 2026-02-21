# Smart Pricing

Smart Pricing is an AI-powered workflow that detects pricing problems on requisition line items and guides field workers + office admins through resolving them.

---

## Table of Contents

- [End User Guide](#end-user-guide)
  - [For Field Workers](#for-field-workers)
  - [For Office Admins](#for-office-admins)
- [Infrastructure](#infrastructure)
  - [Architecture Overview](#architecture-overview)
  - [API Endpoints](#api-endpoints)
  - [Data Model](#data-model)
  - [AI Integration](#ai-integration)
  - [Price Calculation](#price-calculation)
  - [Error Handling & Fallbacks](#error-handling--fallbacks)
  - [Activity Logging](#activity-logging)

---

## End User Guide

### For Field Workers

#### When Does Smart Pricing Appear?

When you click **"Send to Office"** on a requisition, the system automatically scans every line item for pricing problems. If any issues are found, a wizard opens before the requisition is sent.

Problems detected:

| Problem | What It Means |
|---------|---------------|
| No code | The line item has no item code |
| Unmatched code | The code doesn't exist in the supplier's catalog |
| Not in price list | The code exists but has no price set for this project |
| No price | The unit cost is zero or empty |

Items that are **locked** or **already resolved** are skipped.

#### The Wizard

The wizard walks you through one problem item at a time. A progress bar at the top shows how many items remain. AI analyses each item and determines which of two paths applies:

##### Path A — Not in Price List

The item code exists in the supplier's catalog but has no project-level price. You get one choice:

- **Remove from order** — You'll get a quote separately. The item is deleted from the requisition.
- **Keep without price** — The office will handle it. You can add optional notes.
- **Something else** — A text box opens for you to explain.

##### Path B — Custom Length / Variation

The item might be a custom length or variation of something already on the project price list. The wizard adapts — you only see relevant steps:

1. **Is this a custom length of an existing item?** — Answer Yes, No, or Not Sure.
2. **Pick the matching item** — If AI found catalog matches, select the correct one. If none match, describe the item.
3. **Enter the length in meters** — If the item is sold per meter, enter the length you need. AI pre-fills a guess from the description (e.g. "15m" or "3000mm").
4. **Additional notes** — Anything else the office should know.

Steps are skipped when they don't apply. For example, if there are no catalog matches, step 2 is skipped.

#### After the Wizard

Once you've gone through every problem item, click **"Send to Office"**. The requisition moves to office review with all your context attached.

---

### For Office Admins

#### Where to Find Smart Pricing Items

When a requisition is in **Office Review** status, a collapsible **"Smart Pricing"** section appears at the top of the requisition page. It shows a count of items that need resolution.

You need the **requisitions.approve-pricing** permission to see and act on these cards.

#### What Each Card Shows

Each card contains:

- **Item details** — Line number, description, code, qty, and current unit cost.
- **AI Assessment** — A brief AI analysis of the item (e.g. "This looks like a 3m length of 76mm Flexible Track").
- **Field Worker Context** — What the field worker told you: their choice (Path A), the matched item and length (Path B), and any notes.
- **Calculated Price** — For items with a catalog match and length, the system calculates: `length x rate/meter = unit cost`.

#### Actions You Can Take

**Quick Apply** (one click) — If the system already calculated a price from the field worker's match + length, click **"Apply as One-Off Price"** to accept it immediately.

**Edit & Apply** — Opens a form where you can adjust:

- Item code
- Cost code (dropdown selector)
- Quantity
- Unit cost (rate per unit)
- Choose between "Use calculated price" or "Enter price directly"

Then choose what to do with the item going forward:

| Option | When to Use |
|--------|-------------|
| **One-off purchase** | This is a one-time buy. Just update the line item price. |
| **Add to project price list** | The item already exists in Item Master. Set its project-level price so future requisitions pick it up automatically. You can lock the price for the project duration. |
| **Create item in Item Master** | The item is brand new. Creates it in the master catalog AND sets the project price. Requires code, description, unit cost, and cost code. |

**Dismiss** — Keeps the item as-is with its original values. Use this if no pricing change is needed.

#### After Resolving All Items

Once every smart pricing card is resolved, the section disappears and the requisition can proceed to the next step (Send to Premier).

---

## Infrastructure

### Architecture Overview

```
Field Worker clicks "Send to Office"
        │
        ▼
┌─────────────────────────┐
│  GET /smart-pricing-check│  ← Fast, no AI. Returns problem items.
└────────────┬────────────┘
             │ problems found?
             ▼
┌─────────────────────────┐
│  SmartPricingWizard.tsx  │  ← Multi-step wizard opens
│                         │
│  POST /smart-pricing-    │  ← AI assessment per item (GPT-4o)
│        assess            │
│                         │
│  POST /smart-pricing-    │  ← Save field worker answers
│        context           │
│                         │
│  POST /smart-pricing-    │  ← Remove item (if chosen)
│        remove-item       │
└────────────┬────────────┘
             │ requisition → office_review
             ▼
┌─────────────────────────┐
│  SmartPricingCards.tsx    │  ← Office review UI
│                         │
│  POST /smart-pricing-    │  ← Apply resolution
│        apply             │
└─────────────────────────┘
```

**Key files:**

| File | Purpose |
|------|---------|
| `app/Http/Controllers/SmartPricingController.php` | 5 endpoints (check, assess, saveContext, removeItem, apply) |
| `app/Services/SmartPricingService.php` | Core logic: problem detection, AI assessment, resolution application |
| `resources/js/components/SmartPricingWizard.tsx` | Field worker wizard dialog |
| `resources/js/pages/purchasing/show-partials/SmartPricingCards.tsx` | Office review cards |
| `app/Models/RequisitionLineItem.php` | Model with `resolution_context` JSON column |

### API Endpoints

All endpoints are under `middleware('auth', 'verified')`.

#### 1. Check for Problems

```
GET /requisition/{id}/smart-pricing-check
```

Fast scan — no AI. Checks each line item against supplier catalog and location pricing.

**Response:**
```json
{
  "count": 2,
  "problems": [
    {
      "line_item_id": 42,
      "serial_number": 1,
      "code": "FT-76MM",
      "description": "15m of 76mm Flex Track",
      "qty": 1,
      "unit_cost": 0,
      "total_cost": 0,
      "reasons": ["not_in_price_list", "no_price"],
      "item_exists_in_db": true
    }
  ]
}
```

#### 2. AI Assessment

```
POST /requisition/{id}/smart-pricing-assess
```

Calls GPT-4o to analyse a single line item against the project's catalog.

**Request:**
```json
{
  "line_item_id": 42,
  "reasons": ["not_in_price_list", "no_price"]
}
```

**Response:**
```json
{
  "success": true,
  "assessment": "This looks like a 15m length of 76mm Flexible Track...",
  "path": "custom_length",
  "recommended_action": "custom_length",
  "parsed_length": 15.0,
  "is_meterage": true,
  "matches": [
    {
      "catalog_item_id": 200,
      "code": "FT-76MM",
      "description": "76mm Flexible Track",
      "unit_cost": 2.50,
      "price_source": "location_price",
      "cost_code": "32-01",
      "cost_code_id": 5,
      "confidence": "high",
      "reasoning": "Same material (76mm flex track), per-meter catalog item"
    }
  ]
}
```

#### 3. Save Field Worker Context

```
POST /requisition/{id}/smart-pricing-context
```

Saves the wizard answers to `resolution_context` JSON on the line item.

**Path A payload:**
```json
{
  "line_item_id": 42,
  "path": "not_in_price_list",
  "field_worker_choice": "keep_for_office",
  "field_worker_notes": "Need this urgently",
  "ai_assessment": "This item isn't on the project price list...",
  "item_exists_in_db": true
}
```

**Path B payload:**
```json
{
  "line_item_id": 43,
  "path": "custom_length",
  "is_custom_length": true,
  "matched_catalog_code": "FT-76MM",
  "matched_catalog_item_id": 200,
  "matched_catalog_description": "76mm Flexible Track",
  "matched_catalog_unit_cost": 2.50,
  "requested_length_meters": 15,
  "field_worker_notes": "For conduit run in building B",
  "ai_assessment": "This looks like 15m of 76mm Flexible Track...",
  "ai_matches": [{ "catalog_item_id": 200, "code": "FT-76MM", "..." : "..." }],
  "item_exists_in_db": true
}
```

#### 4. Remove Line Item

```
POST /requisition/{id}/smart-pricing-remove-item
```

Deletes the line item. Used when field worker chooses "Remove from order".

**Request:**
```json
{ "line_item_id": 42 }
```

#### 5. Apply Resolution (Office)

```
POST /requisition/{id}/smart-pricing-apply
```

Requires requisition to be in `office_review` status.

**One-off purchase:**
```json
{
  "line_item_id": 42,
  "resolution_type": "custom_length",
  "new_code": "FT-76MM",
  "description": "76mm Flexible Track (15m)",
  "qty": 1,
  "unit_cost": 37.50,
  "cost_code": "32-01",
  "cost_code_id": 5
}
```

**Create item + add to price list:**
```json
{
  "line_item_id": 42,
  "resolution_type": "custom_length",
  "new_code": "FT-76MM-15M",
  "description": "76mm Flexible Track 15m",
  "qty": 1,
  "unit_cost": 37.50,
  "cost_code": "32-01",
  "cost_code_id": 5,
  "save_as_new_item": true,
  "new_item_code": "FT-76MM-15M",
  "new_item_description": "76mm Flexible Track 15m",
  "new_item_price": 37.50,
  "new_item_is_locked": true,
  "new_item_supplier_category_id": 10
}
```

**What happens on apply:**
1. Line item updated (code, description, qty, unit_cost, total_cost, cost_code, price_list)
2. `resolution_context.status` set to `resolved` with timestamp and user ID
3. If `save_as_new_item`: MaterialItem created via `firstOrCreate` on `(code, supplier_id)`, then location pricing set via `updateOrInsert`
4. Activity logged with original vs resolved values

### Data Model

#### Migration

```
2026_02_20_234625_add_resolution_context_to_requisition_line_items_table.php
```

Adds a `resolution_context` JSON column to `requisition_line_items`, positioned after `is_locked`. Idempotent — checks `hasColumn()` before adding/dropping.

#### resolution_context JSON Structure

**Common fields (both paths):**

```
path              : 'not_in_price_list' | 'custom_length'
field_worker_notes: string | null
ai_assessment     : string | null
item_exists_in_db : boolean
status            : 'pending_review' | 'resolved' | 'removed'
created_at        : ISO 8601 timestamp
resolved_at       : ISO 8601 timestamp | null  (set on apply)
resolved_by       : user ID | null              (set on apply)
```

**Path A additional fields:**

```
field_worker_choice: 'remove_item' | 'keep_for_office' | 'other' | null
```

**Path B additional fields:**

```
is_custom_length           : boolean | null  (true=Yes, false=No, null=Not Sure)
matched_catalog_code       : string | null
matched_catalog_item_id    : number | null
matched_catalog_description: string | null
matched_catalog_unit_cost  : number | null   (rate per unit/meter)
requested_length_meters    : number | null
ai_matches                 : CatalogMatch[]
```

**CatalogMatch shape:**

```
catalog_item_id: number
code           : string
description    : string
unit_cost      : number          (location-specific price)
price_source   : 'location_price'
cost_code      : string | null
cost_code_id   : number | null
confidence     : 'high' | 'medium' | 'low'
reasoning      : string
```

### AI Integration

**Model:** GPT-4o (configurable via `OPENAI_CHAT_MODEL` env var)
**Temperature:** 0.2 (consistent, low-randomness answers)
**Response format:** JSON object (enforced via `response_format`)
**Timeout:** 60 seconds

**What AI does:**

1. **Assess** — Writes a 1-2 sentence explanation addressed to the field worker.
2. **Route** — Determines path: `custom_length` if anything in the catalog matches, `not_in_price_list` otherwise.
3. **Match** — Finds up to 3 catalog matches ranked by confidence. Matches are validated against real DB data (location pricing must exist).
4. **Parse** — Extracts length from description (e.g. "15m" = 15.0, "3000mm" = 3.0).

**Catalog context:** Only items with location-specific pricing for the current project are sent to the AI. Limited to 200 items.

**Post-processing:** AI matches are validated against the database — any match that doesn't exist in `material_items` with active `location_item_pricing` is discarded.

### Price Calculation

For Path B items with a catalog match and meterage:

```
unit_cost = requested_length_meters x matched_catalog_unit_cost
total_cost = qty x unit_cost
```

Example:
- Catalog: "76mm Track" at $2.50/meter
- Field worker: 15 meters, qty 2
- Unit cost: 15 x $2.50 = **$37.50**
- Total: 2 x $37.50 = **$75.00**

If no length is specified, the matched unit cost is used directly.

### Error Handling & Fallbacks

#### AI Failure

When the OpenAI API fails (timeout, rate limit, invalid response), the system falls back to code-based routing:

- Extracts length from description using regex (`\d+m`, `\d+mm`)
- Routes based on problem reasons:
  - `not_in_price_list` reason or no catalog items → Path A
  - Otherwise → Path B
- Returns a descriptive fallback message including the item description

#### Controller Error Handling

All service calls in `SmartPricingController` are wrapped in try-catch. Exceptions are logged and return JSON error responses instead of raw 500 errors:

```json
{ "error": "Failed to apply pricing resolution" }
```

#### Frontend Error Handling

All API calls in `SmartPricingCards.tsx` display toast notifications on failure via `sonner`. Error messages are extracted from the server response when available:

```typescript
catch (err: any) {
    const message = err?.response?.data?.error || 'Failed to apply resolution';
    toast.error(message);
}
```

#### MaterialItem Uniqueness

`createMaterialItemWithLocationPricing` uses `firstOrCreate` keyed on `(code, supplier_id)` to prevent duplicate items. If the item already exists, only the location pricing is updated.

### Activity Logging

Uses Spatie Activity Log. Two events are recorded:

**`line_item_removed`** — Field worker removed an item via the wizard.
```
Properties: line_item_id, code, description
Message: "Line item #1 removed by field worker (not in price list)"
```

**`smart_pricing_applied`** — Office admin resolved an item.
```
Properties: line_item_id, resolution_type, original values, resolved values, saved_as_new_item flag
Message: "Smart pricing applied to line item #3"
```
