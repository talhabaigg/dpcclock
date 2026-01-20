<?php

use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Notifications\TestPushNotification;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', 'settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('settings/kiosk-admin-pin', function () {
        return Inertia::render('settings/kiosk-admin-pin');
    })->name('kiosk-admin-pin');

    Route::put('settings/kiosk-admin-pin', function () {
        $user = auth()->user();
        $data = request()->validate([
            'new_pin' => 'nullable|string|min:4|max:10',
        ]);
        $user->admin_pin = Hash::make($data['new_pin']);
        $user->save();
        return redirect()->route('kiosk-admin-pin')->with('success', 'Kiosk Admin PIN updated successfully.');
    })->name('admin-kiosk-pin.update');
    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance');

    Route::get('settings/notifications', function () {
        return Inertia::render('settings/notifications');
    })->name('notifications');

    // Test push notification route
    Route::post('settings/notifications/test', function () {
        $user = auth()->user();

        if (!$user->pushSubscriptions()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'No push subscriptions found. Please enable notifications first.',
            ], 400);
        }

        $user->notify(new TestPushNotification());

        return response()->json([
            'success' => true,
            'message' => 'Test notification sent successfully!',
        ]);
    })->name('notifications.test');
});
