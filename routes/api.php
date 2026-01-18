<?php

use App\Http\Controllers\Api\QaStageController;
use App\Http\Controllers\Api\QaStageDrawingController;
use App\Http\Controllers\Api\QaStageDrawingObservationController;
use App\Http\Controllers\ChatController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PurchasingController;
use Illuminate\Validation\ValidationException;


// Public authentication routes
Route::post('/login', function (Request $request) {
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
        'device_name' => 'nullable|string',
    ]);

    $user = User::where('email', $request->email)->first();

    if (! $user || ! Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['The provided credentials are incorrect.'],
        ]);
    }

    $token = $user->createToken($request->device_name ?? 'api-token')->plainTextToken;

    return response()->json([
        'token' => $token,
        'user' => $user,
    ]);
});

Route::match(['options'], 'qa-stage-drawings/{qaStageDrawing}/file', [QaStageDrawingController::class, 'file'])
    ->name('qa-stage-drawings.file.options');
Route::get('qa-stage-drawings/{qaStageDrawing}/file', [QaStageDrawingController::class, 'file'])
    ->name('qa-stage-drawings.file');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('employee/updated', function (\Illuminate\Http\Request $request) {
        \Illuminate\Support\Facades\Log::info('Employee updated webhook received:', $request->all());
        return response()->json(['message' => 'Employee updated successfully']);
    });

    Route::post('/requisition/update-status', [PurchasingController::class, 'updateStatusFromPowerAutomate'])
        ->name('requisition.updateStatusFromPowerAutomate');

    Route::post('/chat', [ChatController::class, 'handle'])->name('chat.handle');
    Route::post('/chat/stream', [ChatController::class, 'handleStream']);

    Route::post('/logout', function (Request $request) {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    });

    Route::apiResource('qa-stages', QaStageController::class);
    Route::apiResource('qa-stage-drawings', QaStageDrawingController::class);
    Route::apiResource('qa-stage-drawing-observations', QaStageDrawingObservationController::class);
});
