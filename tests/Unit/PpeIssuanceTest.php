<?php

use App\Http\Controllers\PpeFormController;
use App\Http\Controllers\PpeRegisterController;
use App\Models\PpeIssuance;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

uses(TestCase::class);

test('it keeps a shared item reason in the compatibility summary', function () {
    $items = [
        ['key' => 'gloves', 'qty' => 2, 'reason' => 'new_starter'],
        ['key' => 'ear_plugs', 'qty' => 3, 'reason' => 'new_starter'],
    ];

    expect(PpeIssuance::summariseItemReasons($items))->toBe('new_starter');
});

test('it marks a compatibility summary when items have different reasons', function () {
    $items = [
        ['key' => 'gloves', 'qty' => 2, 'reason' => 'replacement_worn'],
        ['key' => 'ear_plugs', 'qty' => 3, 'reason' => 'new_starter'],
    ];

    expect(PpeIssuance::summariseItemReasons($items))
        ->toBe(PpeIssuance::MULTIPLE_REASONS)
        ->and(PpeIssuance::reasonLabel(PpeIssuance::MULTIPLE_REASONS))
        ->toBe('Multiple reasons');
});

test('it returns unique item reason labels', function () {
    $issuance = new PpeIssuance([
        'reason' => PpeIssuance::MULTIPLE_REASONS,
        'issued_items' => [
            ['key' => 'gloves', 'qty' => 2, 'reason' => 'replacement_worn'],
            ['key' => 'ear_plugs', 'qty' => 3, 'reason' => 'new_starter'],
            ['key' => 'safety_glasses_clear', 'qty' => 1, 'reason' => 'new_starter'],
        ],
    ]);

    expect($issuance->reason_labels)->toBe([
        'Replacement - Worn/Damaged',
        'New Starter',
    ]);
});

test('legacy items fall back to the original issuance reason', function () {
    $issuance = new PpeIssuance([
        'reason' => 'project_specific',
        'issued_items' => [
            ['key' => 'gloves', 'qty' => 1],
            ['key' => 'ear_plugs', 'qty' => 2],
        ],
    ]);

    expect($issuance->reason_labels)->toBe(['Project specific requirement']);
});

test('item normalization retains reason and removes blank optional details', function () {
    $method = new ReflectionMethod(PpeFormController::class, 'normaliseItems');
    $items = $method->invoke(new PpeFormController, [[
        'key' => 'gloves',
        'qty' => '2',
        'reason' => 'replacement_worn',
        'size' => '',
        'make_model' => '',
    ]]);

    expect($items)->toBe([[
        'key' => 'gloves',
        'qty' => 2,
        'reason' => 'replacement_worn',
    ]]);
});

test('register reason filter matches item reasons and historical parent reasons', function () {
    Schema::create('ppe_issuances', function (Blueprint $table) {
        $table->string('id')->primary();
        $table->string('reason');
        $table->json('issued_items');
        $table->softDeletes();
    });

    try {
        DB::table('ppe_issuances')->insert([
            [
                'id' => 'mixed',
                'reason' => PpeIssuance::MULTIPLE_REASONS,
                'issued_items' => json_encode([
                    ['key' => 'gloves', 'qty' => 1, 'reason' => 'replacement_worn'],
                    ['key' => 'ear_plugs', 'qty' => 1, 'reason' => 'new_starter'],
                ]),
            ],
            [
                'id' => 'legacy',
                'reason' => 'replacement_worn',
                'issued_items' => json_encode([
                    ['key' => 'gloves', 'qty' => 1],
                ]),
            ],
            [
                'id' => 'unrelated',
                'reason' => 'visitor',
                'issued_items' => json_encode([
                    ['key' => 'safety_glasses_clear', 'qty' => 1],
                ]),
            ],
        ]);

        $query = PpeIssuance::query();
        $method = new ReflectionMethod(PpeRegisterController::class, 'applyReasonFilter');
        $method->invoke(new PpeRegisterController, $query, 'replacement_worn');

        expect($query->orderBy('id')->pluck('id')->all())->toBe(['legacy', 'mixed']);
    } finally {
        Schema::dropIfExists('ppe_issuances');
    }
});
