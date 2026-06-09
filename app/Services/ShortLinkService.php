<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ShortLinkService
{
    private const CACHE_PREFIX = 'short-link:';

    public function create(string $url, int $ttlMinutes = 1440): string
    {
        $ttl = now()->addMinutes($ttlMinutes);

        do {
            $code = Str::random(8);
        } while (! Cache::add(self::CACHE_PREFIX.$code, $url, $ttl));

        return url(route('short-link.redirect', ['code' => $code], false));
    }

    public function resolve(string $code): ?string
    {
        $url = Cache::get(self::CACHE_PREFIX.$code);

        return is_string($url) ? $url : null;
    }
}
