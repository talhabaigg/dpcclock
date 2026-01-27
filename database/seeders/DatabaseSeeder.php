<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;


class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        $admin = User::factory()->create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
        ]);

        $user = User::factory()->create([
            'name' => 'User',
            'email' => 'user@example.com',
        ]);

        $this->call([
            EmployeeSeeder::class,
            RolesAndPermissionsSeeder::class,
            OncostSeeder::class,
        ]);

        $admin->assignRole('admin');
        $user->assignRole('kiosk');
    }
}
