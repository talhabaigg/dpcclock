# Auto-sync variation pricing items from measurements

**Status:** proposed.

## The problem

Today, measurements and variation pricing items are completely decoupled:

- Estimator creates a variation, opens the drawing, draws walls/ceilings with a `TakeoffCondition` assigned, sets `scope='variation'` + `variation_id=X`. The measurement row gets `labour_cost`/`material_cost`/`total_cost` columns populated by [`TakeoffCostCalculator::compute()`](app/Services/TakeoffCostCalculator.php#L15).
- Then they have to open the variation's Pricing tab and **manually re-add the same condition + qty** to create a `VariationPricingItem` — which is what feeds the Premier change order export.

The variation is effectively priced twice (once on the measurement, once in the pricing tab), and the two can drift. A future thumbnail UX on the variation screen would expose this immediately: drawings full of measured walls but a Pricing tab with nothing in it.

The only writer to `variation_pricing_items` today is [`VariationController::storePricingItem()`](app/Http/Controllers/VariationController.php#L783). No observer, service, or sync path connects measurements to pricing items.

## The fix

Every measurement with `scope='variation'` should **automatically** appear in the variation's Pricing tab as an auto-row, in one of two flavours depending on whether a condition is assigned:

- **Condition-driven (aggregated):** one auto-row per `(variation_id, takeoff_condition_id)` pair — qty and costs summed across all matching measurements on all drawings in that variation. Read-only in the UI; sell_rate editable for markup.
- **Unpriced (per-measurement):** one auto-row per measurement, keyed by `(variation_id, drawing_measurement_id)`. Qty/unit/description mirrored from the measurement; **labour/material costs editable by the user** (because there's no condition to derive them from). Sell_rate editable.

If the user later assigns a condition to an unpriced measurement, the unpriced row disappears and the measurement folds into the condition-driven aggregated row. Reverse direction (condition removed) recreates the unpriced row — the user's prior cost entries on that row are lost (acceptable trade — flipping pricing models should be rare and explicit).

Manual pricing items (added through the existing Pricing tab UI for things that aren't measured — scaffolding, freight, allowances) keep working unchanged.

## Design decisions

### Aggregation keys (two flavours)

| Auto-row flavour | Key | Trigger |
|---|---|---|
| **Aggregated** | `(variation_id, takeoff_condition_id)` | measurement has condition |
| **Unpriced** | `(variation_id, drawing_measurement_id)` | measurement has no condition |

Aggregated rows match the existing manual flow (each condition → one pricing line, summed). Unpriced rows are one-to-one with measurements because there's no aggregation key — different unconditioned measurements are independent line items pending manual pricing.

### Cost aggregation: sum, don't recompute

**Aggregated (condition-driven) auto-rows:** `labour_cost` / `material_cost` = `SUM` of those columns on the underlying measurements (filtered by `variation_id` + `takeoff_condition_id`, parents only after deductions are applied — see "Deductions" below).

We do **not** call `VariationCostCalculator::compute(condition, summed_qty)` to re-derive costs. Reasons:

- `TakeoffCostCalculator::computeDetailed()` honours per-line `qty_source='secondary'` (perimeter), `oc_spacing`, `layers`, `waste_percentage`. Perimeter is a per-measurement value — once you sum qty across measurements, perimeter information is lost and re-computation would undercount any line items priced off perimeter.
- The future per-measurement `height_override` (separate plan) would also be erased by re-computing on aggregated qty.
- `DrawingMeasurement` already stores its own per-row cost columns, kept in sync by the controller. Summing them is exact.

The aggregated `qty` field on the pricing item is informational only — the costs don't depend on it.

**Unpriced (per-measurement) auto-rows:** `labour_cost` / `material_cost` are user-entered and **preserved** by the sync service across measurement updates. The sync only writes/refreshes `description`, `qty`, `unit` for unpriced rows — it never overwrites costs entered by the user. `total_cost` recomputes as `labour_cost + material_cost` on every save (whether triggered by the user editing the row or the measurement geometry changing).

### Deductions

[`TakeoffExportController:78-83`](app/Http/Controllers/TakeoffExportController.php#L78) already subtracts deduction children (`parent_measurement_id IS NOT NULL`) from parent net qty/costs. The sync must follow the same rule:

- Sum only top-level measurements (`whereNull('parent_measurement_id')`).
- For each parent, subtract its deductions' qty and costs.
- Only include parents whose `takeoff_condition_id` matches; deductions inherit the parent's condition for aggregation purposes regardless of their own (matches export behaviour — verify against export code before final implementation).

### Source flag and discriminator columns

Add a `source` enum column to `variation_pricing_items`: `'manual' | 'measurement'`, default `'manual'` for backward compatibility. Add a nullable `drawing_measurement_id` FK to support the unpriced flavour.

The two auto-row flavours are distinguished by which FK is set:

| Flavour | `source` | `takeoff_condition_id` | `drawing_measurement_id` |
|---|---|---|---|
| Manual | `manual` | optional | `NULL` |
| Aggregated | `measurement` | set | `NULL` |
| Unpriced | `measurement` | `NULL` | set |

UI/sync behaviour by flavour:

- **Manual** — fully editable, behaves exactly as today.
- **Aggregated** — `description`, `qty`, `unit`, `labour_cost`, `material_cost`, `total_cost` read-only and recomputed on every sync. `sell_rate` / `sell_total` user-editable.
- **Unpriced** — `description`, `qty`, `unit` mirrored from the measurement (read-only). `labour_cost`, `material_cost` user-entered and preserved across syncs. `total_cost` always = `labour_cost + material_cost`. `sell_rate` / `sell_total` user-editable.

DB constraint: `CHECK ((source = 'measurement' AND (takeoff_condition_id IS NOT NULL OR drawing_measurement_id IS NOT NULL)) OR source = 'manual')` to prevent malformed auto-rows.

### Locked variations

If `Variation.premier_co_id` is set (already sent to Premier), [`VariationController::assertVariationEditable()`](app/Http/Controllers/VariationController.php) blocks manual edits. The auto-sync must respect the same guard:

- Sync skips entirely when the variation is locked.
- A measurement change against a locked variation logs a warning but doesn't fail the measurement save.

This matches the existing rule that you can't edit a variation after it's gone to Premier — the snapshot stays frozen.

### Orphan cleanup and condition flips

The sync service runs per **affected key** after a measurement save/delete. "Affected keys" means the row's current `(variation_id, takeoff_condition_id, drawing_measurement_id)` plus any previous values of those fields (via `getOriginal()`), so an old row shrinks/disappears as the new one is created.

Logic per affected key:

- **Aggregated key** — if any matching measurements remain → upsert and refresh. If none → delete.
- **Unpriced key** — if the measurement still exists, has `scope='variation'`, and has no condition → upsert (refresh description/qty/unit, preserve costs). Otherwise → delete.

Transitions worth calling out:

- **Condition added to a previously unpriced measurement:** unpriced row deleted, aggregated row upserted. User-entered costs on the unpriced row are lost.
- **Condition removed from a measurement:** measurement removed from aggregated row (which may delete it if last), new unpriced row created with empty costs.
- **Scope flipped from `variation` to `takeoff`:** all auto-rows tied to that measurement disappear.
- **Variation_id changed (rare, but possible if reassigned):** old auto-rows shrink; new variation gets new rows.

### Sort order

Within the pricing tab, rows render in this order:

1. **Aggregated auto-rows** — sorted by condition `name`.
2. **Unpriced auto-rows** — sorted by measurement `created_at`.
3. **Manual rows** — sorted by `sort_order` (existing behaviour).

This makes the pricing tab feel like "what came from the drawing, priced" → "what came from the drawing, needs pricing" → "everything else added by hand."

## Schema changes

**Migration:** `add_source_and_measurement_link_to_variation_pricing_items_table`

```php
Schema::table('variation_pricing_items', function (Blueprint $table) {
    $table->enum('source', ['manual', 'measurement'])->default('manual')->after('takeoff_condition_id');
    $table->foreignId('drawing_measurement_id')
        ->nullable()
        ->after('takeoff_condition_id')
        ->constrained('drawing_measurements')
        ->nullOnDelete();
    $table->timestamp('last_synced_at')->nullable()->after('updated_at');
    $table->index(['variation_id', 'takeoff_condition_id', 'source']);
    $table->index(['variation_id', 'drawing_measurement_id']);
});
```

`nullOnDelete` on `drawing_measurement_id` is a safety net — sync should normally remove the unpriced row before the measurement hard-deletes, but if anything bypasses the observer the FK won't block the delete.

No data backfill needed for existing rows — they keep `source='manual'` and continue to work. A separate one-shot artisan command (below) lets users opt in per variation.

## New code

### `app/Services/VariationPricingSyncService.php`

```php
public function syncAggregated(int $variationId, int $conditionId): void   // upsert/delete aggregated row
public function syncUnpriced(int $variationId, int $measurementId): void   // upsert/delete unpriced row
public function syncVariation(int $variationId): void                      // re-runs every key used by this variation
public function handleMeasurementChange(
    DrawingMeasurement $measurement,
    ?int $previousVariationId,
    ?int $previousConditionId,
    ?string $previousScope,
): void
```

`handleMeasurementChange` resolves all affected keys from current + previous values:

- Current scope is `variation` and condition set → sync aggregated `(current_variation, current_condition)`.
- Current scope is `variation` and condition null → sync unpriced `(current_variation, measurement.id)`.
- Previous scope was `variation` and previous condition set → sync aggregated `(previous_variation, previous_condition)` to shrink/remove.
- Previous scope was `variation` and previous condition null → sync unpriced `(previous_variation, measurement.id)` to remove.

Each `sync*` call runs in a `DB::transaction` with `SELECT ... FOR UPDATE` on the variation row to avoid races (especially under concurrent iPad pushes). Idempotent — safe to call repeatedly.

### `app/Observers/DrawingMeasurementObserver.php`

```php
public function created(DrawingMeasurement $m)
public function updated(DrawingMeasurement $m)
public function deleted(DrawingMeasurement $m)    // soft delete
public function restored(DrawingMeasurement $m)
```

Each handler calls `VariationPricingSyncService::handleMeasurementChange()` with `getOriginal()` for previous values. Registered in `AppServiceProvider::boot()`.

The observer fires for every measurement save, but the service short-circuits when `scope !== 'variation'` or no condition is assigned, so the takeoff-only path (the existing rollout) pays effectively nothing.

### iPad sync path

[`SyncController::pushMeasurements()`](app/Http/Controllers/Api/SyncController.php#L612) writes measurements with `Model::create`/`update`, so the observer fires automatically — no extra wiring needed. Verify in feature tests.

### Artisan command (optional, for backfill)

```
php artisan variations:sync-pricing-from-measurements [--variation=ID] [--dry-run]
```

For variations created before this feature ships: re-runs the sync to populate auto-rows. Manual rows are untouched. Dry-run mode lists what would change.

## UI changes

[`resources/js/pages/variation/partials/VariationPricingTab.tsx`](resources/js/pages/variation/partials/VariationPricingTab.tsx):

Each row gets a small badge identifying its flavour: **From drawing**, **From drawing — needs pricing**, or **Manual**.

Per-flavour editability:

| Field | Aggregated | Unpriced | Manual |
|---|---|---|---|
| `description` | read-only | read-only | editable |
| `qty` | read-only | read-only | editable |
| `unit` | read-only | read-only | editable |
| `labour_cost` | read-only | **editable** | editable |
| `material_cost` | read-only | **editable** | editable |
| `total_cost` | computed | computed | computed |
| `sell_rate` / `sell_total` | editable | editable | editable |

Auto-rows (both flavours) cannot be deleted from the UI — tooltip explains "remove the underlying measurement on the drawing."

Top of tab:
- "Refresh from measurements" button → calls `syncVariation` endpoint (paranoia/manual override).
- Header summary line: "From drawing: N priced, M needs pricing · Manual: K".
- A subtle warning if any unpriced rows exist: "{M} measurements still need pricing."

No change to `ConditionPricingPanel` or the existing manual-add flow.

## Tests

`tests/Feature/VariationPricingSyncTest.php`:

**Aggregated (condition-driven) flow:**
1. Create variation + measurement with condition → aggregated auto-row exists with correct qty/costs.
2. Add second measurement (same condition) → qty + costs sum into the same row, not a new row.
3. Add measurement with different condition → second aggregated row appears.
4. Update measurement geometry → aggregated row qty/costs update.
5. Soft-delete the only measurement for a condition → aggregated row deleted.
6. Restore the measurement → aggregated row re-created.
7. Add a deduction child → parent's contribution shrinks by deduction amount in the aggregated row.

**Unpriced (no-condition) flow:**
8. Create variation + measurement with no condition → unpriced auto-row appears with mirrored description/qty/unit and `labour_cost=0`, `material_cost=0`.
9. User updates `labour_cost` and `material_cost` on unpriced row → values saved; `total_cost = labour + material`.
10. Update measurement geometry → unpriced row qty refreshes; user-entered costs preserved.
11. Update measurement `name` → unpriced row description refreshes.
12. Soft-delete unpriced measurement → unpriced row deleted.

**Transitions:**
13. Assign condition to a previously unpriced measurement → unpriced row deleted; measurement folds into aggregated row.
14. Remove condition from a measurement that was in an aggregated row → aggregated row shrinks (or deletes if last); fresh unpriced row created with empty costs (prior unpriced costs are gone — by design).
15. Change a measurement's condition from A to B → aggregated A shrinks/deletes, aggregated B grows.
16. Flip scope from `variation` to `takeoff` → all auto-rows for that measurement disappear.

**Cross-cutting:**
17. iPad push creates variation measurement (with and without condition) → correct auto-row flavour appears via `SyncController` flow.
18. Variation is locked (`premier_co_id` set) → measurement save still works, sync is skipped, no auto-row mutation.
19. Manual pricing item with same condition coexists with aggregated auto-row (both visible, separate rows by `source`).
20. Measurement with `scope='takeoff'` (not variation) → no auto-row created, even with condition assigned.
21. DB constraint: attempting to insert `source='measurement'` with both FKs null fails.

## Open questions for the user

1. **Coexistence policy**: today nothing prevents a user from adding a manual pricing item for condition X *and* having an aggregated auto-row for condition X. Both will show. Acceptable, or should manual creation block when an aggregated row already exists for the same condition? *(My recommendation: allow both, label clearly.)*
2. **Sell rate carryover (aggregated)**: if all measurements for a condition are deleted, the aggregated row disappears. If a measurement for the same condition is re-added later, the aggregated row reappears with `sell_rate=null` — previous markup is lost. *(My recommendation: keep simple, accept the loss.)*
3. **Cost preservation across condition flips (unpriced ↔ aggregated)**: removing a condition from a measurement creates a fresh unpriced row with empty costs. If the user had previously priced that measurement under an earlier unpriced row, those costs are gone. Acceptable, or worth caching the last-known unpriced costs per measurement to repopulate? *(My recommendation: accept the loss; condition flips are a deliberate restructuring action.)*
4. **Backfill**: do existing variations with measurements need the artisan command run on rollout, or is "new variations only" fine? Depends on how many variations are mid-flight when this ships.
5. **Description text on aggregated rows**: just `condition.name`, or `condition.name + " (3 measurements)"`? *(My recommendation: just the condition name; the count is noise.)*
6. **Description text on unpriced rows**: mirror the user-set measurement `name` if present; fall back to `"{type} measurement {id}"` if not. *(My recommendation; flagging because measurement names may not be required today.)*

## Out of scope

- Multi-drawing attribution (which $ came from drawing A vs B) — see the lineage discussion in `plans/drawing-project-ownership.md`. Not solved by this plan; pricing items still aggregate across drawings.
- Per-measurement height override — separate plan, but the design here is forward-compatible (sum of measurement-level costs already reflects whatever per-row inputs exist).
- Replacing or merging `TakeoffCostCalculator` and `VariationCostCalculator` — they overlap but live in different domains; this plan keeps both.
- Premier line item generation — `ChangeOrderGenerator::generateFromPricingItems()` keeps working unchanged once auto-rows exist in `variation_pricing_items`.
