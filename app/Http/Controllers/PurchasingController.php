<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Inertia\Inertia;

class PurchasingController extends Controller
{
    public function create() {
        return Inertia::render('purchasing/create');
    }
}
