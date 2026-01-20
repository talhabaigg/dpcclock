<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PushSubscriptionController extends Controller
{
    /**
     * Store or update a push subscription.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required|string|max:500',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ]);

        $user = $request->user();

        $user->updatePushSubscription(
            endpoint: $request->input('endpoint'),
            key: $request->input('keys.p256dh'),
            token: $request->input('keys.auth'),
            contentEncoding: $request->input('contentEncoding', 'aesgcm')
        );

        return response()->json([
            'success' => true,
            'message' => 'Push subscription saved successfully.',
        ]);
    }

    /**
     * Delete a push subscription.
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required|string',
        ]);

        $user = $request->user();
        $user->deletePushSubscription($request->input('endpoint'));

        return response()->json([
            'success' => true,
            'message' => 'Push subscription removed successfully.',
        ]);
    }
}
