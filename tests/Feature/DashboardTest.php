<?php

use App\Models\User;
use Spatie\Permission\Models\Role;
uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('guests are redirected to the login page', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

test('only users with the admin role can access the timesheets converter', function () {
    // Create the 'admin' role
    Role::create(['name' => 'admin']);

    // Create a regular user without any role
    $user = User::factory()->create();

    // Regular user should be forbidden or redirected
    $this->actingAs($user)
        ->get('/timesheets-converter')
        ->assertForbidden(); // Or ->assertRedirect('/some-page')

    // Create an admin user and assign the 'admin' role
    $admin = User::factory()->create();
    $admin->assignRole('admin');

    // Admin should have access
    $this->actingAs($admin)
        ->get('/timesheets-converter')
        ->assertOk();
});