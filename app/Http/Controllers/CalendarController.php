<?php

namespace App\Http\Controllers;

use App\Models\TimesheetEvent;
use Inertia\Inertia;

class CalendarController extends Controller
{
    public function main()
    {
        $events = TimesheetEvent::all();

        return Inertia::render('calendar/main', [
            'events' => $events,
        ]);
    }
}
