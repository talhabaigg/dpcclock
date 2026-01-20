<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => [
                'user' => $request->user()?->load('roles.permissions'),
                'isAdmin' => $request->user()?->isAdmin(),
                'permissions' => $request->user()?->roles->first()?->permissions->pluck('name'),
            ],
            'flash' => [
                'success' => fn() => $request->session()->get('success'),
                'message' => fn() => $request->session()->get('message'),
                'error' => fn() => $request->session()->get('error'),
            ],
            'ziggy' => fn(): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            'tokenUsage' => fn() => $request->user() ? $request->user()->tokenUsage() : 0,
            'tokenStats' => fn() => $request->user() ? $request->user()->tokenStats() : [
                'total_tokens' => 0,
                'input_tokens' => 0,
                'output_tokens' => 0,
                'message_count' => 0,
                'estimated_cost' => 0,
                'limit' => 1_000_000,
                'voice_minutes' => 0,
                'voice_calls' => 0,
                'voice_cost' => 0,
                'total_cost' => 0,
            ],
            'notifications' => fn() => $request->user() ? [
                'unreadCount' => $request->user()->unreadNotifications()->count(),
                // keep it small; fetch the full list on a notifications page/API
                'latest' => $request->user()->unreadNotifications()->latest()->get()
                    ->map(fn($n) => [
                        'id' => $n->id,
                        'data' => $n->data,
                        'read_at' => $n->read_at,
                        'created_at' => $n->created_at,
                    ]),
            ] : ['unreadCount' => 0, 'latest' => []],
        ];
    }
}
