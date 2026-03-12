<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckAccountDisabled
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::check() && Auth::user()->isDisabled()) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return redirect()->route('login')->withErrors([
                'email' => 'Your account has been disabled. Please contact an administrator.',
            ]);
        }

        return $next($request);
    }
}
