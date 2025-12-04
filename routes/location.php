<?php


use App\Http\Controllers\LocationController;
use App\Http\Controllers\LocationItemController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::get('/location/{location}/material-items', [LocationItemController::class, 'showLocationItems'])->name('location.items');
    Route::get('/location/{location}/material-item-price-list-uploads', [LocationItemController::class, 'showMaterialItemPriceListUploads'])->name('location.material-item-price-list-uploads');
});
