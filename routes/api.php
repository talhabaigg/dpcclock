<?php

use App\Http\Controllers\ChatController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PurchasingController;


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('employee/updated', function (\Illuminate\Http\Request $request) {
    \Illuminate\Support\Facades\Log::info('Employee updated webhook received:', $request->all());
    return response()->json(['message' => 'Employee updated successfully']);
});

Route::post('/requisition/update-status', [PurchasingController::class, 'updateStatusFromPowerAutomate'])
    ->name('requisition.updateStatusFromPowerAutomate');

Route::post('/chat', [ChatController::class, 'handle'])->name('chat.handle');