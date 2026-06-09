<?php

namespace App\Services;

use App\Models\SigningRequest;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class SigningBatchLinkService
{
    private const CACHE_PREFIX = 'sign-batch:';
    private const DEFAULT_TTL_MINUTES = 60 * 24 * 7;

    /**
     * Mint a token mapping to the given signing request IDs. Returns the
     * absolute landing-page URL the recipient should visit.
     *
     * @param  Collection<int, SigningRequest>|array<int, int>  $signingRequests
     */
    public function create(Collection|array $signingRequests, int $ttlMinutes = self::DEFAULT_TTL_MINUTES): string
    {
        $ids = collect($signingRequests)
            ->map(fn ($v) => $v instanceof SigningRequest ? $v->getKey() : (int) $v)
            ->filter()
            ->values()
            ->all();

        $ttl = now()->addMinutes($ttlMinutes);

        do {
            $token = Str::random(10);
        } while (! Cache::add(self::CACHE_PREFIX.$token, $ids, $ttl));

        return url(route('signing.batch', ['token' => $token], false));
    }

    /**
     * Resolve a batch token back to its signing request IDs, or null if expired/invalid.
     *
     * @return array<int, int>|null
     */
    public function resolve(string $token): ?array
    {
        $ids = Cache::get(self::CACHE_PREFIX.$token);

        return is_array($ids) ? $ids : null;
    }
}
