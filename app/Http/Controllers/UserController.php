<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index()
    {
        $users = User::with(['roles.permissions'])->get();

        return Inertia::render('users/index', [
            'roles' => Role::all(),
            'users' => $users,
        ]);
    }

    public function edit(User $user)
    {
        $user->load(['roles.permissions', 'managedKiosks']);
        $kiosks = Kiosk::select('id', 'name')->get();

        return Inertia::render('users/edit', [
            'user' => $user,
            'permissions' => $user->getAllPermissions(),
            'roles' => Role::all(),
            'kiosks' => $kiosks,
        ]);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'roles' => 'required|string|exists:roles,id',
            'disable_kiosk_notifications' => 'boolean',
        ]);

        // Update basic info
        $user->update([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'disable_kiosk_notifications' => $request->boolean('disable_kiosk_notifications'),
        ]);

        // Get the role model by ID
        $role = Role::findOrFail($request->input('roles'));

        // Sync the role by name (because syncRoles expects names or models)
        $user->syncRoles([$role->name]);

        return back()->with('success', 'User updated successfully.');
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
}
