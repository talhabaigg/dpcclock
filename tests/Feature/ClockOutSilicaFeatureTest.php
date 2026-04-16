<?php

use App\Models\Clock;
use App\Models\Employee;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\SilicaEntry;
use App\Support\FeatureFlags;
use Carbon\Carbon;

function createClockOutContext(): array
{
    $employee = Employee::create([
        'name' => 'Test Worker',
        'email' => 'worker@example.com',
        'eh_employee_id' => 'EH-1001',
        'external_id' => 'EMP-1001',
        'pin' => '1234',
    ]);

    $kiosk = Kiosk::create([
        'eh_kiosk_id' => '1001',
        'eh_location_id' => 'LOC-PARENT',
        'name' => 'Test Kiosk',
    ]);

    Location::create([
        'name' => 'Test Task Location',
        'eh_location_id' => 'LOC-CHILD',
        'eh_parent_id' => 'LOC-PARENT',
        'external_id' => 'L1-A1',
    ]);

    Clock::create([
        'eh_kiosk_id' => $kiosk->eh_kiosk_id,
        'eh_employee_id' => $employee->eh_employee_id,
        'clock_in' => Carbon::parse('2026-04-16 06:00:00', 'Australia/Brisbane'),
    ]);

    return [$employee, $kiosk];
}

test('clock out succeeds without silica payload when kiosk silica question is disabled', function () {
    FeatureFlags::set(FeatureFlags::KIOSK_SILICA_QUESTION, false);

    [$employee, $kiosk] = createClockOutContext();

    $response = $this
        ->withSession([
            'kiosk_access' => [
                'kiosk_id' => $kiosk->id,
                'validated_at' => now(),
                'expires_at' => now()->addHour(),
            ],
        ])
        ->post(route('clocks.out'), [
            'employeeId' => $employee->id,
            'kioskId' => $kiosk->id,
            'entries' => [[
                'level' => 'L1',
                'activity' => 'A1',
                'clockIn' => '06:00',
                'clockOut' => '14:00',
                'duration' => 8,
            ]],
            'safety_concern' => false,
        ]);

    $response->assertRedirect(route('kiosks.show', $kiosk->id));
    $response->assertSessionHas('success', 'Clocked out successfully.');

    expect(SilicaEntry::count())->toBe(0);

    $clock = Clock::first();
    expect(Carbon::parse($clock->clock_out, 'Australia/Brisbane')->format('H:i'))->toBe('14:00')
        ->and((float) $clock->hours_worked)->toBe(8.0);
});

test('clock out stores silica entry when kiosk silica question is enabled', function () {
    FeatureFlags::set(FeatureFlags::KIOSK_SILICA_QUESTION, true);

    [$employee, $kiosk] = createClockOutContext();

    $response = $this
        ->withSession([
            'kiosk_access' => [
                'kiosk_id' => $kiosk->id,
                'validated_at' => now(),
                'expires_at' => now()->addHour(),
            ],
        ])
        ->post(route('clocks.out'), [
            'employeeId' => $employee->id,
            'kioskId' => $kiosk->id,
            'entries' => [[
                'level' => 'L1',
                'activity' => 'A1',
                'clockIn' => '06:00',
                'clockOut' => '14:00',
                'duration' => 8,
            ]],
            'safety_concern' => false,
            'silica' => [
                'performed' => true,
                'tasks' => ['Cutting'],
                'duration_minutes' => 120,
                'swms_compliant' => true,
                'respirator_type' => 'P2',
            ],
        ]);

    $response->assertRedirect(route('kiosks.show', $kiosk->id));
    $response->assertSessionHas('success', 'Clocked out successfully.');

    expect(SilicaEntry::count())->toBe(1);

    $entry = SilicaEntry::first();
    expect($entry->employee_id)->toBe($employee->id)
        ->and($entry->performed)->toBeTrue()
        ->and($entry->tasks)->toBe(['Cutting'])
        ->and($entry->duration_minutes)->toBe(120)
        ->and($entry->swms_compliant)->toBeTrue()
        ->and($entry->respirator_type)->toBe('P2');
});
