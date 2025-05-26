<?php

use App\Http\Controllers\ClockController;
use App\Http\Controllers\KioskAuthController;
use App\Http\Controllers\LocationController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Employee;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\KioskController;
use App\Http\Controllers\WorktypeController;
use App\Http\Controllers\PurchasingController;
use App\Http\Controllers\MaterialItemController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\SupplierController;





Route::get('/', function () {
    return redirect()->route('dashboard');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return redirect()->route('kiosks.index');
    })->name('dashboard');
    Route::middleware('role:admin|manager|backoffice')->group(function () {


        Route::get('employees', [EmployeeController::class, 'index'])->name('employees.index');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::get('/users/edit/{user}', [UserController::class, 'edit'])->name('users.edit');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');

        Route::get('/employees/sync', [EmployeeController::class, 'sync'])->name('employees.sync');
        Route::get('/employees/worktypes/sync', [EmployeeController::class, 'syncEmployeeWorktypes'])->name('employees.worktypes.sync');
        Route::get('/employee/{employeeId}/worktypes/sync', [EmployeeController::class, 'syncSingleEmployeeWorktype'])->name('employee.worktypes.sync');
        Route::get('/employees/kiosks/update', [EmployeeController::class, 'updateKioskEmployees'])->name('employees.kiosks.update');

        Route::get('/locations/sync', [LocationController::class, 'sync'])->name('locations.sync');
        Route::resource('locations', LocationController::class)->names('locations');
        Route::post('sub-locations', [LocationController::class, 'createSubLocation'])->name('sub-locations.create');

        Route::get('/kiosks/sync', [KioskController::class, 'sync'])->name('kiosks.sync');
        Route::get('/kiosks/{kiosk}/edit', [KioskController::class, 'edit'])->name('kiosks.edit');
        Route::post('/kiosks/{kiosk}/zones', [KioskController::class, 'updateZones'])->name('kiosks.updateZones')->permission('update travel zones');


        Route::get('/clocks/eh/sync', [ClockController::class, 'syncEhTimesheets'])->name('clocks.eh.sync');

        Route::get('/worktypes/sync', [WorktypeController::class, 'syncWorktypes'])->name('worktypes.sync');
        Route::resource('worktypes', WorktypeController::class)->names('worktypes');

        Route::get('/timesheets-converter', [ClockController::class, 'showTimesheetsConverter'])->name('timesheets.converter')->permission('view timesheet converter');
        Route::post('/timesheets-converter/upload', [ClockController::class, 'convertTimesheets'])->name('timesheets.converter.convert');

        Route::get('/generate-kiosk-token', [ClockController::class, 'generateKioskToken'])->name('clocks.generateKioskToken');
        Route::get('/retrieve-kiosk-token', [ClockController::class, 'retrieveKioskToken'])->name('clocks.retrieveKioskToken');

        Route::get('/timesheets', [ClockController::class, 'viewTimesheet'])->name('timesheets.view');
        Route::get('/timesheets/edit', [ClockController::class, 'editTimesheet'])->name('clock.edit.summary');
        Route::post('/timesheets/edit', [ClockController::class, 'saveTimesheets'])->name('clock.edit.summary.post');

        Route::get('/employees/list', [EmployeeController::class, 'retrieveEmployees'])->name('employees.list');


        Route::get('/requisition/all', [PurchasingController::class, 'index'])->name('requisition.index');
        Route::get('/requisition/create', [PurchasingController::class, 'create'])->name('requisition.create');
        Route::get('/requisition/{id}/edit', [PurchasingController::class, 'edit'])->name('requisition.edit');
        Route::put('/requisition/{requisition}', [PurchasingController::class, 'update'])->name('requisition.update');
        Route::post('/requisition/store', [PurchasingController::class, 'store'])->name('requisition.store');
        Route::get('/requisition/{id}', [PurchasingController::class, 'show'])->name('requisition.show');
        Route::get('/requisition/{id}/copy', [PurchasingController::class, 'copy'])->name('requisition.copy');
        Route::get('/requisition/{id}/toggle-requisition-template', [PurchasingController::class, 'toggleRequisitionTemplate'])->name('requisition.toggle-template');
        Route::get('/requisition/{id}/delete', [PurchasingController::class, 'destroy'])->name('requisition.delete');
        Route::get('/requisition/{id}/process', [PurchasingController::class, 'process'])->name('requisition.process');
        Route::get('requisition/pdf/{requisition}', PurchasingController::class)->name('requisition.pdf');
        Route::get('requisition/excel/{requisition}', [PurchasingController::class, 'excelImport'])->name('requisition.excel');


        Route::get('material-items/all', [MaterialItemController::class, 'index'])->name('material-items.index');
        Route::get('material-items/download', [MaterialItemController::class, 'download'])->name('material-items.download');
        Route::post('/material-items/upload', [MaterialItemController::class, 'upload']);
        Route::post('/material-items/location/upload', [MaterialItemController::class, 'uploadLocationPricing']);

        Route::get('/material-items', [MaterialItemController::class, 'getMaterialItems']);
        Route::get('/material-items/{id}/{locationId}', [MaterialItemController::class, 'getMaterialItemById']);
        Route::get('/material-items/code/{code}/{locationId}', [MaterialItemController::class, 'getMaterialItemByCode']);

        Route::get('/suppliers', [SupplierController::class, 'index'])->name('suppliers.index');
        Route::get('/suppliers/download', [SupplierController::class, 'download'])->name('suppliers.download');
        Route::post('/suppliers/upload', [SupplierController::class, 'upload'])->name('suppliers.upload');

    });

    Route::middleware('permission:view kiosk')->group(function () {
        Route::resource('kiosks', KioskController::class)->names('kiosks');
        Route::resource('clocks', ClockController::class)->names('clocks');
        Route::post('/clock/out', [ClockController::class, 'clockOut'])->name('clocks.out');
        // Route::get('kiosks/{kioskId}/validate-token', [KioskController::class, 'validateToken'])->name('kiosks.validateToken');
        Route::get('/kiosk/{kioskId}/employee/{employeeId}/pin', [KioskAuthController::class, 'showPinPage'])->name('kiosk.pin');
        Route::get('/kiosk/{kioskId}/employee/{employeeId}/pin/verify', function ($kioskId) {
            return redirect()->route('kiosks.show', ['kiosk' => $kioskId]);
        });
        Route::post('/kiosk/{kioskId}/employee/{employeeId}/pin/verify', [KioskAuthController::class, 'validatePin'])->name('kiosk.validate-pin');

        Route::get('kiosk/{kiosk}/auth/{employeeId}/reset-pin', [KioskAuthController::class, 'showResetPinPage'])->name('kiosk.auth.reset-pin');
        Route::post('kiosk/{kiosk}/auth/{employeeId}/reset-pin', [KioskAuthController::class, 'resetPin'])->name('kiosk.auth.reset-pin.post');
    });
    Route::get('/kiosks/{kioskId}/employees/sync', [KioskController::class, 'syncEmployees'])->name('kiosks.employees.sync');
});

Route::get('kiosks/{kioskId}/validate-token', [KioskController::class, 'validateToken'])->name('kiosk.validateToken');

Route::get('/kiosk', function () {
    $employees = Employee::all();

    return Inertia::render('kiosks/show', [
        'employees' => $employees,
    ]);
})->name('kiosk');


require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
