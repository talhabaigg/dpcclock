<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;

class SetupLinkController extends Controller
{
    public function redirect(string $code): RedirectResponse
    {
        $payload = Cache::get("setup-link:{$code}");

        if (! is_array($payload) || empty($payload['token']) || empty($payload['email'])) {
            return redirect()->route('password.request')->withErrors([
                'email' => 'This setup link is invalid or has expired. Request a new one below.',
            ]);
        }

        return redirect()->route('password.reset', [
            'token' => $payload['token'],
            'email' => $payload['email'],
        ]);
    }
}
