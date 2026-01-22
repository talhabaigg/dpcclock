<?php

namespace App\Http\Controllers;

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class PermissionController extends Controller
{
    /**
     * Display a listing of permissions.
     */
    public function index()
    {
        // Get permissions grouped by category from the seeder
        $permissionsByCategory = RolesAndPermissionsSeeder::getPermissionsByCategory();

        // Flatten to get all defined permission names
        $definedPermissions = [];
        foreach ($permissionsByCategory as $perms) {
            $definedPermissions = array_merge($definedPermissions, array_keys($perms));
        }

        // Get all permissions from database
        $dbPermissions = Permission::with('roles')->get();

        // Build permissions array with category and description info
        $permissions = $dbPermissions->map(function ($permission) use ($permissionsByCategory, $definedPermissions) {
            $category = 'Other';
            $description = $permission->name;

            // Find the category for this permission
            foreach ($permissionsByCategory as $cat => $perms) {
                if (isset($perms[$permission->name])) {
                    $category = $cat;
                    $description = $perms[$permission->name];
                    break;
                }
            }

            return [
                'id' => $permission->id,
                'name' => $permission->name,
                'description' => $description,
                'guard_name' => $permission->guard_name,
                'category' => $category,
                'roles' => $permission->roles->pluck('name'),
                'is_core' => \in_array($permission->name, $definedPermissions),
                'created_at' => $permission->created_at,
            ];
        });

        $roles = Role::all(['id', 'name']);

        // Build category info for UI
        $categories = [
            'Dashboard' => ['description' => 'Access to main dashboard', 'icon' => 'LayoutGrid'],
            'Users' => ['description' => 'User management and role assignment', 'icon' => 'Users'],
            'Employees' => ['description' => 'Employee management and sync', 'icon' => 'UserCheck'],
            'Locations' => ['description' => 'Job sites and location management', 'icon' => 'Building'],
            'Kiosks' => ['description' => 'Kiosk configuration and management', 'icon' => 'Monitor'],
            'Timesheets' => ['description' => 'Timesheet and clock entry management', 'icon' => 'Clock'],
            'Calendar' => ['description' => 'Calendar and timesheet events', 'icon' => 'Calendar'],
            'Worktypes' => ['description' => 'Work type configuration', 'icon' => 'Hammer'],
            'Requisitions' => ['description' => 'Purchase requisition workflow', 'icon' => 'FileText'],
            'Materials' => ['description' => 'Material item management', 'icon' => 'Package'],
            'Suppliers' => ['description' => 'Supplier management', 'icon' => 'Truck'],
            'Cost Codes' => ['description' => 'Cost code and type management', 'icon' => 'Binary'],
            'Forecasting' => ['description' => 'Financial forecasting tools', 'icon' => 'TrendingUp'],
            'Budget' => ['description' => 'Budget and target management', 'icon' => 'Target'],
            'Variations' => ['description' => 'Variation management', 'icon' => 'GitBranch'],
            'QA Stages' => ['description' => 'Quality assurance stages', 'icon' => 'CheckSquare'],
            'Reports' => ['description' => 'Report generation and viewing', 'icon' => 'FileSpreadsheet'],
            'System' => ['description' => 'System administration', 'icon' => 'Settings'],
            'Other' => ['description' => 'Custom permissions', 'icon' => 'Key'],
        ];

        return Inertia::render('admin/permissions/index', [
            'permissions' => $permissions,
            'roles' => $roles,
            'categories' => $categories,
            'corePermissions' => $definedPermissions,
        ]);
    }

    /**
     * Store a newly created permission.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:permissions,name',
        ]);

        Permission::create(['name' => strtolower($request->name)]);

        // Clear permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return back()->with('success', 'Permission created successfully.');
    }

    /**
     * Remove the specified permission.
     */
    public function destroy(Permission $permission)
    {
        // Get core permissions from seeder
        $permissionsByCategory = RolesAndPermissionsSeeder::getPermissionsByCategory();
        $corePermissions = [];
        foreach ($permissionsByCategory as $perms) {
            $corePermissions = array_merge($corePermissions, array_keys($perms));
        }

        if (\in_array($permission->name, $corePermissions)) {
            return back()->with('error', 'Core permissions cannot be deleted as they are defined in the system.');
        }

        $permission->delete();

        // Clear permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return back()->with('success', 'Permission deleted successfully.');
    }
}
