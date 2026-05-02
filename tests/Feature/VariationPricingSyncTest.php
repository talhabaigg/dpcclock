<?php

use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\Location;
use App\Models\TakeoffCondition;
use App\Models\User;
use App\Models\Variation;
use App\Models\VariationPricingItem;
use App\Services\VariationPricingSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->actingAs(User::factory()->create());
});

function makeSyncSetup(): array
{
    $location = Location::create([
        'name' => 'Test project',
        'eh_location_id' => 'EH-'.uniqid(),
    ]);

    $drawing = Drawing::create([
        'project_id' => $location->id,
        'sheet_number' => 'A-100',
        'status' => 'active',
    ]);

    $variation = Variation::create([
        'co_number' => 'CO-'.uniqid(),
        'type' => 'change order',
        'description' => 'Test variation',
        'status' => 'draft',
        'co_date' => now(),
        'location_id' => $location->id,
        'drawing_id' => $drawing->id,
    ]);

    $condition = TakeoffCondition::create([
        'location_id' => $location->id,
        'name' => 'Stud wall + 1L plasterboard',
        'type' => 'linear',
        'color' => '#ff0000',
        'pricing_method' => 'unit_rate',
    ]);

    return compact('location', 'drawing', 'variation', 'condition');
}

function makeMeasurement(array $extra = []): DrawingMeasurement
{
    $defaults = [
        'name' => 'Wall',
        'type' => 'linear',
        'color' => '#ff0000',
        'points' => [],
        'computed_value' => 10.0,
        'unit' => 'm',
        'scope' => 'takeoff',
        'labour_cost' => 0,
        'material_cost' => 0,
        'total_cost' => 0,
    ];

    return DrawingMeasurement::create(array_merge($defaults, $extra));
}

it('creates an aggregated auto-row when a variation measurement with a condition is added', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 8.2,
        'labour_cost' => 100,
        'material_cost' => 50,
        'total_cost' => 150,
    ]);

    $rows = VariationPricingItem::where('variation_id', $variation->id)->get();
    expect($rows)->toHaveCount(1);
    $row = $rows->first();
    expect($row->source)->toBe('measurement');
    expect($row->takeoff_condition_id)->toBe($condition->id);
    expect($row->drawing_measurement_id)->toBeNull();
    expect((float) $row->qty)->toBe(8.2);
    expect((float) $row->labour_cost)->toBe(100.0);
    expect((float) $row->material_cost)->toBe(50.0);
});

it('aggregates multiple measurements with the same condition into one row', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 8.2,
        'labour_cost' => 100,
        'material_cost' => 50,
        'total_cost' => 150,
    ]);

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 4.5,
        'labour_cost' => 60,
        'material_cost' => 30,
        'total_cost' => 90,
    ]);

    $rows = VariationPricingItem::where('variation_id', $variation->id)->get();
    expect($rows)->toHaveCount(1);
    $row = $rows->first();
    expect((float) $row->qty)->toBe(12.7);
    expect((float) $row->labour_cost)->toBe(160.0);
    expect((float) $row->material_cost)->toBe(80.0);
});

it('creates separate aggregated rows for different conditions', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition, 'location' => $location] = makeSyncSetup();

    $secondCondition = TakeoffCondition::create([
        'location_id' => $location->id,
        'name' => 'Acoustic wall',
        'type' => 'linear',
        'color' => '#00ff00',
        'pricing_method' => 'unit_rate',
    ]);

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 8.0,
    ]);

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $secondCondition->id,
        'computed_value' => 3.0,
    ]);

    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(2);
});

it('updates aggregated row when a measurement is updated', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 8.2,
        'labour_cost' => 100,
    ]);

    $m->update(['computed_value' => 12.5, 'labour_cost' => 150]);

    $row = VariationPricingItem::where('variation_id', $variation->id)->first();
    expect((float) $row->qty)->toBe(12.5);
    expect((float) $row->labour_cost)->toBe(150.0);
});

it('deletes aggregated row when its only measurement is soft-deleted', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 8.2,
    ]);

    $m->delete();

    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(0);
});

it('recreates aggregated row when measurement is restored', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 8.2,
    ]);

    $m->delete();
    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(0);

    $m->restore();
    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(1);
});

it('subtracts deduction children from parent in aggregated row', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $parent = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 10.0,
        'labour_cost' => 100,
        'material_cost' => 50,
        'total_cost' => 150,
    ]);

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 2.0,
        'labour_cost' => 20,
        'material_cost' => 10,
        'total_cost' => 30,
        'parent_measurement_id' => $parent->id,
    ]);

    $row = VariationPricingItem::where('variation_id', $variation->id)
        ->whereNull('drawing_measurement_id')
        ->first();
    expect((float) $row->qty)->toBe(8.0);
    expect((float) $row->labour_cost)->toBe(80.0);
    expect((float) $row->material_cost)->toBe(40.0);
});

it('creates an unpriced auto-row for a variation measurement with no condition', function () {
    ['drawing' => $drawing, 'variation' => $variation] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'name' => 'Unknown wall',
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => null,
        'computed_value' => 5.5,
        'unit' => 'm',
    ]);

    $row = VariationPricingItem::where('variation_id', $variation->id)->first();
    expect($row->source)->toBe('measurement');
    expect($row->takeoff_condition_id)->toBeNull();
    expect($row->drawing_measurement_id)->toBe($m->id);
    expect($row->description)->toBe('Unknown wall');
    expect((float) $row->qty)->toBe(5.5);
    expect($row->unit)->toBe('m');
    expect((float) $row->labour_cost)->toBe(0.0);
    expect((float) $row->material_cost)->toBe(0.0);
});

it('preserves user-entered costs on unpriced row across measurement updates', function () {
    ['drawing' => $drawing, 'variation' => $variation] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'computed_value' => 5.5,
    ]);

    $row = VariationPricingItem::where('variation_id', $variation->id)->first();
    $row->update(['labour_cost' => 200, 'material_cost' => 75, 'total_cost' => 275]);

    $m->update(['computed_value' => 7.8]);

    $row->refresh();
    expect((float) $row->qty)->toBe(7.8);
    expect((float) $row->labour_cost)->toBe(200.0);
    expect((float) $row->material_cost)->toBe(75.0);
    expect((float) $row->total_cost)->toBe(275.0);
});

it('swaps unpriced row to aggregated when condition is assigned', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'computed_value' => 5.5,
    ]);

    expect(VariationPricingItem::where('variation_id', $variation->id)->whereNotNull('drawing_measurement_id')->count())->toBe(1);

    $m->update(['takeoff_condition_id' => $condition->id]);

    $rows = VariationPricingItem::where('variation_id', $variation->id)->get();
    expect($rows)->toHaveCount(1);
    expect($rows->first()->drawing_measurement_id)->toBeNull();
    expect($rows->first()->takeoff_condition_id)->toBe($condition->id);
});

it('swaps aggregated back to unpriced when condition is removed', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
        'labour_cost' => 100,
    ]);

    $m->update(['takeoff_condition_id' => null, 'labour_cost' => 0, 'material_cost' => 0, 'total_cost' => 0]);

    $rows = VariationPricingItem::where('variation_id', $variation->id)->get();
    expect($rows)->toHaveCount(1);
    expect($rows->first()->drawing_measurement_id)->toBe($m->id);
    expect($rows->first()->takeoff_condition_id)->toBeNull();
    expect((float) $rows->first()->labour_cost)->toBe(0.0);
});

it('removes auto-rows when scope flips from variation to takeoff', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
    ]);

    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(1);

    $m->update(['scope' => 'takeoff']);

    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(0);
});

it('skips sync when variation is locked in Premier', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();
    $variation->update(['premier_co_id' => 'PREMIER-123']);

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
    ]);

    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(0);
});

it('does not create auto-rows for takeoff-scope measurements', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'takeoff',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
    ]);

    expect(VariationPricingItem::where('variation_id', $variation->id)->count())->toBe(0);
});

it('adopts a pre-existing manual row when measurements arrive for the same condition', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    $manual = VariationPricingItem::create([
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'source' => 'manual',
        'description' => 'Manual entry',
        'qty' => 99,
        'unit' => 'EA',
        'labour_cost' => 999,
        'material_cost' => 0,
        'total_cost' => 999,
        'sell_rate' => 12.34,
        'sell_total' => 99 * 12.34,
        'sort_order' => 100,
    ]);

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
        'labour_cost' => 50,
        'material_cost' => 25,
        'total_cost' => 75,
    ]);

    $rows = VariationPricingItem::where('variation_id', $variation->id)->get();
    expect($rows)->toHaveCount(1);

    $adopted = $rows->first();
    expect($adopted->id)->toBe($manual->id);
    expect($adopted->source)->toBe('measurement');
    expect((float) $adopted->qty)->toBe(5.5);
    expect((float) $adopted->labour_cost)->toBe(50.0);
    expect((float) $adopted->material_cost)->toBe(25.0);
    expect((float) $adopted->sell_rate)->toBe(12.34); // preserved
});

it('merges duplicate manual rows into the existing auto-row on next sync', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    // First create the measurement so an auto-row exists.
    $m = makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
        'labour_cost' => 50,
    ]);

    $autoRow = VariationPricingItem::where('variation_id', $variation->id)->first();
    expect($autoRow->source)->toBe('measurement');

    // Now simulate the variation 190 scenario: a stale manual row for the same condition.
    VariationPricingItem::create([
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'source' => 'manual',
        'description' => 'Stale duplicate',
        'qty' => 99,
        'unit' => 'EA',
        'labour_cost' => 999,
        'material_cost' => 0,
        'total_cost' => 999,
        'sell_rate' => 50,
        'sell_total' => 4950,
        'sort_order' => 999,
    ]);

    // Trigger a sync (e.g. user clicks "Refresh from measurements")
    app(\App\Services\VariationPricingSyncService::class)->syncVariation($variation->id);

    $rows = VariationPricingItem::where('variation_id', $variation->id)->get();
    expect($rows)->toHaveCount(1);
    $row = $rows->first();
    expect($row->id)->toBe($autoRow->id);
    expect($row->source)->toBe('measurement');
    expect((float) $row->sell_rate)->toBe(50.0); // adopted from the deleted duplicate
});

it('syncVariation rebuilds all auto-rows for a variation', function () {
    ['drawing' => $drawing, 'variation' => $variation, 'condition' => $condition] = makeSyncSetup();

    makeMeasurement([
        'drawing_id' => $drawing->id,
        'scope' => 'variation',
        'variation_id' => $variation->id,
        'takeoff_condition_id' => $condition->id,
        'computed_value' => 5.5,
        'labour_cost' => 50,
    ]);

    // Tamper with the auto-row directly to simulate drift
    $row = VariationPricingItem::where('variation_id', $variation->id)->first();
    $row->update(['qty' => 999, 'labour_cost' => 999]);

    app(VariationPricingSyncService::class)->syncVariation($variation->id);

    $row->refresh();
    expect((float) $row->qty)->toBe(5.5);
    expect((float) $row->labour_cost)->toBe(50.0);
});
