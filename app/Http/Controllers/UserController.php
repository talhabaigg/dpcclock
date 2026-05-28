<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\PremierVendor;
use App\Models\User;
use App\Notifications\WelcomeUserNotification;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
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

    public function create()
    {
        return Inertia::render('users/create', [
            'roles' => Role::all(),
            'kiosks' => Kiosk::select('id', 'name')->get(),
            'vendors' => PremierVendor::where('code', 'like', 'CC%')
                ->orWhere('name', 'like', '%credit%')
                ->orderBy('name')
                ->get(['id', 'code', 'name']),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'position' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'phone' => 'nullable|string|max:50',
            'roles' => 'required|string|exists:roles,id',
            'disable_kiosk_notifications' => 'boolean',
            'receive_injury_alerts' => 'boolean',
            'send_setup_email' => 'boolean',
            'send_setup_sms' => 'boolean',
            'premier_vendor_id' => 'nullable|exists:premier_vendors,id',
            'kiosk_ids' => 'array',
            'kiosk_ids.*' => 'integer|exists:kiosks,id',
        ]);

        $user = User::create([
            'name' => $data['name'],
            'position' => $data['position'] ?? null,
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'password' => Str::random(40),
            'disable_kiosk_notifications' => $request->boolean('disable_kiosk_notifications'),
            'receive_injury_alerts' => $request->boolean('receive_injury_alerts'),
            'premier_vendor_id' => $data['premier_vendor_id'] ?? null,
        ]);

        $role = Role::findOrFail($data['roles']);
        $user->syncRoles([$role->name]);

        $user->managedKiosks()->sync($data['kiosk_ids'] ?? []);

        $message = 'User created successfully.';
        $sendEmail = $request->boolean('send_setup_email', true);
        $sendSms = $request->boolean('send_setup_sms') && ! empty($user->phone);

        if ($sendEmail || $sendSms) {
            $channels = array_filter([
                $sendEmail ? 'mail' : null,
                $sendSms ? 'sms' : null,
            ]);
            $token = Password::broker()->createToken($user);
            $user->notify(
                (new WelcomeUserNotification($token, auth()->user()->name))->only($channels)
            );

            $sentTo = array_filter([
                $sendEmail ? $user->email : null,
                $sendSms ? $user->phone : null,
            ]);
            $message .= ' Setup link sent to ' . implode(' and ', $sentTo) . '.';
        }

        return redirect()->route('users.edit', $user)->with('success', $message);
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
            'vendors' => PremierVendor::where('code', 'like', 'CC%')
                ->orWhere('name', 'like', '%credit%')
                ->orderBy('name')
                ->get(['id', 'code', 'name']),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'position' => 'nullable|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'phone' => 'nullable|string|max:50',
            'roles' => 'required|string|exists:roles,id',
            'disable_kiosk_notifications' => 'boolean',
            'receive_injury_alerts' => 'boolean',
            'premier_vendor_id' => 'nullable|exists:premier_vendors,id',
        ]);

        // Update basic info
        $user->update([
            'name' => $request->input('name'),
            'position' => $request->input('position'),
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'disable_kiosk_notifications' => $request->boolean('disable_kiosk_notifications'),
            'receive_injury_alerts' => $request->boolean('receive_injury_alerts'),
            'premier_vendor_id' => $request->input('premier_vendor_id'),
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

    public function syncKiosks(Request $request, User $user)
    {
        $data = $request->validate([
            'kiosk_ids' => 'array',
            'kiosk_ids.*' => 'integer|exists:kiosks,id',
        ]);

        $user->managedKiosks()->sync($data['kiosk_ids'] ?? []);

        return back()->with('success', 'Managed kiosks updated successfully.');
    }

    public function resendWelcome(Request $request, User $user)
    {
        $data = $request->validate([
            'channel' => 'required|in:mail,sms',
        ]);

        if ($data['channel'] === 'sms' && empty($user->phone)) {
            return back()->withErrors(['error' => 'User has no phone number on file.']);
        }

        $token = Password::broker()->createToken($user);
        $user->notify(
            (new WelcomeUserNotification($token, auth()->user()->name))->only([$data['channel']])
        );

        $target = $data['channel'] === 'sms' ? $user->phone : $user->email;
        $label = $data['channel'] === 'sms' ? 'SMS' : 'Email';

        return back()->with('success', "Setup {$label} sent to {$target}.");
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
