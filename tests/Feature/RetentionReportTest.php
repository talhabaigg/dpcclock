<?php

use App\Models\ArPostedInvoice;
use App\Models\ArProgressBillingSummary;
use App\Models\JobRetentionSetting;
use App\Models\JobSummary;
use App\Models\Location;
use App\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function () {
    app(PermissionRegistrar::class)->forgetCachedPermissions();

    Permission::create(['name' => 'reports.retention', 'guard_name' => 'web']);
    Permission::create(['name' => 'reports.retention.edit', 'guard_name' => 'web']);
    Permission::create(['name' => 'locations.view-all', 'guard_name' => 'web']);
});

function createJobWithRetention(array $overrides = []): array
{
    $defaults = [
        'job_number' => 'JOB-001',
        'job_name' => 'Test Project',
        'eh_parent_id' => '1249093',
        'current_estimate_revenue' => 1000000,
        'estimated_end_date' => '2026-06-30',
        'retainage_to_date' => 25000,
        'customer_name' => 'Test Customer',
        'manual_retention_held' => null,
    ];

    $data = array_merge($defaults, $overrides);

    $location = Location::create([
        'name' => $data['job_name'],
        'external_id' => $data['job_number'],
        'eh_location_id' => 'EH-' . $data['job_number'] . '-' . uniqid(),
        'eh_parent_id' => $data['eh_parent_id'],
    ]);

    $jobSummary = JobSummary::create([
        'job_number' => $data['job_number'],
        'company_code' => 'TEST',
        'current_estimate_revenue' => $data['current_estimate_revenue'],
        'estimated_end_date' => $data['estimated_end_date'],
    ]);

    ArProgressBillingSummary::create([
        'job_number' => $data['job_number'],
        'retainage_to_date' => $data['retainage_to_date'],
        'active' => true,
    ]);

    ArPostedInvoice::create([
        'job_number' => $data['job_number'],
        'contract_customer_name' => $data['customer_name'],
    ]);

    if ($data['manual_retention_held'] !== null) {
        JobRetentionSetting::create([
            'job_number' => $data['job_number'],
            'manual_retention_held' => $data['manual_retention_held'],
        ]);
    }

    return compact('location', 'jobSummary');
}

test('unauthorized user cannot access retention report', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertForbidden();
});

test('authorized user can view retention report', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention();

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('reports/retention')
        ->has('retentionData', 1)
        ->has('companies')
        ->has('filters')
    );
});

test('retention calculations are correct', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'current_estimate_revenue' => 2000000,
        'retainage_to_date' => 50000,
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('reports/retention')
        ->has('retentionData', 1, fn ($row) => $row
            ->where('revised_contract_value', 2000000)
            ->where('retention_5pct', 100000)
            ->where('retention_2_5pct', 50000)
            ->where('current_cash_holding', 50000)
            ->where('first_release_amount', 50000)
            ->where('second_release_amount', 50000)
            ->etc()
        )
    );
});

test('release dates are calculated correctly from estimated end date', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'estimated_end_date' => '2026-06-30',
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1, fn ($row) => $row
            ->where('first_release_date', '2026-07-30')
            ->where('second_release_date', '2027-06-30')
            ->etc()
        )
    );
});

test('release dates show null when estimated end date is missing', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'estimated_end_date' => null,
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1, fn ($row) => $row
            ->where('first_release_date', null)
            ->where('second_release_date', null)
            ->etc()
        )
    );
});

test('manual retention held is additive to retainage', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'retainage_to_date' => 20000,
        'manual_retention_held' => 9000,
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1, fn ($row) => $row
            ->where('current_cash_holding', 29000)
            ->etc()
        )
    );
});

test('negative manual retention held reduces total', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'retainage_to_date' => 20000,
        'manual_retention_held' => -5000,
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1, fn ($row) => $row
            ->where('current_cash_holding', 15000)
            ->etc()
        )
    );
});

test('jobs with zero retention are excluded', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    // Job with retention - should appear
    createJobWithRetention(['job_number' => 'JOB-001', 'retainage_to_date' => 25000]);

    // Job with zero retention - should be excluded
    Location::create(['name' => 'Zero Retention Job', 'external_id' => 'JOB-002', 'eh_location_id' => 'EH-JOB-002-' . uniqid(), 'eh_parent_id' => '1249093']);
    JobSummary::create(['job_number' => 'JOB-002', 'company_code' => 'TEST', 'current_estimate_revenue' => 500000]);
    ArProgressBillingSummary::create(['job_number' => 'JOB-002', 'retainage_to_date' => 0, 'active' => true]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1)
    );
});

test('job with only manual retention and zero retainage appears', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'retainage_to_date' => 0,
        'manual_retention_held' => 15000,
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1, fn ($row) => $row
            ->where('current_cash_holding', 15000)
            ->etc()
        )
    );
});

test('company filter works correctly', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention(['job_number' => 'JOB-SWCP', 'job_name' => 'SWCP Job', 'eh_parent_id' => '1249093']);
    createJobWithRetention(['job_number' => 'JOB-GRE', 'job_name' => 'GRE Job', 'eh_parent_id' => '1198645']);

    $response = $this->actingAs($user)->get('/retention-report?company=SWCP');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1)
    );
});

test('unauthorized user cannot update manual retention', function () {
    $user = User::factory()->create();
    $user->givePermissionTo('reports.retention');

    $response = $this->actingAs($user)->post('/retention-report/manual', [
        'job_number' => 'JOB-001',
        'manual_retention_held' => 9000,
    ]);

    $response->assertForbidden();
});

test('authorized user can update manual retention', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'reports.retention.edit']);

    $response = $this->actingAs($user)->post('/retention-report/manual', [
        'job_number' => 'JOB-001',
        'manual_retention_held' => 9000,
    ]);

    $response->assertRedirect();

    $setting = JobRetentionSetting::where('job_number', 'JOB-001')->first();
    expect($setting)->not->toBeNull();
    expect((float) $setting->manual_retention_held)->toBe(9000.0);
});

test('manual retention update is logged by spatie activity log', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'reports.retention.edit']);

    $this->actingAs($user)->post('/retention-report/manual', [
        'job_number' => 'JOB-001',
        'manual_retention_held' => 5000,
    ]);

    // Update it again to trigger a change log
    $this->actingAs($user)->post('/retention-report/manual', [
        'job_number' => 'JOB-001',
        'manual_retention_held' => 9000,
    ]);

    $activities = \Spatie\Activitylog\Models\Activity::where('log_name', 'job_retention_setting')
        ->where('subject_type', JobRetentionSetting::class)
        ->get();

    expect($activities)->not->toBeEmpty();

    $lastActivity = $activities->last();
    expect($lastActivity->properties['old']['manual_retention_held'] ?? null)->not->toBeNull();
    expect($lastActivity->properties['attributes']['manual_retention_held'])->toBe('9000.00');
});

test('customer name is pulled from ar posted invoices', function () {
    $user = User::factory()->create();
    $user->givePermissionTo(['reports.retention', 'locations.view-all']);

    createJobWithRetention([
        'customer_name' => 'Acme Construction Pty Ltd',
    ]);

    $response = $this->actingAs($user)->get('/retention-report');

    $response->assertInertia(fn ($page) => $page
        ->has('retentionData', 1, fn ($row) => $row
            ->where('customer_name', 'Acme Construction Pty Ltd')
            ->etc()
        )
    );
});
