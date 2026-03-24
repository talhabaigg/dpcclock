<?php

namespace App\Http\Middleware;

use App\Models\KioskDevice;
use App\Services\KioskService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;

class KioskDeviceLock
{
    public function __construct(protected KioskService $kioskService) {}

    public function handle(Request $request, Closure $next)
    {
        $deviceToken = $request->cookie('kiosk_device_token');

        if (! $deviceToken) {
            return $next($request);
        }

        $device = KioskDevice::where('device_token', $deviceToken)->first();

        // Device not found or deactivated remotely — clear the cookie and let them through
        if (! $device || ! $device->is_active) {
            Cookie::queue(Cookie::forget('kiosk_device_token'));

            return $next($request);
        }

        // Update last seen (throttled to once per minute to avoid DB spam)
        if (! $device->last_seen_at || $device->last_seen_at->diffInMinutes(now()) >= 1) {
            $device->update(['last_seen_at' => now()]);
        }

        // Admin PIN override — manager can temporarily use full app
        if ($this->kioskService->isAdminModeActive()) {
            return $next($request);
        }

        // Allow kiosk routes through
        $path = $request->path();
        $allowedPrefixes = ['kiosks', 'kiosk', 'clock', 'logout', 'broadcasting', 'validate-kiosk-admin-pin', 'generate-kiosk-token', 'retrieve-kiosk-token'];

        foreach ($allowedPrefixes as $prefix) {
            if (str_starts_with($path, $prefix)) {
                return $next($request);
            }
        }

        // Also allow the device registration route itself
        if (str_contains($path, 'register-device')) {
            return $next($request);
        }

        // Block everything else — redirect to the kiosk
        return redirect()->route('kiosks.show', $device->kiosk_id);
    }
}
