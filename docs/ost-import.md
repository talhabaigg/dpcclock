# OST / QuickBid Import Contract

This document specifies the CSV inputs the app's three OST importers accept. The
extraction layer (parsing the OST `.ost` XML and the QuickBid `.mdb`) is **not**
part of the app — generate the CSVs externally (any tool, or by handing the OST
file plus this document to an LLM), then upload them via the existing endpoints.

## What the importers handle (so the CSV doesn't carry it)

- **Geometry scale** — takeoffs CSV passes the **raw OST `Position` string**.
  `OstPositionParser` applies the `0.0254 m / OST-unit` scale, the
  first-2-vertices rule for straight segments, and the arc-length formula for
  curves. The CSV does not carry meters.
- **Hrs-per-UOM inversion** — conditions CSV provides `LabProd_HrsPerUOM`
  verbatim from QB; the importer stores `production_rate = 1 / value`.
- **OST date parsing** — production CSV provides `WorkDate` as ISO `YYYY-MM-DD`.
  Source: `BidTimeCardState.Date` filtered to `IsValid=1`.
- **Foreign-key resolution** (area/page/condition names → DB IDs) — handled by
  the importers via name match.

## What the CSV producer must still do

Exactly one thing of substance: **BLCC-hour weighting** in the production CSV
(see §3 below). Our `measurement_statuses` schema stores one percent per
`(measurement, LCC, date)` — no per-BLCC granularity — so when OST splits an
LCC across multiple `BidLaborCostCode` rows with separate per-takeoff
percents, the producer collapses them with

```
weighted_pct = Σ (pct_BLCC × hours_BLCC) / Σ hours_BLCC
```

before emitting. Moving this into the importer would require extending the
schema; left as a future refactor.

The math behind the importers (rate calibration, geometry scale, etc.) is
fixed; everything below is the public surface they expose.

---

## 1. Takeoffs CSV → `OstTakeoffImporter`

**Endpoint:** `POST /drawings/{drawing}/import-ost-takeoffs`
**Scope:** one CSV per drawing, where each drawing corresponds to one OST
`<BidPage>`. Uploading wipes existing `scope='takeoff'` measurements on that
drawing first.

| Column | Source | Notes |
|---|---|---|
| `BidConditionUID` | `BidTakeoff.BidConditionUID` | required |
| `GUID` | `BidTakeoff.GUID` | required; importer normalises (lowercase, strips `{}`) |
| `UID` | `BidTakeoff.UID` | required |
| `ConditionName` | `BidCondition.Name` (joined via `BidConditionUID`) | required; matches `takeoff_conditions.name` |
| `CondUOM` | derived from `BidCondition.UOM1`: `0`→`SM`, `1`→`LM`, `2`→`EA` | required |
| `AreaName` | `BidArea.Name` (joined via `BidTakeoff.BidAreaUID`) | required; matches `bid_areas.name` |
| `Position` | `BidTakeoff.Position` (raw OST `x;y;...;bulge` string) | required; importer parses |
| `Curve` | `BidTakeoff.Curve` | required; `0` = curved, `-1` = straight |
| `Kind` *(optional)* | `Area` if `BidCondition.Type=2`, else `Linear` | importer auto-derives if omitted |
| `LayerName` *(optional)* | `BidLayer.Name` (joined via `BidCondition.BidLayerUID`) | category tag only |
| `ConditionType` *(optional)* | `CdnType.Name` (joined via `BidCondition.CdnTypeUID`) | UI grouping |

The importer also needs PDF user-space dimensions for the page (`pdf_width_pt`,
`pdf_height_pt`). For an OST page with `Width`/`Height` in inches, pts = inches × 72.

**Geometry: what the importer does internally** (you do not need to replicate
this — the CSV passes raw OST `Position` and `Curve` and the importer handles
the rest). Stated here only so anyone debugging stored `computed_value` knows
where the numbers come from:

- 1 OST unit = `0.72 / 28.3464566929 ≈ 0.0254 m` real-world length (OST stores
  in 0.01-inch page units, PDF pt/m = 28.3465 at A1 1:100 scale).
- Straight takeoffs (`Curve = -1`): only the **first 2 vertices** of `Position`
  are used — single segment, *not* polyline length.
- Curved takeoffs (`Curve = 0` and trailing scalar bulge ≠ 0): arc length is
  `R × sweep_angle` of the circle through V1, arc-midpoint, V2.
- Single-point takeoffs (Linear LM/EA): stored as `computed_value =
  condition.height` (or `1.0` if height is null).

---

## 2. Conditions CSV → `OstConditionsImporter`

**Endpoint:** `POST /drawings/{drawing}/import-ost-conditions`
**Scope:** one CSV per project. Replaces `condition_line_items`,
`condition_labour_codes`, and `takeoff_condition_boq_items` for each
matched condition.

| Column | Source | Notes |
|---|---|---|
| `ConditionName` | `BidConditions.Name` (QB) | required; matches by name |
| `ConditionType` | `CdnTypes.Name` via `BidConditions.CdnTypeUID` | optional |
| `CondUOM` | `BidConditions.UOM1` decoded (`SM`/`LM`/`EA`) | required |
| `CondHeight` | `BidConditions.Height` | only used when UOM=SM (wall height) |
| `Sequence` | `BidDetails.Sequence` | line ordering |
| `Code` *or* `LineLabCode` | `BidItems.Code` (mat) / `CostCodes.Name` (lab) | importer prefers `LineLabCode` for labour rows |
| `Description` | `BidItems.Description` / `CostCodes.Description` | |
| `ItemUOM` | `BidItems.UOM` decoded | per-line unit |
| `UnitMatRate` | `BidItems.MatPrice` | `>0` ⇒ material line, `0` ⇒ labour line |
| `PricedBy` | `BidItems.MatPricePer` | "priced per N units" → stored as `pack_size` |
| `LabProd_HrsPerUOM` | `BidDetails.LabProd` | hours/UOM; importer inverts → `production_rate = 1/value` |
| `SectionName` *(optional)* | `Sections.Name` via `BidDetails.SectionUID` | grouping label |
| `CondMatPerUOM` / `CondLabPerUOM` *(preferred, new format)* | per-UOM aggregates from QB | drives BoQ aggregate row |
| `CondMatTotal` / `CondLabTotal` *(legacy)* | `Σ MatPrice × Quantity` per condition | importer divides by `CdnQty` if per-UOM not provided |
| `CdnQty` *(legacy)* | `BidConditions.Quantity1` (scaled) | importer applies SM÷1e8, LM÷1e4 fallback |
| `MeasuredQty` *(preferred)* | source-of-truth qty for the per-UOM aggregate | |

---

## 3. Production CSV → `OstProductionImporter`

**Endpoint:** `POST /drawings/{drawing}/import-ost-production`
**Scope:** one CSV per project (any drawing in the project will work — matching
is location-scoped via GUIDs). Re-running is safe: `(GUID, LccCode, WorkDate)`
is the natural key, last-write-wins.

| Column | Source | Notes |
|---|---|---|
| `GUID` | `BidTakeoff.GUID` (via `BidPercent.BidTakeoffUID`) | required |
| `LccCode` | OST `CostCode.Name` (via `BidPercent.BidLaborCostCodeUID → BidLaborCostCode.CostCodeUID`) | required; matches `labour_cost_codes.code` (case-insensitive) |
| `WorkDate` | OST `BidTimeCardState.Date` (via `BidPercent.BidTimeCardStateUID`) | required; ISO `YYYY-MM-DD`, only `IsValid=1` states |
| `PercentComplete` | `BidPercent.Percent`, **BLCC-hour weighted** (see below) | required; integer 0–100 |

### Why BLCC weighting matters

OST splits one cost code (e.g. `001_INT_FRAME`) across multiple
`BidLaborCostCode` (BLCC) rows — one for top track, one for studs, etc. — and
records `BidPercent` separately per BLCC. The app stores **one** percent per
`(measurement, LCC, date)` so the extraction must collapse them:

```
weighted_pct = Σ (pct_BLCC × hours_BLCC) / Σ hours_BLCC
```

where `hours_BLCC = BidLaborActivit.Hours` for the takeoff's `BidConditionUID` × that BLCC.
**BLCCs that have no `BidPercent` row for the takeoff still contribute their hours at 0%** —
without that, takeoffs with progress on only one of three BLCCs get inflated to 100%.

### Validation the importer applies

A row is rejected if:
- `GUID` not in `drawing_measurements.ost_guid` for the project
- `LccCode` not in `labour_cost_codes` for the project's location
- `(takeoff_condition, LCC)` not present in `condition_labour_codes` (the LCC isn't
  configured for that condition — usually means the conditions CSV missed it; the
  fix is to ensure the condition has a labour activity for that LCC at import
  time)

---

## 4. Order of operations

1. **Takeoffs first** (per drawing) — stamps `ost_guid` on each measurement.
2. **Conditions** (once for the project) — populates `condition_labour_codes` so
   each condition knows which labour codes it carries and at what `production_rate`.
3. **Production** (once for the project) — applies percent_complete per (GUID,
   LCC, date). Validates against the LCC pivot from step 2.

If any step is skipped or run out of order, production rows will be rejected.

---

## 5. Earned-hours math (what the app does after import)

For each measurement × LCC pair on a given work date:

```
budget_hrs    = qty / production_rate
earned_hrs    = budget_hrs × percent / 100
```

These are summed per `(bid_area, LCC)` to produce row-level totals. The
aggregate `percent_complete` is **back-derived** as `earned_hrs / budget_hrs ×
100` — never qty-weighted, because rates vary across takeoffs in the same LCC
and the qty-weighted formula gives the wrong total under varying rates.

This is implemented in:
- `app/Http/Controllers/Traits/ProductionStatusTrait.php::buildLccSummary`
  (production page)
- `app/Http/Controllers/DrawingController.php::buildBudgetRows` (budget page)
- `app/Http/Controllers/Traits/ProductionStatusTrait.php::syncProductionToBudget`
  (the `BudgetHoursEntry` percent map written by `OstProductionImporter`)

---

## 6. Recovering production rates when the QB CSV is unreliable

If the QB-derived conditions CSV's `LabProd_HrsPerUOM` doesn't match what OST
actually allocates (e.g. QB has stale rates, or multiple `BidLaborCostCode` rows
in OST collapse into one app LCC), the standard fix is a one-off recalibration
that derives rates straight from OST's `BidLaborActivit.Hours`. Conceptually:

```
production_rate(cond, LCC) = project_qty(cond) / Σ BidLaborActivit.Hours(cond, LCC)
                                                across every BLCC mapped to LCC
```

`project_qty(cond)` is summed using the same geometry rule the takeoff importer
applies (so the app's stored `computed_value` per takeoff cancels cleanly when
budget hours are computed). For count-type conditions (every takeoff is a
single-point marker, length 0), use takeoff *count* instead of length.

The recalibration must also **create missing `condition_labour_codes` rows**
for any `(BidCondition, CostCode)` pair OST has `BidLaborActivit` for but the
app's pivot doesn't list — those gaps are the most common reason budget hours
under-count.

This is a project-setup operation, run once per imported OST file. No
in-app artisan command exists — generate the SQL externally (or via an LLM
given the OST file + this spec), review, and apply.
