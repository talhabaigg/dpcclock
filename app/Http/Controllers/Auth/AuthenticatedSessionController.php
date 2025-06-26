<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\OneTimePasswords\Notifications\OneTimePasswordNotification;
use Spatie\OneTimePasswords\Enums\ConsumeOneTimePasswordResult;
use App\Models\User;
use Illuminate\Support\Facades\Cookie;

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
            $cookieName = 'otp_trusted_' . $user->id;

            if (!$request->hasCookie($cookieName)) {
                $user->sendOneTimePassword();
                session(['otp_user_id' => $user->id]);
                Auth::logout();

                return redirect()->route('otp.show');
            }

        }

        return redirect()->intended(route('dashboard', absolute: false));
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

        if (!$userId) {
            return redirect()->route('login')->withErrors(['otp' => 'User not found.']);
        }

        $user = User::find($userId);

        if (!$user) {
            return redirect()->route('login')->withErrors(['otp' => 'User not found.']);
        }

        $oneTimePassword = $request->input('otp');
        $result = $user->attemptLoginUsingOneTimePassword($oneTimePassword, remember: false);

        if ($result->isOk()) {
            $request->session()->regenerate();
            session()->forget('otp_user_id');

            // Set a signed cookie if "remember" was checked
            if ($request->boolean('remember')) {
                Cookie::queue(
                    cookie(
                        'otp_trusted_' . $user->id,
                        true,           // Value
                        60 * 24         // Lifetime in minutes (24 hours)
                    )
                );
            }

            return redirect()->intended('dashboard');
        }

        return redirect()->route('otp.show')->withErrors(['otp' => 'Invalid OTP.']);
    }
}
