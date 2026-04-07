<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with(['roles.permissions']);

        if (! $request->boolean('show_disabled')) {
            $query->whereNull('disabled_at');
        }

        return Inertia::render('users/index', [
            'roles' => Role::all(),
            'users' => $query->get(),
            'filters' => [
                'show_disabled' => $request->boolean('show_disabled'),
            ],
        ]);
    }

    public function edit(User $user)
    {
        $user->load(['roles.permissions', 'managedKiosks', 'permissions']);
        $kiosks = Kiosk::select('id', 'name')->get();

        // Get permissions grouped by category for the permission selector
        $permissionsByCategory = RolesAndPermissionsSeeder::getPermissionsByCategory();
        $groupedPermissions = [];
        foreach ($permissionsByCategory as $category => $perms) {
            foreach ($perms as $name => $description) {
                $dbPermission = Permission::where('name', $name)->first();
                if ($dbPermission) {
                    $groupedPermissions[$category][] = [
                        'id' => $dbPermission->id,
                        'name' => $dbPermission->name,
                        'description' => $description,
                        'guard_name' => $dbPermission->guard_name,
                        'category' => $category,
                    ];
                }
            }
        }

        return Inertia::render('users/edit', [
            'user' => $user,
            'permissions' => $user->getAllPermissions(),
            'directPermissions' => $user->getDirectPermissions()->pluck('name'),
            'groupedPermissions' => $groupedPermissions,
            'categories' => array_keys($permissionsByCategory),
            'roles' => Role::all(),
            'kiosks' => $kiosks,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'position' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'roles' => 'required|string|exists:roles,id',
            'disable_kiosk_notifications' => 'boolean',
        ]);

        // Update basic info
        $user->update([
            'name' => $request->input('name'),
            'position' => $request->input('position'),
            'email' => $request->input('email'),
            'disable_kiosk_notifications' => $request->boolean('disable_kiosk_notifications'),
        ]);

        // Get the role model by ID
        $role = Role::findOrFail($request->input('roles'));

        // Sync the role by name (because syncRoles expects names or models)
        $user->syncRoles([$role->name]);

        return back()->with('success', 'User updated successfully.');
    }

    public function syncDirectPermissions(Request $request, User $user)
    {
        $request->validate([
            'permissions' => 'array',
            'permissions.*' => 'string|exists:permissions,name',
        ]);

        $user->syncPermissions($request->input('permissions', []));

        // Clear permission cache
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        return back()->with('success', 'Direct permissions updated successfully.');
    }

    public function storeKiosk(Request $request, User $user)
    {
        $request->validate([
            'kiosk_id' => 'required|exists:kiosks,id',
        ]);
        $user->managedKiosks()->syncWithoutDetaching([$request->input('kiosk_id')]);

        return back()->with('success', 'Kiosk assigned to user successfully.');
    }

    public function removeKiosk(Kiosk $kiosk, User $user)
    {
        // Detach the kiosk from the user
        $user->managedKiosks()->detach($kiosk->id);

        return back()->with('success', 'Kiosk removed from user successfully.');
    }

    public function toggleDisable(User $user)
    {
        $user->update([
            'disabled_at' => $user->isDisabled() ? null : now(),
        ]);

        $status = $user->isDisabled() ? 'disabled' : 'enabled';

        return back()->with('success', "Account {$status} successfully.");
    }
}
