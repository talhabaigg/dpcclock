<?php

namespace App\Http\Controllers;

use App\Models\User;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Spatie\Permission\Models\Role;

class UserController extends Controller
{
    public function index()
    {
        $users = User::with(['roles.permissions'])->get();
        return Inertia::render('users/index', [
            'users' => $users,
        ]);
    }

    public function edit(User $user)
    {
        $user->load(['roles.permissions']);

        return Inertia::render('users/edit', [
            'user' => $user,
            'permissions' => $user->getAllPermissions(),
            'roles' => Role::all(),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'roles' => 'required|string|exists:roles,id',
        ]);

        // Update basic info
        $user->update($request->only('name', 'email'));

        // Get the role model by ID
        $role = Role::findOrFail($request->input('roles'));

        // Sync the role by name (because syncRoles expects names or models)
        $user->syncRoles([$role->name]);

        return back()->with('success', 'User updated successfully.');
    }
}
