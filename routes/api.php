<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('employee/updated', function (\Illuminate\Http\Request $request) {
    \Illuminate\Support\Facades\Log::info('Employee updated webhook received:', $request->all());
    return response()->json(['message' => 'Employee updated successfully']);
});