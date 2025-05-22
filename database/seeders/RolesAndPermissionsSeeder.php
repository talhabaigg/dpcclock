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
            'backoffice',
            'manager',
            'kiosk',
        ];

        // Define permissions
        $permissions = [
            'view dashboard',
            'manage locations',
            'manage employees',
            'manage worktypes',
            'manage timesheets',
            'view kiosk',
            'retrieve kiosk token',
            'update travel zones',
            'view timesheet converter',
            'view all requisitions',
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
            'view dashboard',
            'view kiosk',
        ]);

        $adminRole = Role::where('name', 'admin')->first();
        $adminRole->syncPermissions($permissions);

        $managerRole = Role::where('name', 'manager')->first();
        $managerRole->syncPermissions([
            'view dashboard',
            'manage locations',
            'manage employees',
            'manage timesheets',
            'view kiosk',
            'retrieve kiosk token',
        ]);

        $backofficeRole = Role::where('name', 'backoffice')->first();
        $backofficeRole->syncPermissions([
            'view dashboard',
            'manage locations',
            'manage employees',
            'manage worktypes',
            'manage timesheets',
            'view kiosk',
            'retrieve kiosk token',
            'update travel zones',
            'view all requisitions',
        ]);

    }
}
