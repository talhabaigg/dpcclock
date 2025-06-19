<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function main()
    {
        return Inertia::render('calendar/main');
    }
}
