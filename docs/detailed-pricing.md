# Detailed Pricing (QuickBid-Style Conditions)

The detailed pricing method provides full line-item control over how a condition is costed, matching the approach used in QuickBid. Each condition becomes a mini-spreadsheet where every material and labour component is independently calculated.

---

## Table of Contents

- [Overview — The Three Pricing Methods](#overview--the-three-pricing-methods)
- [When to Use Detailed Pricing](#when-to-use-detailed-pricing)
- [Core Concepts](#core-concepts)
  - [Quantity Sources (Qty1, Qty2, Fixed)](#quantity-sources-qty1-qty2-fixed)
  - [On-Centre Spacing (OC)](#on-centre-spacing-oc)
  - [Layers](#layers)
  - [Waste Percentage](#waste-percentage)
  - [Pack Size](#pack-size)
  - [Sections](#sections)
- [How Costs Are Calculated](#how-costs-are-calculated)
  - [Material Line Items](#material-line-items)
  - [Labour Line Items](#labour-line-items)
  - [Full Formula](#full-formula)
- [Worked Example — PT05b Party Wall](#worked-example--pt05b-party-wall)
  - [Condition Setup](#condition-setup)
  - [Line-by-Line Breakdown](#line-by-line-breakdown)
- [End User Guide](#end-user-guide)
  - [Creating a Detailed Condition](#creating-a-detailed-condition)
  - [The Line Items Grid](#the-line-items-grid)
  - [Adding Line Items](#adding-line-items)
  - [Editing a Line Item](#editing-a-line-item)
  - [Sections](#sections-1)
  - [Reading the Grid](#reading-the-grid)
  - [Saving](#saving)
- [Infrastructure](#infrastructure)
  - [Data Model](#data-model)
  - [API Endpoints](#api-endpoints)
  - [Cost Calculator](#cost-calculator)
  - [Key Files](#key-files)
- [Comparison — Unit Rate vs Build-Up vs Detailed](#comparison--unit-rate-vs-build-up-vs-detailed)

---

## Overview — The Three Pricing Methods

Every takeoff condition uses one of three pricing methods:

| Method | Idea | Complexity |
|--------|------|------------|
| **Unit Rate** | One dollar-per-unit rate per cost code. Simple flat rate. | Low |
| **Build-Up** | List of materials with waste factors + a single labour production rate for the whole condition. | Medium |
| **Detailed** | Full line-item breakdown. Each material and labour item has its own quantity source, OC spacing, layers, waste, and cost. Matches QuickBid's condition structure. | High |

---

## When to Use Detailed Pricing

Use the detailed method when:

- Different materials pull from **different quantity sources** (e.g. studs use area, tracks use perimeter)
- Items need **on-centre spacing** calculations (e.g. studs at 400mm, screws at 600mm)
- Materials are applied in **multiple layers** (e.g. plasterboard on both sides of a wall)
- Items are sold in **pack sizes** and need rounding (e.g. screws in boxes of 100)
- You need a **section-based cost breakdown** for reporting (Framing, Sheeting, Fixings, etc.)
- Each labour trade has its **own production rate and hourly rate** (framers vs setters vs sealant installers)

If you just know "this costs $X per m2" — use **unit rate** instead. If you have a materials list but one shared labour rate — use **build-up**.

---

## Core Concepts

### Quantity Sources (Qty1, Qty2, Fixed)

Every line item gets its base quantity from one of three sources:

| Source | Label in UI | What It Uses | Typical Use |
|--------|-------------|-------------|-------------|
| `primary` | Area (Q1) or Length (Q1) | The measurement's **computed_value** — usually area in m2 or length in m | Boards, insulation, general materials |
| `secondary` | Perimeter (Q2) | The measurement's **perimeter_value** — usually perimeter in m | Tracks, sealant, edge items |
| `fixed` | Fixed | A manually entered number | One-off items not tied to measurement |

**Example:** A wall condition where Qty1 = 1,359 m2 and Qty2 = 485 m:
- Plasterboard uses **Qty1** (area) because you need board to cover the surface
- Wall track uses **Qty2** (perimeter) because track runs along the top and bottom edges
- If you had 4 access doors, that would be a **Fixed** quantity of 4

### On-Centre Spacing (OC)

When items are spaced at regular intervals (studs, screws, noggings), set the OC spacing in metres. The system divides the base quantity by the spacing to get the count:

```
count = base_quantity / oc_spacing
```

**Example:** 1,359 m2 of wall area with studs at 400mm (0.4m) centres:
```
studs = 1,359 / 0.4 = 3,398 studs
```

Leave OC blank (or zero) for items that don't use spacing — they'll just use the base quantity directly.

### Layers

The number of times this item is repeated in the condition. Multiplies the quantity:

```
quantity = (base_qty / oc_spacing) x layers
```

**Common examples:**
- Plasterboard on **both sides** of a partition = 2 layers
- Screws for **4 layers** of board (2 boards x 2 sides) = 4 layers
- Sealant around **all edges** (2 boards x 2 sides x 2 edges) = 8 layers

### Waste Percentage

Adds a waste factor on top of the calculated quantity. Entered as a percentage (0-100).

```
effective_qty = line_qty x (1 + waste% / 100)
```

**Example:** 3,398 studs with 5% waste:
```
3,398 x 1.05 = 3,568 studs
```

### Pack Size

For items sold in whole packs (boxes, bags), the system rounds **up** to the nearest pack:

```
packs = ceil(effective_qty / pack_size)
cost  = packs x unit_cost_per_pack
```

**Example:** 3,568 screws with pack_size = 100:
```
ceil(3,568 / 100) = 36 packs
```

Leave pack_size blank for items priced per unit (no rounding).

### Sections

Line items can be grouped into **sections** for organized cost reporting. Sections appear as header rows in the grid with subtotals for materials and labour.

Typical sections for a wall condition:
- `01001` — Internal Framing
- `01002` — Internal Sheeting
- `01003` — Fixings & Setting
- `01005` — Insulation
- `01010` — Sealant & Finishing

Sections are optional — items without a section go under "Unsectioned".

---

## How Costs Are Calculated

### Material Line Items

Each material line follows this sequence:

```
1. base_qty     = Qty1 (primary), Qty2 (secondary), or fixed amount
2. line_qty     = if OC set: (base_qty / oc_spacing) x layers
                  else:       base_qty x layers
3. effective_qty = line_qty x (1 + waste% / 100)
4. unit_cost    = from linked MaterialItem (location-override or base) or manually entered
5. material_cost = if pack_size set: ceil(effective_qty / pack_size) x unit_cost
                   else:             effective_qty x unit_cost
```

### Labour Line Items

Each labour line follows this sequence:

```
1. base_qty      = Qty1, Qty2, or fixed (same as materials)
2. line_qty      = if OC set: (base_qty / oc_spacing) x layers
                   else:       base_qty x layers
3. effective_qty = line_qty x (1 + waste% / 100)
4. hours         = effective_qty / production_rate
5. labour_cost   = hours x hourly_rate
```

The **Lab Cost** column in the grid shows `hourly_rate / production_rate` — this is the cost per unit of work (e.g. $16/m2).

### Full Formula

```
CONDITION TOTAL = sum of all material line costs + sum of all labour line costs
```

The footer also shows **cost per unit** by dividing totals by Qty1 — useful for benchmarking against known m2 rates.

---

## Worked Example — PT05b Party Wall

### Condition Setup

**PT05b** is a 92mm acoustic partition with:
- Both sides: 1x 16mm TruRock + 1x 16mm Fire-Rated board
- 75mm glasswool insulation to cavity
- 2800mm height to underside of slab

**Measurement quantities:**
- Qty1 (area) = **1,359 m2**
- Qty2 (perimeter) = **485 m**
- Height = **2.8 m**

### Line-by-Line Breakdown

#### Section: 01001 — Internal Framing

| # | Type | Item | Qty Source | OC | Layers | Qty | Cost | Total |
|---|------|------|-----------|-----|--------|-----|------|-------|
| 1 | Labour | Frame Partition | Qty1 (1,359) | — | 1 | 1,359 m2 | $96/hr at 6 m2/hr = $16/m2 | **$21,744** |
| 2 | Material | Deflection Head Track | Qty2 (485) | — | 1 | 485 m | $4.43/m | **$2,149** |
| 3 | Material | Wall Track | Qty2 (485) | — | 1 | 485 m | $3.99/m | **$1,935** |
| 5 | Material | Studs 92mm | Qty1 (1,359) | 0.4m | 1 | 3,398 | $7.47/m | **$25,380** |

**How the studs calculation works step by step:**
```
base_qty  = 1,359 m2       ← primary quantity (area)
line_qty  = 1,359 / 0.4    ← divide by 400mm OC spacing
          = 3,397.5 studs
x layers  = 3,397.5 x 1    ← 1 layer (studs on one side)
          = 3,397.5
cost      = 3,397.5 x $7.47 = $25,379
```

#### Section: 01002 — Internal Sheeting

| # | Type | Item | Qty Source | OC | Layers | Qty | Cost | Total |
|---|------|------|-----------|-----|--------|-----|------|-------|
| 7 | Labour | Sheet Dense PB | Qty1 (1,359) | — | 4 | 5,436 m2 | $91.20/hr at 12 m2/hr = $7.60/m2 | **$41,314** |
| 8 | Material | Fire-Rated Board | Qty1 (1,359) | — | 2 | 2,718 m2 | $8.22/m2 | **$22,342** |
| 9 | Material | Acoustic Board | Qty1 (1,359) | — | 2 | 2,718 m2 | $16.76/m2 | **$45,554** |

**Why 4 layers for labour but 2 for each board:**
- The partition has **2 different boards** (fire-rated + acoustic) on **2 sides** = 4 layers of board total
- Each board type is a separate line with 2 layers (one per side)
- Labour sheets all 4 layers, so the labour line uses layers = 4

#### Section: 01003 — Fixings & Setting

| # | Type | Item | Qty Source | OC | Layers | Qty | Cost | Total |
|---|------|------|-----------|-----|--------|-----|------|-------|
| 4 | Material | Concrete Screws | Qty2 (485) | 0.6m | 2 | 1,617 | $0.53/ea | **$860** |
| 6 | Material | SDS Screws | Qty2 (485) | 0.4m | 2 | 2,425 | $0.024/ea | **$59** |
| 10 | Material | PB Screws | Qty1 (1,359) | — | 4 | 5,436 m2 | $0.174/m2 | **$946** |
| 11 | Labour | Set & Finish L4 | Qty1 (1,359) | — | 2 | 2,718 m2 | $87/hr at 15 m2/hr = $5.80/m2 | **$15,744** |
| 12 | Material | Tape & Compound | Qty1 (1,359) | — | 2 | 2,718 m2 | $0.77/m2 | **$2,093** |

**How the concrete screws work:**
```
base_qty  = 485 m           ← secondary quantity (perimeter — track length)
line_qty  = 485 / 0.6       ← screws every 600mm
          = 808
x layers  = 808 x 2         ← 2 layers (top track + bottom track)
          = 1,617 screws
cost      = 1,617 x $0.53   = $860
```

#### Section: 01010 — Sealant

| # | Type | Item | Qty Source | OC | Layers | Qty | Cost | Total |
|---|------|------|-----------|-----|--------|-----|------|-------|
| 13 | Labour | Install Sealant | Qty2 (485) | — | 8 | 3,880 m | $89.10/hr at 33 m/hr = $2.70/m | **$10,479** |
| 14 | Material | Sealant | Qty2 (485) | — | 8 | 3,880 m | $4.92/m | **$19,090** |

**Why 8 layers:** 2 boards x 2 sides x 2 edges (top and bottom of each board) = 8 runs of sealant around the perimeter.

#### Section: 01005 — Insulation

| # | Type | Item | Qty Source | OC | Layers | Qty | Cost | Total |
|---|------|------|-----------|-----|--------|-----|------|-------|
| 15 | Labour | Install Insulation | Qty1 (1,359) | — | 1 | 1,359 m2 | $89.10/hr at 33 m2/hr = $2.70/m2 | **$3,669** |
| 16 | Material | Glasswool 75mm | Qty1 (1,359) | — | 1 | 1,359 m2 | $3.79/m2 | **$5,151** |

#### Condition Total

| | Materials | Labour | Total |
|---|----------|--------|-------|
| **Total** | $125,559 | $92,950 | **$218,509** |
| **Per m2** | $92.39 | $68.40 | **$160.79** |

---

## End User Guide

### Creating a Detailed Condition

1. Go to a location's takeoff page
2. Click **Create Condition**
3. Fill in the basics: name, type (area/linear/count), colour, height
4. Set **Pricing Method** to **"Detailed"**
5. Save the condition
6. The **Line Items** tab will appear — this is where you build the pricing

### The Line Items Grid

The grid is a compact spreadsheet with these columns:

| Column | What It Shows |
|--------|--------------|
| **#** | Row number |
| **Sect** | Section code (editable inline) |
| **Item** | Material or labour cost code (read-only — set via edit panel) |
| **Description** | Item description |
| **LCC** | Labour cost code — only shown for labour rows (blue text) |
| **OC** | On-centre spacing in metres (editable) |
| **Lyr** | Layer count (editable) |
| **Size** | Condition height (read-only, from condition settings) |
| **Qty** | Calculated quantity (read-only — computed from Qty1/Qty2 x OC x layers x waste) |
| **Per** | Unit of measure (editable) |
| **Mat Cost** | Unit cost for materials (editable), or blank for labour rows |
| **Lab Cost** | Cost per unit for labour (hourly_rate / production_rate), blank for material rows |
| **Mat Total** | Line total for material items (green) |
| **Lab Total** | Line total for labour items (pink) |
| **Item Total** | Combined line total (amber) |

At the top, a header bar shows:
- **Qty1** — aggregate primary quantity from all measurements using this condition
- **Qty2** — aggregate secondary quantity (perimeter)
- **H** — condition height

If no measurements exist yet, quantities will be zero and cost columns will be empty.

### Adding Line Items

**From the bottom action bar:**
- **+ Material** — adds a blank material row (no section)
- **+ Labour** — adds a blank labour row (no section)
- **+ Section** — prompts for a section name, then adds a blank row in that section

**From a section header:**
- **+Mat** — adds a material row under that section
- **+Lab** — adds a labour row under that section

After adding, the **edit panel** opens for that row so you can link a material or labour code.

### Editing a Line Item

Click the **pencil icon** on any row to open the inline edit panel. It has two columns:

**Left side — Identity:**
- **Material/Labour picker** — search and link a material item or labour cost code from the database
- **Code** — item code (auto-filled from linked item, or type manually)
- **Description** — item description (auto-filled or manual)
- **Section** — which section this row belongs to

**Right side — Quantity & Cost:**
- **Qty Source** — Primary (Qty1), Secondary (Qty2), or Fixed
- **Fixed Qty** — only visible when source is Fixed
- **OC** — on-centre spacing in metres
- **Layers** — layer multiplier
- **Waste %** — waste percentage
- **UOM** — unit of measure label (m, m2, EA, etc.)

For **material rows:**
- **Unit Cost** — dollar cost per unit
- **Cost Source** — "From Material" (uses the linked material item's price, with location overrides) or "Manual" (use the entered unit cost)
- **Pack Size** — if set, quantities are rounded up to whole packs

For **labour rows:**
- **$/hr** — hourly rate
- **Prod Rate** — production rate (units per hour)
- **Lab Cost** — calculated cost per unit (read-only display)

### Sections

Sections group line items for organized reporting. Each section shows:
- A coloured header row with the section name
- Subtotals for materials, labour, and combined
- Quick-add buttons for materials and labour within that section

Section names typically follow a numbered convention (01001, 01002, etc.) but can be any text.

### Reading the Grid

- **Material rows** have a white background
- **Labour rows** have a light blue background
- **Section headers** have a light amber background
- The **footer** shows overall totals and per-unit rates (total / Qty1)
- An **"Unsaved"** indicator appears when changes haven't been saved

### Saving

Click the **Save** button in the bottom-right corner. This sends all line items as a batch to the server — items are upserted (created or updated) and any removed rows are deleted.

---

## Infrastructure

### Data Model

#### TakeoffCondition (`takeoff_conditions` table)

When `pricing_method = 'detailed'`, the condition uses `ConditionLineItem` records instead of `TakeoffConditionMaterial` or `TakeoffConditionCostCode`.

Key fields specific to detailed mode:
- `pricing_method` — must be `'detailed'`
- `height` — used for display in the grid (Size column)

#### ConditionLineItem (`condition_line_items` table)

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `takeoff_condition_id` | FK | Parent condition |
| `sort_order` | int | Display order |
| `section` | string, nullable | Section grouping label |
| `entry_type` | enum | `'material'` or `'labour'` |
| `material_item_id` | FK, nullable | Linked material from item master |
| `labour_cost_code_id` | FK, nullable | Linked labour cost code |
| `item_code` | string, nullable | Display code (auto or manual) |
| `description` | string, nullable | Display description (auto or manual) |
| `qty_source` | enum | `'primary'`, `'secondary'`, or `'fixed'` |
| `fixed_qty` | decimal, nullable | Used when qty_source = 'fixed' |
| `oc_spacing` | decimal, nullable | On-centre spacing in metres |
| `layers` | int, default 1 | Layer multiplier |
| `waste_percentage` | decimal, default 0 | Waste factor (0-100) |
| `unit_cost` | decimal, nullable | Material cost per unit |
| `cost_source` | enum | `'material'` (from linked item) or `'manual'` |
| `pack_size` | int, nullable | Round-up pack quantity |
| `hourly_rate` | decimal, nullable | Labour hourly rate |
| `production_rate` | decimal, nullable | Labour units per hour |
| `uom` | string, nullable | Unit of measure label |

**Indexes:**
- Composite index on `(takeoff_condition_id, sort_order)` for efficient ordered retrieval
- Cascading delete when parent condition is deleted

### API Endpoints

All endpoints require authentication and `takeoff.view` or `takeoff.edit` permission.

#### List Line Items

```
GET /locations/{locationId}/takeoff-conditions/{conditionId}/line-items
```

Returns all line items for a condition, ordered by `sort_order`, with linked `materialItem` and `labourCostCode` relations. Material items include `effective_unit_cost` (location-specific override if set).

#### Batch Upsert Line Items

```
POST /locations/{locationId}/takeoff-conditions/{conditionId}/line-items/batch
```

Full replacement of all line items. Accepts an `items` array — each item with an `id` is updated, new items (no `id`) are created, and any existing items not in the payload are deleted.

**Request body:**
```json
{
  "items": [
    {
      "id": null,
      "sort_order": 0,
      "section": "01001",
      "entry_type": "material",
      "material_item_id": 42,
      "item_code": "RON_496",
      "description": "92mm Wall Track",
      "qty_source": "secondary",
      "fixed_qty": null,
      "oc_spacing": null,
      "layers": 1,
      "waste_percentage": 5,
      "unit_cost": 3.99,
      "cost_source": "manual",
      "uom": "m",
      "pack_size": null,
      "hourly_rate": null,
      "production_rate": null
    }
  ]
}
```

**Response:** Returns `{ line_items: [...] }` with the saved items including their new IDs.

#### Supporting Search Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /locations/{id}/material-items/search?q=...` | Search materials — returns `effective_unit_cost` with location overrides |
| `GET /locations/{id}/labour-cost-codes/search?q=...` | Search labour codes — returns `default_hourly_rate` and `default_production_rate` |

### Cost Calculator

`App\Services\TakeoffCostCalculator::compute(DrawingMeasurement)` dispatches to `computeDetailed()` when the condition's pricing method is `'detailed'`.

The calculator:
1. Loads all line items with their linked material items
2. For each line, resolves the base quantity from the measurement's `computed_value` (primary), `perimeter_value` (secondary), or `fixed_qty`
3. Applies OC spacing, layers, and waste
4. For materials: looks up location-specific pricing override, applies pack-size rounding
5. For labour: computes hours from production rate, multiplies by hourly rate
6. Returns `{ material_cost, labour_cost, total_cost }`

### Key Files

| File | Purpose |
|------|---------|
| `app/Models/TakeoffCondition.php` | Condition model with `lineItems` relationship |
| `app/Models/ConditionLineItem.php` | Line item model |
| `app/Services/TakeoffCostCalculator.php` | Cost calculation engine |
| `app/Http/Controllers/TakeoffConditionController.php` | CRUD + batch line item endpoints |
| `resources/js/components/condition-detail-grid.tsx` | Spreadsheet UI component |
| `resources/js/components/condition-manager.tsx` | Parent component with pricing method selector |
| `database/migrations/2026_02_21_000001_create_condition_line_items_table.php` | Table migration |
| `database/seeders/PT05bDetailedConditionSeeder.php` | Example seeder for a full condition |

---

## Comparison — Unit Rate vs Build-Up vs Detailed

| Aspect | Unit Rate | Build-Up | Detailed |
|--------|-----------|----------|----------|
| **Best for** | Known m2/m rates | Standard material + labour breakdown | Full QuickBid-style estimates |
| **Data source** | `takeoff_condition_cost_codes` | `takeoff_condition_materials` | `condition_line_items` |
| **Qty sources** | One (measured value x height) | One (measured value) | Multiple per line (Qty1, Qty2, fixed) |
| **OC spacing** | No | No | Yes, per line item |
| **Layers** | No | No | Yes, per line item |
| **Waste %** | No | Per material | Per line item |
| **Pack rounding** | No | No | Yes, per line item |
| **Labour** | Single flat rate per unit | Single production rate + hourly rate | Per-line hourly rate + production rate |
| **Sections** | No | No | Yes |
| **Complexity** | Low | Medium | High |
| **Setup time** | 1 minute | 5 minutes | 15-30 minutes (but reusable) |
