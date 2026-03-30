<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('kiosk.{kiosk_id}', function ($user, $kiosk_id) {
    return true;
});

// Public channel for drawing set processing updates (no auth required)
Broadcast::channel('drawing-sets.{projectId}', function () {
    return true;
});

// Public channel for Premier sync progress updates (no auth required)
Broadcast::channel('premier-sync', function () {
    return true;
});
