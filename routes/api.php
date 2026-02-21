<?php

use App\Http\Controllers\Api\DrawingController;
use App\Http\Controllers\Api\DrawingObservationController;
use App\Http\Controllers\Api\ProjectDrawingController;
use App\Http\Controllers\Api\SiteWalkController;
use App\Http\Controllers\Api\SyncController;
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

    // Drawings
    Route::apiResource('drawings', DrawingController::class)->names('api.drawings');

    Route::get('drawings/{drawing}/file', [DrawingController::class, 'file'])
        ->name('api.drawings.file');
    Route::get('drawings/{drawing}/thumbnail', [DrawingController::class, 'thumbnail'])
        ->name('api.drawings.thumbnail');
    Route::get('drawings/{drawing}/diff', [DrawingController::class, 'diff'])
        ->name('api.drawings.diff');
    Route::get('drawings/{drawing}/revisions', [DrawingController::class, 'revisions'])
        ->name('api.drawings.revisions');
    Route::post('drawings/{drawing}/compare', [DrawingController::class, 'compare'])
        ->name('api.drawings.compare');
    Route::post('drawings/{drawing}/reprocess', [DrawingController::class, 'reprocess'])
        ->name('api.drawings.reprocess');

    // Drawing metadata extraction and confirmation
    Route::get('drawings/{drawing}/metadata', [DrawingController::class, 'metadata'])
        ->name('api.drawings.metadata');
    Route::post('drawings/{drawing}/extract-metadata', [DrawingController::class, 'extractMetadata'])
        ->name('api.drawings.extract-metadata');
    Route::post('drawings/{drawing}/confirm-metadata', [DrawingController::class, 'confirmMetadata'])
        ->name('api.drawings.confirm-metadata');

    // Drawing Observations
    Route::apiResource('drawing-observations', DrawingObservationController::class)
        ->names('api.drawing-observations');
    Route::get('drawing-observations/{drawingObservation}/photo', [DrawingObservationController::class, 'photo'])
        ->name('api.drawing-observations.photo');

    // WatermelonDB sync endpoints
    Route::get('sync/pull', [SyncController::class, 'pull'])->name('api.sync.pull');
    Route::post('sync/push', [SyncController::class, 'push'])->name('api.sync.push');

    // Projects (SWCP + GRE locations) and project-level drawings
    Route::get('projects', [ProjectDrawingController::class, 'projects'])
        ->name('api.projects.index');
    Route::get('projects/{project}/drawings', [ProjectDrawingController::class, 'index'])
        ->name('api.projects.drawings.index');
    Route::get('projects/{project}/drawings/{drawing}', [ProjectDrawingController::class, 'show'])
        ->name('api.projects.drawings.show');

    // Site Walks
    Route::get('projects/{project}/site-walks', [SiteWalkController::class, 'index'])
        ->name('api.projects.site-walks.index');
    Route::post('projects/{project}/site-walks', [SiteWalkController::class, 'store'])
        ->name('api.projects.site-walks.store');
    Route::get('site-walks/{siteWalk}', [SiteWalkController::class, 'show'])
        ->name('api.site-walks.show');
    Route::put('site-walks/{siteWalk}', [SiteWalkController::class, 'update'])
        ->name('api.site-walks.update');
    Route::delete('site-walks/{siteWalk}', [SiteWalkController::class, 'destroy'])
        ->name('api.site-walks.destroy');
    Route::get('site-walks/{siteWalk}/tour', [SiteWalkController::class, 'tour'])
        ->name('api.site-walks.tour');
    Route::post('site-walks/{siteWalk}/photos', [SiteWalkController::class, 'storePhoto'])
        ->name('api.site-walks.photos.store');
    Route::put('site-walk-photos/{photo}', [SiteWalkController::class, 'updatePhoto'])
        ->name('api.site-walk-photos.update');
    Route::delete('site-walk-photos/{photo}', [SiteWalkController::class, 'destroyPhoto'])
        ->name('api.site-walk-photos.destroy');
    Route::get('site-walk-photos/{photo}/file', [SiteWalkController::class, 'photoFile'])
        ->name('api.site-walk-photos.file');

    // Production
    Route::get('drawings/{drawing}/production', [DrawingController::class, 'production'])
        ->name('api.drawings.production');
    Route::get('drawings/{drawing}/production-statuses', [DrawingController::class, 'productionStatuses'])
        ->name('api.drawings.production-statuses');
    Route::post('drawings/{drawing}/measurement-status', [DrawingController::class, 'updateMeasurementStatus'])
        ->name('api.drawings.measurement-status.update');
    Route::post('drawings/{drawing}/measurement-status-bulk', [DrawingController::class, 'bulkUpdateMeasurementStatus'])
        ->name('api.drawings.measurement-status.bulk');
    Route::post('drawings/{drawing}/segment-status', [DrawingController::class, 'updateSegmentStatus'])
        ->name('api.drawings.segment-status.update');
    Route::post('drawings/{drawing}/segment-status-bulk', [DrawingController::class, 'bulkUpdateSegmentStatus'])
        ->name('api.drawings.segment-status.bulk');

    // Drawing tiles & preview (for mobile viewer)
    Route::get('drawings/{drawing}/tiles/{z}/{coords}', [DrawingController::class, 'tile'])
        ->name('api.drawings.tile')
        ->where(['z' => '[0-9]+', 'coords' => '[0-9]+_[0-9]+']);
    Route::get('drawings/{drawing}/preview', [DrawingController::class, 'preview'])
        ->name('api.drawings.preview');
});
