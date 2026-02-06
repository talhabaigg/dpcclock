<?php

use App\Http\Controllers\Api\ProjectDrawingController;
use App\Http\Controllers\Api\QaStageController;
use App\Http\Controllers\Api\QaStageDrawingController;
use App\Http\Controllers\Api\QaStageDrawingObservationController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\PurchasingController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
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

Route::middleware('auth:sanctum')->group(function () {
    // File download route - needs to be inside auth middleware for token processing
    Route::get('qa-stage-drawings/{qaStageDrawing}/file', [QaStageDrawingController::class, 'file'])
        ->name('api.qa-stage-drawings.file');
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::post('employee/updated', function (\Illuminate\Http\Request $request) {
        \Illuminate\Support\Facades\Log::info('Employee updated webhook received:', $request->all());

        return response()->json(['message' => 'Employee updated successfully']);
    });

    Route::post('/requisition/update-status', [PurchasingController::class, 'updateStatusFromPowerAutomate'])
        ->name('api.requisition.updateStatusFromPowerAutomate');

    Route::post('/chat', [ChatController::class, 'handle'])->name('api.chat.handle');
    Route::post('/chat/stream', [ChatController::class, 'handleStream']);

    Route::post('/logout', function (Request $request) {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    });

    Route::apiResource('qa-stages', QaStageController::class)->names('api.qa-stages');
    Route::apiResource('qa-stage-drawings', QaStageDrawingController::class)->names('api.qa-stage-drawings');

    // Drawing revision and comparison endpoints
    Route::get('qa-stage-drawings/{qaStageDrawing}/thumbnail', [QaStageDrawingController::class, 'thumbnail'])
        ->name('api.qa-stage-drawings.thumbnail');
    Route::get('qa-stage-drawings/{qaStageDrawing}/diff', [QaStageDrawingController::class, 'diff'])
        ->name('api.qa-stage-drawings.diff');
    Route::get('qa-stage-drawings/{qaStageDrawing}/revisions', [QaStageDrawingController::class, 'revisions'])
        ->name('api.qa-stage-drawings.revisions');
    Route::post('qa-stage-drawings/{qaStageDrawing}/compare', [QaStageDrawingController::class, 'compare'])
        ->name('api.qa-stage-drawings.compare');
    Route::post('qa-stage-drawings/{qaStageDrawing}/reprocess', [QaStageDrawingController::class, 'reprocess'])
        ->name('api.qa-stage-drawings.reprocess');

    // AI Metadata extraction and confirmation
    Route::get('qa-stage-drawings/{qaStageDrawing}/metadata', [QaStageDrawingController::class, 'metadata'])
        ->name('api.qa-stage-drawings.metadata');
    Route::post('qa-stage-drawings/{qaStageDrawing}/extract-metadata', [QaStageDrawingController::class, 'extractMetadata'])
        ->name('api.qa-stage-drawings.extract-metadata');
    Route::post('qa-stage-drawings/{qaStageDrawing}/confirm-metadata', [QaStageDrawingController::class, 'confirmMetadata'])
        ->name('api.qa-stage-drawings.confirm-metadata');

    Route::apiResource('qa-stage-drawing-observations', QaStageDrawingObservationController::class);

    // Projects (SWCP + GRE locations) and project-level drawings
    Route::get('projects', [ProjectDrawingController::class, 'projects'])
        ->name('api.projects.index');
    Route::get('projects/{project}/drawings', [ProjectDrawingController::class, 'index'])
        ->name('api.projects.drawings.index');
    Route::get('projects/{project}/drawings/{drawing}', [ProjectDrawingController::class, 'show'])
        ->name('api.projects.drawings.show');
});
