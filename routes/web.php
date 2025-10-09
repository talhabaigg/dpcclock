<?php

use App\Http\Controllers\CalendarController;
use App\Http\Controllers\ClockController;
use App\Http\Controllers\CostcodeController;
use App\Http\Controllers\CostTypeController;
use App\Http\Controllers\KioskAuthController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\LocationCostcodeController;
use App\Http\Controllers\LocationFavouriteMaterialItemsController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RequisitionNoteController;
use App\Http\Controllers\TimesheetEventController;
use App\Http\Controllers\VariationController;
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
Route::get('/employees/sync', [EmployeeController::class, 'sync'])->name('employees.sync');
Route::get('/requisition/update-status', [PurchasingController::class, 'updateStatusFromBuildMetrix'])
    ->name('requisition.updateStatusFromBuildMetrix');
Route::post('/requisition/update-status', [PurchasingController::class, 'updateStatusFromPowerAutomate'])
    ->name('requisition.updateStatusFromPowerAutomate');
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return redirect()->route('kiosks.index');
    })->name('dashboard');
    Route::middleware('role:admin|manager|backoffice')->group(function () {


        Route::get('employees', [EmployeeController::class, 'index'])->name('employees.index');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::get('/users/edit/{user}', [UserController::class, 'edit'])->name('users.edit');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::post('/users/kiosk/{user}/store', [UserController::class, 'storeKiosk'])->name('users.kiosk.store');
        Route::get('/users/kiosk/{kiosk}/{user}/remove', [UserController::class, 'removeKiosk'])->name('users.kiosk.remove');


        Route::get('/employees/worktypes/sync', [EmployeeController::class, 'syncEmployeeWorktypes'])->name('employees.worktypes.sync');
        Route::get('/employee/{employeeId}/worktypes/sync', [EmployeeController::class, 'syncSingleEmployeeWorktype'])->name('employee.worktypes.sync');
        Route::get('/employees/kiosks/update', [EmployeeController::class, 'updateKioskEmployees'])->name('employees.kiosks.update');

        Route::get('/locations/sync', [LocationController::class, 'sync'])->name('locations.sync');
        Route::resource('locations', LocationController::class)->names('locations');
        Route::post('sub-locations', [LocationController::class, 'createSubLocation'])->name('sub-locations.create');

        Route::get('/kiosks/sync', [KioskController::class, 'sync'])->name('kiosks.sync');
        Route::get('/kiosks/{kiosk}/edit', [KioskController::class, 'edit'])->name('kiosks.edit');
        Route::post('/kiosks/{kiosk}/zones', [KioskController::class, 'updateZones'])->name('kiosks.updateZones')->permission('update travel zones');
        Route::get('/kiosks/{kiosk}/toggleActive', [KioskController::class, 'toggleActive'])->name('kiosk.toggleActive')->permission('update travel zones');


        Route::get('/clocks/eh/sync', [ClockController::class, 'syncEhTimesheets'])->name('clocks.eh.sync');
        Route::get('/clocks/{clock}/delete', [ClockController::class, 'destroy'])->name('clocks.destroy');

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
        Route::get('/requisition/{id}/process', [PurchasingController::class, 'process'])->name('requisition.process')->permission('can process requisitions');
        Route::get('/requisition/{id}/api-send', [PurchasingController::class, 'sendApi'])->name('requisition.sendapi')->permission('can process requisitions');
        Route::get('/requisition/{id}/mark-sent-to-supplier', [PurchasingController::class, 'markSentToSupplier'])->name('requisition.markSentToSupplier')->permission('can send requisitions');
        Route::get('requisition/pdf/{requisition}', PurchasingController::class)->name('requisition.pdf');
        Route::get('requisition/excel/{requisition}', [PurchasingController::class, 'excelImport'])->name('requisition.excel');

        //Requisition notes
        Route::post('/requisition/{id}/notes', [RequisitionNoteController::class, 'store'])->name('requisition.addNote');


        Route::get('material-items/all', [MaterialItemController::class, 'index'])->name('material-items.index');
        Route::get('material-items/{materialItem}/edit', [MaterialItemController::class, 'edit'])->name('material-items.edit');
        Route::get('material-items/{materialItem}/next', [MaterialItemController::class, 'next'])->name('material-items.next');
        Route::get('material-items/{materialItem}/previous', [MaterialItemController::class, 'previous'])->name('material-items.previous');
        Route::put('material-items/{materialItem}', [MaterialItemController::class, 'update'])->name('material-items.update');
        Route::delete('material-items/{materialItem}', [MaterialItemController::class, 'destroy'])->name('material-items.destroy');
        Route::get('material-items/download', [MaterialItemController::class, 'download'])->name('material-items.download');
        Route::post('/material-items/upload', [MaterialItemController::class, 'upload']);
        Route::get('/material-items/location/{locationId}/download-csv', [MaterialItemController::class, 'downloadLocationPricingListCSV']);
        Route::post('/material-items/location/upload', [MaterialItemController::class, 'uploadLocationPricing']);

        Route::get('/material-items', [MaterialItemController::class, 'getMaterialItems']);
        Route::get('/material-items/{id}/{locationId}', [MaterialItemController::class, 'getMaterialItemById']);
        Route::get('/material-items/code/{code}/{locationId}', [MaterialItemController::class, 'getMaterialItemByCode']);

        Route::get('/suppliers', [SupplierController::class, 'index'])->name('suppliers.index');
        Route::get('/suppliers/download', [SupplierController::class, 'download'])->name('suppliers.download');
        Route::post('/suppliers/upload', [SupplierController::class, 'upload'])->name('suppliers.upload');

        Route::get('/cost-codes', [CostcodeController::class, 'index'])->name('costcodes.index');
        Route::post('/cost-codes/upload', [CostcodeController::class, 'upload'])->name('costcodes.upload');
        Route::get('/cost-codes/download', [CostcodeController::class, 'download'])->name('costcodes.download');


        Route::get('/cost-types', [CostTypeController::class, 'index'])->name('costtypes.index');
        Route::post('/cost-types/upload', [CostTypeController::class, 'upload'])->name('costtypes.upload');
        Route::get('/cost-types/download', [CostTypeController::class, 'download'])->name('costtypes.download');

        Route::put('/kiosks/settings/update', [KioskController::class, 'updateSettings'])->name('kiosks.updateSettings');

        //Report Routes
        Route::get('/reports/req-line-items-desc', [ReportController::class, 'reqLineReport'])->name('reports.reqLineReport');

        //Calendar Routes
        Route::get('/calendar', [CalendarController::class, 'main'])->name('calendar.main');

        //TimesheetEvent CRUD routes
        Route::post('/timesheet-events/store', [TimesheetEventController::class, 'store'])->name('timesheetEvents.store');
        Route::post('/timesheet-events/update', [TimesheetEventController::class, 'update'])->name('timesheetEvents.update');

        //Generate timesheet based on events
        Route::get('/{kiosk}/timesheet-events/generate', [TimesheetEventController::class, 'generateTimesheetForToday'])->name('timesheetEvents.generateToday');

        // Location Cost Codes from Premier
        Route::get('/location/{location}/cost-codes/sync', [LocationCostcodeController::class, 'sync'])->name('locationCostcodes.sync');
        Route::get('/location/{location}/cost-codes/edit', [LocationCostcodeController::class, 'edit'])->name('locationCostcodes.edit');
        Route::get('/locations/{location}/cost-codes/{id}/delete', [LocationCostcodeController::class, 'delete'])->name('locationCostcodes.delete')->role('admin');
        Route::put('/location/{location}/cost-codes/update', [LocationCostcodeController::class, 'update'])->name('locationCostcodes.update');

        // Favourite Material Items for Locations
        Route::post('/location/{location}/favourite-materials/upload', [LocationFavouriteMaterialItemsController::class, 'uploadFavouriteMaterials'])->name('location.favourite-materials.upload');
        Route::get('/location/{location}/favourite-materials/download-csv', [LocationFavouriteMaterialItemsController::class, 'downloadFavouriteMaterials'])->name('location.favourite-materials.download');
        // Variation routes
        Route::get('/variations', [VariationController::class, 'index'])->name('variations.index');
        Route::get('/variations/create', [VariationController::class, 'create'])->name('variations.create');
        Route::post('/variations/store', [VariationController::class, 'store'])->name('variations.store');
        Route::get('/variations/{id}', [VariationController::class, 'destroy'])->name('variations.destroy');
        Route::get('/variations/{id}/download/pdf', [VariationController::class, 'download'])->name('variations.download');

        Route::get('/php-limits', fn() => response()->json([
            'sapi' => php_sapi_name(),
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'memory_limit' => ini_get('memory_limit'),
        ]));
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
