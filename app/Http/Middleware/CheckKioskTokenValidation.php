<?php

namespace App\Http\Middleware;

use App\Models\Kiosk;
use App\Models\KioskDevice;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Session;
use Inertia\Inertia;

class CheckKioskTokenValidation
{
    /**
     * Handle an incoming request.
     * Allows access if user is authenticated OR has valid kiosk session.
     */
    public function handle(Request $request, Closure $next)
    {
        // Allow authenticated users (admins/managers) through
        if (Auth::check()) {
            return $next($request);
        }

        // Allow registered kiosk devices through (device cookie = permanent access)
        $deviceToken = $request->cookie('kiosk_device_token');
        if ($deviceToken) {
            $device = KioskDevice::where('device_token', $deviceToken)->where('is_active', true)->first();
            if ($device) {
                return $next($request);
            }
        }

        // Allow persistent worker token through (survives PWA / Add to Home Screen)
        $workerToken = $request->cookie('kiosk_worker_token');
        if ($workerToken) {
            $workerAccess = Cache::get("kiosk_worker:{$workerToken}");
            if ($workerAccess && now()->isBefore($workerAccess['expires_at'])) {
                // Restore session so kiosk scoping works on subsequent middleware checks
                if (! Session::has('kiosk_access')) {
                    Session::put('kiosk_access', [
                        'kiosk_id' => $workerAccess['kiosk_id'],
                        'validated_at' => now(),
                        'expires_at' => $workerAccess['expires_at'],
                    ]);
                }

                return $next($request);
            }
        }

        // Check for valid kiosk session access
        $access = Session::get('kiosk_access');

        if (! $access) {
            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'Please scan the QR code to access this kiosk.',
            ]);
        }

        // Check if session has expired
        if (now()->isAfter($access['expires_at'])) {
            Session::forget('kiosk_access');

            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'Your session has expired. Please scan the QR code again.',
            ]);
        }

        // Get the kiosk ID from route params, request body, or query string
        $routeKiosk = $request->route('kiosk');
        $routeKioskId = $request->route('kioskId');
        $bodyKioskId = $request->input('kioskId');

        // Determine the database ID of the kiosk being accessed
        $requestedKioskDbId = null;

        if ($routeKiosk instanceof Kiosk) {
            // Route model binding - already have the model
            $requestedKioskDbId = $routeKiosk->id;
        } elseif ($routeKiosk) {
            // Route has {kiosk} param but no type-hint, so it's a raw string
            // Could be eh_kiosk_id or database id - try eh_kiosk_id first
            $kiosk = Kiosk::where('eh_kiosk_id', $routeKiosk)->first()
                ?? Kiosk::find($routeKiosk);
            $requestedKioskDbId = $kiosk?->id;
        } elseif ($routeKioskId) {
            // Raw ID in route {kioskId} - could be eh_kiosk_id or database id
            // Look up by eh_kiosk_id first (most routes use this), fallback to id
            $kiosk = Kiosk::where('eh_kiosk_id', $routeKioskId)->first()
                ?? Kiosk::find($routeKioskId);
            $requestedKioskDbId = $kiosk?->id;
        } elseif ($bodyKioskId) {
            // kioskId from request body (e.g., clock/out POST) - this is database id
            $requestedKioskDbId = (int) $bodyKioskId;
        }

        if (! $requestedKioskDbId) {
            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'Kiosk not found.',
            ]);
        }

        // Verify kiosk ID matches (can't use token from kiosk A to access kiosk B)
        if ($access['kiosk_id'] != $requestedKioskDbId) {
            return Inertia::render('kiosks/error/invalid-qr', [
                'error' => 'This QR code is for a different kiosk.',
            ]);
        }

        return $next($request);
    }
}
