<?php

use App\Http\Controllers\ClockController;
use App\Http\Controllers\LocationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Employee;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\KioskController;
use App\Http\Controllers\WorktypeController;



Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('employees', [EmployeeController::class, 'index'])->name('employees.index');

    Route::get('/employees/sync', [EmployeeController::class, 'sync'])->name('employees.sync');
    Route::get('/employees/worktypes/sync', [EmployeeController::class, 'syncEmployeeWorktypes'])->name('employees.worktypes.sync');

    Route::get('/locations/sync', [LocationController::class, 'sync'])->name('locations.sync');
    Route::resource('locations', LocationController::class)->names('locations');

    Route::get('/kiosks/sync', [KioskController::class, 'sync'])->name('kiosks.sync');
    // Route::resource('kiosks', KioskController::class)->names('kiosks');
    Route::get('/kiosks/{kioskId}/employees/sync', [KioskController::class, 'syncEmployees'])->name('kiosks.employees.sync');
    Route::get('/clocks/eh/sync', [ClockController::class, 'syncEhTimesheets'])->name('clocks.eh.sync');

    Route::get('/worktypes/sync', [WorktypeController::class, 'syncWorktypes'])->name('worktypes.sync');
    Route::resource('worktypes', WorktypeController::class)->names('worktypes');

    Route::get('/timesheets-converter', [ClockController::class, 'showTimesheetsConverter'])->name('timesheets.converter');
    Route::post('/timesheets-converter/upload', [ClockController::class, 'convertTimesheets'])->name('timesheets.converter.convert');

    Route::get('/generate-kiosk-token', [ClockController::class, 'generateKioskToken'])->name('clocks.generateKioskToken');
    Route::get('/retrieve-kiosk-token', [ClockController::class, 'retrieveKioskToken'])->name('clocks.retrieveKioskToken');
   
});
Route::resource('kiosks', KioskController::class)->names('kiosks');
Route::resource('clocks', ClockController::class)->names('clocks');
Route::post('/clock/out', [ClockController::class, 'clockOut'])->name('clocks.out');
Route::get('kiosks/{kioskId}/validate-token', [KioskController::class, 'validateToken'])->name('kiosks.validateToken');
 Route::get('/kiosk/{kioskId}/employee/{employeeId}/pin', [KioskController::class, 'showPinPage'])->name('kiosk.pin');
    Route::post('/kiosk/{kioskId}/employee/{employeeId}/pin/verify', [KioskController::class, 'validatePin'])->name('kiosk.validate-pin');
Route::get('/kiosk', function () {
    $employees = Employee::all();

    return Inertia::render('kiosks/show', [
        'employees' => $employees,
    ]);
})->name('kiosk');


require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
