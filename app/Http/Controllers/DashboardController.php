<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        return Inertia::render('dashboard/main');
    }

    public function aiChat(string $conversationId)
    {
        return Inertia::render('dashboard/main', [
            'conversationId' => $conversationId,
        ]);
    }
}
