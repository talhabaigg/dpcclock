<?php

namespace App\Http\Controllers;

use App\Models\CostCode;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CostcodeController extends Controller
{
    public function index()
    {
        return Inertia::render('costCodes/index', [
            'costcodes' => CostCode::all()->sortBy('name'),
        ]);
    }
}
