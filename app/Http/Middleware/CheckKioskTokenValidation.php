<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Cookie;

class CheckKioskTokenValidation
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Check if the kiosk token is validated (via session or cookie)
        if (!Cookie::get('kiosk_token_validated')) {
            // If not validated, redirect to the validate-token route
            return redirect()->route('kiosks.validateToken', ['kioskId' => $request->route('kioskId')]);
        }

        // If validated, proceed with the request
        return $next($request);
    }
}
