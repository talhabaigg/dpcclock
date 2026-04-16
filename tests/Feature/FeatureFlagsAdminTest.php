<?php

use App\Models\User;
use App\Support\FeatureFlags;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

beforeEach(function () {
    app(PermissionRegistrar::class)->forgetCachedPermissions();
});

test('authorized user can view the feature flags page', function () {
    $permission = Permission::create([
        'name' => 'feature-flags.manage',
        'guard_name' => 'web',
    ]);

    $user = User::factory()->create();
    $user->givePermissionTo($permission);

    $response = $this->actingAs($user)->get(route('admin.feature-flags.index'));

    $response->assertOk();
    $response->assertSee('Kiosk Silica Question');
    $response->assertSee('kiosk-silica-question');
});

test('authorized user can toggle a feature flag', function () {
    $permission = Permission::create([
        'name' => 'feature-flags.manage',
        'guard_name' => 'web',
    ]);

    $user = User::factory()->create();
    $user->givePermissionTo($permission);

    FeatureFlags::set(FeatureFlags::KIOSK_SILICA_QUESTION, false);

    $response = $this
        ->actingAs($user)
        ->from(route('admin.feature-flags.index'))
        ->put(route('admin.feature-flags.update', FeatureFlags::KIOSK_SILICA_QUESTION), [
            'active' => true,
        ]);

    $response->assertRedirect(route('admin.feature-flags.index'));

    expect(FeatureFlags::active(FeatureFlags::KIOSK_SILICA_QUESTION))->toBeTrue();
});
