<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Authorize web users (admins/managers viewing live dashboards) and kiosk-context
// iPads (device-token / worker-token / kiosk-session) to subscribe to a kiosk
// channel. The kiosk guard returns a synthetic user whose identifier is
// "kiosk:{id}" — match it against the channel kiosk id so a token validated for
// kiosk A can't listen on kiosk B's broadcasts.
Broadcast::channel('kiosk.{kiosk_id}', function ($user, $kiosk_id) {
    if (! $user) {
        return false;
    }

    $identifier = (string) $user->getAuthIdentifier();
    if (str_starts_with($identifier, 'kiosk:')) {
        return (int) substr($identifier, 6) === (int) $kiosk_id;
    }

    return true;
}, ['guards' => ['web', 'kiosk']]);

// Public channel for drawing set processing updates (no auth required)
Broadcast::channel('drawing-sets.{projectId}', function () {
    return true;
});

// Public channel for Premier sync progress updates (no auth required)
Broadcast::channel('premier-sync', function () {
    return true;
});
