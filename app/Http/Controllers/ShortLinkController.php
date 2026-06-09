<?php

namespace App\Http\Controllers;

use App\Services\ShortLinkService;
use Illuminate\Http\RedirectResponse;

class ShortLinkController extends Controller
{
    public function __construct(
        private ShortLinkService $shortLinks,
    ) {}

    public function redirect(string $code): RedirectResponse
    {
        $url = $this->shortLinks->resolve($code);

        if (! $url) {
            abort(404, 'This link is invalid or has expired.');
        }

        return redirect()->away($url);
    }
}
