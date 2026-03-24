<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\KioskDevice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;

class KioskDeviceController extends Controller
{
    /**
     * Generate a one-time registration token for a device.
     * Called from the admin panel (kiosk edit page).
     */
    public function generateToken(Request $request, Kiosk $kiosk)
    {
        $request->validate([
            'device_name' => 'required|string|max:255',
        ]);

        $token = Str::random(32);
        $expiresAt = now()->addMinutes(10);

        Cache::put("kiosk_device_register:{$kiosk->id}:{$token}", [
            'token' => $token,
            'kiosk_id' => $kiosk->id,
            'device_name' => $request->device_name,
            'registered_by' => Auth::id(),
            'expires_at' => $expiresAt,
        ], $expiresAt);

        $url = url("/kiosks/{$kiosk->id}/register-device?token={$token}");

        return response()->json([
            'token' => $token,
            'url' => $url,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);
    }

    /**
     * Register a device by opening the registration link.
     * This is a public route — no auth required.
     * Sets a permanent cookie and creates the device record.
     */
    public function register($kioskId, Request $request)
    {
        $token = $request->query('token');

        if (! $token) {
            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'Invalid registration link. Please request a new one.',
            ]);
        }

        $cached = Cache::get("kiosk_device_register:{$kioskId}:{$token}");

        if (! $cached || $cached['token'] !== $token) {
            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'This registration link has expired. Please request a new one.',
            ]);
        }

        $kiosk = Kiosk::find($kioskId);
        if (! $kiosk) {
            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'Kiosk not found.',
            ]);
        }

        // Generate a unique device token (this lives in the cookie forever)
        $deviceToken = Str::uuid()->toString();

        KioskDevice::create([
            'kiosk_id' => $kiosk->id,
            'device_token' => $deviceToken,
            'device_name' => $cached['device_name'],
            'registered_by' => $cached['registered_by'],
            'is_active' => true,
            'last_seen_at' => now(),
        ]);

        // Invalidate the one-time registration token
        Cache::forget("kiosk_device_register:{$kioskId}:{$token}");

        // Set a permanent cookie (5 years)
        $cookie = cookie('kiosk_device_token', $deviceToken, 60 * 24 * 365 * 5);

        return redirect()
            ->route('kiosks.show', $kiosk->id)
            ->with('success', "Device '{$cached['device_name']}' registered successfully.")
            ->withCookie($cookie);
    }

    /**
     * Toggle a device's active status (remote enable/disable).
     */
    public function toggle(Kiosk $kiosk, KioskDevice $device)
    {
        $device->update(['is_active' => ! $device->is_active]);

        $status = $device->is_active ? 'activated' : 'deactivated';

        return redirect()->back()->with('success', "Device '{$device->device_name}' {$status}.");
    }

    /**
     * Delete a device record entirely.
     */
    public function destroy(Kiosk $kiosk, KioskDevice $device)
    {
        $name = $device->device_name;
        $device->delete();

        return redirect()->back()->with('success', "Device '{$name}' removed.");
    }
}
