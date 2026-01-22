<?php

namespace App\Http\Controllers;

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    /**
     * System roles that cannot be deleted or renamed
     */
    protected array $systemRoles = ['admin', 'kiosk'];

    /**
     * Display a listing of roles and permissions.
     */
    public function index()
    {
        $roles = Role::with('permissions')->get()->map(function ($role) {
            return [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'is_system' => in_array($role->name, $this->systemRoles),
                'permissions' => $role->permissions->pluck('name'),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at,
                'updated_at' => $role->updated_at,
            ];
        });

        // Get permissions grouped by category from the seeder
        $permissionsByCategory = RolesAndPermissionsSeeder::getPermissionsByCategory();

        // Build permissions array with category info
        $permissions = [];
        foreach ($permissionsByCategory as $category => $perms) {
            foreach ($perms as $name => $description) {
                $dbPermission = Permission::where('name', $name)->first();
                if ($dbPermission) {
                    $permissions[$category][] = [
                        'id' => $dbPermission->id,
                        'name' => $dbPermission->name,
                        'description' => $description,
                        'guard_name' => $dbPermission->guard_name,
                        'category' => $category,
                    ];
                }
            }
        }

        return Inertia::render('admin/roles/index', [
            'roles' => $roles,
            'permissions' => $permissions,
            'systemRoles' => $this->systemRoles,
            'categories' => array_keys($permissionsByCategory),
        ]);
    }

    /**
     * Store a newly created role.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $role = Role::create(['name' => strtolower($request->name)]);

        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        }

        return back()->with('success', 'Role created successfully.');
    }

    /**
     * Update the specified role.
     */
    public function update(Request $request, Role $role)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,' . $role->id,
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        // Prevent renaming system roles
        if (in_array($role->name, $this->systemRoles) && $role->name !== strtolower($request->name)) {
            return back()->with('error', 'System roles cannot be renamed.');
        }

        $role->update(['name' => strtolower($request->name)]);
        $role->syncPermissions($request->permissions ?? []);

        // Clear permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return back()->with('success', 'Role updated successfully.');
    }

    /**
     * Remove the specified role.
     */
    public function destroy(Role $role)
    {
        // Prevent deletion of system roles
        if (in_array($role->name, $this->systemRoles)) {
            return back()->with('error', 'System roles cannot be deleted.');
        }

        // Check if role has users assigned
        if ($role->users()->count() > 0) {
            return back()->with('error', 'Cannot delete role with assigned users. Reassign users first.');
        }

        $role->delete();

        return back()->with('success', 'Role deleted successfully.');
    }
}
