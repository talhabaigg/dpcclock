<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();

        if ($user->two_factor_enabled) {
            // Check if this device is trusted for this user
            if (! $this->isDeviceTrusted($request, $user->id)) {
                $user->sendOneTimePassword();
                session(['otp_user_id' => $user->id]);
                Auth::logout();

                return redirect()->route('otp.show');
            }
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Check if the current device is trusted for the given user.
     */
    private function isDeviceTrusted(Request $request, int $userId): bool
    {
        $trustedUsers = $request->cookie('otp_trusted_device');

        if (! $trustedUsers) {
            return false;
        }

        // The cookie contains a comma-separated list of user IDs
        $trustedUserIds = explode(',', $trustedUsers);

        return in_array((string) $userId, $trustedUserIds, true);
    }

    /**
     * Add a user ID to the trusted device cookie.
     */
    private function addToTrustedDevice(int $userId): void
    {
        $existingCookie = request()->cookie('otp_trusted_device');
        $trustedUserIds = $existingCookie ? explode(',', $existingCookie) : [];

        if (! in_array((string) $userId, $trustedUserIds, true)) {
            $trustedUserIds[] = (string) $userId;
        }

        Cookie::queue(
            cookie(
                'otp_trusted_device',
                implode(',', $trustedUserIds),
                60 * 24 * 30 // 30 days
            )
        );
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    /**
     * Show the OTP form.
     */
    public function showOtpForm(Request $request): Response
    {
        $user = session('otp_user_id');

        return Inertia::render('auth/otp', [
            'user' => $user,
            'status' => session('status'),
        ]);
    }

    /**
     * Handle the OTP verification.
     */
    public function verifyOtp(Request $request): RedirectResponse
    {
        $request->validate([
            'otp' => 'required|numeric',
            'remember' => 'nullable|boolean',
        ]);

        $userId = session('otp_user_id');

        if (! $userId) {
            return redirect()->route('login')->withErrors(['otp' => 'User not found.']);
        }

        $user = User::find($userId);

        if (! $user) {
            return redirect()->route('login')->withErrors(['otp' => 'User not found.']);
        }

        $oneTimePassword = $request->input('otp');
        $result = $user->attemptLoginUsingOneTimePassword($oneTimePassword, remember: false);

        if ($result->isOk()) {
            $request->session()->regenerate();
            session()->forget('otp_user_id');

            // Add to trusted device if "remember" was checked
            if ($request->boolean('remember')) {
                $this->addToTrustedDevice($user->id);
            }

            return redirect()->intended('dashboard');
        }

        return redirect()->route('otp.show')->withErrors(['otp' => 'Invalid OTP.']);
    }
}
