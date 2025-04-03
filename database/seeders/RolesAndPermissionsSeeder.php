<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run()
    {
        // Define roles
        $roles = [
            'admin',
            'kiosk',
        ];

        // Define permissions
        $permissions = [
            'view kiosk',
            'retrieve kiosk token',
        ];

        // Create roles if they don't exist
        foreach ($roles as $role) {
            Role::firstOrCreate(['name' => $role]);
        }

        // Create permissions if they don't exist
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Assign permissions to roles
        $kioskRole = Role::where('name', 'kiosk')->first();
        $kioskRole->syncPermissions([
            'view kiosk',
        ]);

        $adminRole = Role::where('name', 'admin')->first();
        $adminRole->syncPermissions([
            'view kiosk',
            'retrieve kiosk token',
        ]);

    }
}
