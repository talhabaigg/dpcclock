<?php

use App\Http\Controllers\CalendarController;
use App\Http\Controllers\CashForecastController;
use App\Http\Controllers\ClockController;
use App\Http\Controllers\CompanyRevenueTargetController;
use App\Http\Controllers\CostcodeController;
use App\Http\Controllers\CostTypeController;
use App\Http\Controllers\ForecastProjectController;
use App\Http\Controllers\JobForecastController;
use App\Http\Controllers\TurnoverForecastController;
use App\Http\Controllers\KioskAuthController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\LocationCostcodeController;
use App\Http\Controllers\LocationFavouriteMaterialItemsController;
use App\Http\Controllers\QueueStatusController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RequisitionHeaderTemplateController;
use App\Http\Controllers\RequisitionNoteController;
use App\Http\Controllers\TimesheetEventController;
use App\Http\Controllers\VariationController;
use App\Http\Controllers\QaStageController;
use App\Http\Controllers\QaStageDrawingController;
use App\Http\Controllers\QaStageDrawingObservationController;
use App\Http\Controllers\DrawingSetController;
use App\Http\Controllers\TitleBlockTemplateController;
use App\Http\Controllers\DrawingIndexController;
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
use App\Http\Controllers\SupplierCategoryController;
use App\Http\Controllers\UpdatePricingController;
use App\Http\Controllers\PushSubscriptionController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\LabourForecastController;
use App\Http\Controllers\PayRateTemplateController;
use App\Http\Controllers\VoiceCallController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\AllowanceTypeController;
use App\Http\Controllers\OncostController;

Route::get('/', function () {
    return redirect()->route('dashboard');
})->name('home');

Route::get('/notifications/mark-all-read', function () {
    $user = auth()->user();
    $user->unreadNotifications->markAsRead();
    return redirect()->back();
})->name('notifications.markAllRead');

Route::post('/notifications/{id}/mark-read', function ($id) {
    $user = auth()->user();
    $notification = $user->notifications()->where('id', $id)->first();
    if ($notification) {
        $notification->markAsRead();
    }
    return redirect()->back();
})->name('notifications.markRead');

// Push Notification Subscription Routes
Route::middleware('auth')->group(function () {
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store'])->name('push-subscriptions.store');
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy'])->name('push-subscriptions.destroy');
});

// AI Chat Routes (restricted to users with ai.chat permission)
Route::middleware(['auth', 'permission:ai.chat'])->group(function () {
    Route::post('/chat', [ChatController::class, 'handle'])->name('chat.handle');
    Route::post('/chat/stream', [ChatController::class, 'handleStream'])->name('chat.stream');
});

// AI Voice Routes (restricted to users with ai.voice permission)
Route::middleware(['auth', 'permission:ai.voice'])->group(function () {
    Route::post('/voice/session', [VoiceCallController::class, 'createSession'])->name('voice.session');
    Route::post('/voice/session/end', [VoiceCallController::class, 'endSession'])->name('voice.session.end');
    Route::post('/voice/tool', [VoiceCallController::class, 'executeTool'])->name('voice.tool');
});

Route::get('/employees/sync', [EmployeeController::class, 'sync'])->name('employees.sync');
Route::get('/requisition/update-status', [PurchasingController::class, 'updateStatusFromBuildMetrix'])
    ->name('requisition.updateStatusFromBuildMetrix');
Route::post('/requisition/update-status', [PurchasingController::class, 'updateStatusFromPowerAutomate'])
    ->name('requisition.updateStatusFromPowerAutomate');

Route::middleware(['auth', 'verified'])->group(function () {
    // Dashboard - requires dashboard.view permission
    Route::get('dashboard', function () {
        return Inertia::render('dashboard/main');
    })->name('dashboard')->middleware('permission:dashboard.view');

    // ============================================
    // USER MANAGEMENT
    // ============================================
    Route::middleware('permission:users.view')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::get('/users/edit/{user}', [UserController::class, 'edit'])->name('users.edit');
    });
    Route::put('/users/{user}', [UserController::class, 'update'])->name('users.update')
        ->middleware('permission:users.manage-roles');
    Route::post('/users/kiosk/{user}/store', [UserController::class, 'storeKiosk'])->name('users.kiosk.store')
        ->middleware('permission:kiosks.manage-managers');
    Route::get('/users/kiosk/{kiosk}/{user}/remove', [UserController::class, 'removeKiosk'])->name('users.kiosk.remove')
        ->middleware('permission:kiosks.manage-managers');

    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================
    Route::middleware('permission:employees.view')->group(function () {
        Route::get('employees', [EmployeeController::class, 'index'])->name('employees.index');
        Route::get('/employees/list', [EmployeeController::class, 'retrieveEmployees'])->name('employees.list');
    });
    Route::middleware('permission:employees.sync')->group(function () {
        Route::get('/employees/worktypes/sync', [EmployeeController::class, 'syncEmployeeWorktypes'])->name('employees.worktypes.sync');
        Route::get('/employee/{employeeId}/worktypes/sync', [EmployeeController::class, 'syncSingleEmployeeWorktype'])->name('employee.worktypes.sync');
        Route::get('/employees/kiosks/update', [EmployeeController::class, 'updateKioskEmployees'])->name('employees.kiosks.update');
    });

    // ============================================
    // LOCATION MANAGEMENT
    // ============================================
    // Static routes MUST come before wildcard routes to avoid {location} capturing "sync", "load-job-data", etc.
    Route::get('/locations/sync', [LocationController::class, 'sync'])->name('locations.sync')
        ->middleware('permission:locations.sync');
    Route::get('/locations/load-job-data', [LocationController::class, 'loadJobData'])->name('locations.loadJobData')
        ->middleware('permission:locations.load-job-data');
    Route::middleware('permission:locations.view')->group(function () {
        Route::get('/locations', [LocationController::class, 'index'])->name('locations.index');
        Route::get('/locations/{location}', [LocationController::class, 'show'])->name('locations.show');
    });
    Route::post('/locations', [LocationController::class, 'store'])->name('locations.store')
        ->middleware('permission:locations.create');
    Route::get('/locations/{location}/edit', [LocationController::class, 'edit'])->name('locations.edit')
        ->middleware('permission:locations.edit');
    Route::put('/locations/{location}', [LocationController::class, 'update'])->name('locations.update')
        ->middleware('permission:locations.edit');
    Route::delete('/locations/{location}', [LocationController::class, 'destroy'])->name('locations.destroy')
        ->middleware('permission:locations.delete');
    Route::post('sub-locations', [LocationController::class, 'createSubLocation'])->name('sub-locations.create')
        ->middleware('permission:locations.create');

    // ============================================
    // KIOSK MANAGEMENT
    // ============================================
    Route::middleware('permission:kiosks.view')->group(function () {
        Route::resource('kiosks', KioskController::class)->names('kiosks');
        Route::resource('clocks', ClockController::class)->names('clocks');
        Route::post('/clock/out', [ClockController::class, 'clockOut'])->name('clocks.out');
        Route::get('/kiosk/{kioskId}/employee/{employeeId}/pin', [KioskAuthController::class, 'showPinPage'])->name('kiosk.pin');
        Route::get('/kiosk/{kioskId}/employee/{employeeId}/pin/verify', function ($kioskId) {
            return redirect()->route('kiosks.show', ['kiosk' => $kioskId]);
        });
        Route::post('/kiosk/{kioskId}/employee/{employeeId}/pin/verify', [KioskAuthController::class, 'validatePin'])->name('kiosk.validate-pin');
        Route::get('kiosk/{kiosk}/auth/{employeeId}/reset-pin', [KioskAuthController::class, 'showResetPinPage'])->name('kiosk.auth.reset-pin');
        Route::post('kiosk/{kiosk}/auth/{employeeId}/reset-pin', [KioskAuthController::class, 'resetPin'])->name('kiosk.auth.reset-pin.post');
    });
    Route::get('/kiosks/{kioskId}/employees/sync', [KioskController::class, 'syncEmployees'])->name('kiosks.employees.sync')
        ->middleware('permission:kiosks.sync');
    Route::get('/kiosks/sync', [KioskController::class, 'sync'])->name('kiosks.sync')
        ->middleware('permission:kiosks.sync');
    Route::get('/kiosks/{kiosk}/edit', [KioskController::class, 'edit'])->name('kiosks.edit')
        ->middleware('permission:kiosks.edit');
    Route::post('/kiosks/{kiosk}/zones', [KioskController::class, 'updateZones'])->name('kiosks.updateZones')
        ->middleware('permission:kiosks.manage-zones');
    Route::get('/kiosks/{kiosk}/toggleActive', [KioskController::class, 'toggleActive'])->name('kiosk.toggleActive')
        ->middleware('permission:kiosks.toggle-active');
    Route::post('/kiosks/{kiosk}/add-employees', [KioskController::class, 'addEmployeesToKiosk'])->name('kiosks.addEmployees')
        ->middleware('permission:kiosks.manage-employees');
    Route::post('/kiosks/manager/store', [KioskController::class, 'storeManager'])->name('kiosks.manager.store')
        ->middleware('permission:kiosks.manage-managers');
    Route::post('/kiosks/{kioskId}/update-start-time', [ClockController::class, 'updateStartTimeForEmployees'])->name('clocks.updateStartTimeForEmployees')
        ->middleware('permission:clocks.manage');
    Route::get('/kiosks/{kioskId}/disable-admin-mode', [KioskController::class, 'disableAdminMode'])->name('kiosks.disable-admin-mode')
        ->middleware('permission:kiosks.edit');
    Route::post('/validate-kiosk-admin-pin', [KioskController::class, 'validateKioskAdminPin'])->name('kiosk.validate-admin-pin');
    Route::put('/kiosks/settings/update', [KioskController::class, 'updateSettings'])->name('kiosks.updateSettings')
        ->middleware('permission:kiosks.edit');
    Route::get('/generate-kiosk-token', [ClockController::class, 'generateKioskToken'])->name('clocks.generateKioskToken')
        ->middleware('permission:kiosks.retrieve-token');
    Route::get('/retrieve-kiosk-token', [ClockController::class, 'retrieveKioskToken'])->name('clocks.retrieveKioskToken')
        ->middleware('permission:kiosks.retrieve-token');

    // ============================================
    // TIMESHEET MANAGEMENT
    // ============================================
    Route::middleware('permission:timesheets.view')->group(function () {
        Route::get('/timesheets', [ClockController::class, 'viewTimesheet'])->name('timesheets.view');
    });
    Route::middleware('permission:timesheets.edit')->group(function () {
        Route::get('/timesheets/edit', [ClockController::class, 'editTimesheet'])->name('clock.edit.summary');
        Route::post('/timesheets/edit', [ClockController::class, 'saveTimesheets'])->name('clock.edit.summary.post');
    });
    Route::middleware('permission:timesheets.review')->group(function () {
        Route::get('/timesheets/review', [ClockController::class, 'reviewTimesheets'])->name('timesheets.review');
        Route::get('/timesheets/{employeeId}/{weekEnding}/approve-all', [ClockController::class, 'approveAllTimesheets'])->name('timesheets.approve-all');
    });
    Route::middleware('permission:timesheets.sync')->group(function () {
        Route::get('/clocks/eh/sync', [ClockController::class, 'syncEhTimesheets'])->name('clocks.eh.sync');
        Route::get('/timesheets/sync/eh/all', [ClockController::class, 'syncTimesheetsForAll'])->name('timesheets.sync.all');
        Route::get('/timesheets/{employeeId}/{weekEnding}/sync/eh', [ClockController::class, 'syncTimesheet'])->name('timesheets.sync');
    });
    Route::get('/timesheets-converter', [ClockController::class, 'showTimesheetsConverter'])->name('timesheets.converter')
        ->middleware('permission:timesheets.convert');
    Route::post('/timesheets-converter/upload', [ClockController::class, 'convertTimesheets'])->name('timesheets.converter.convert')
        ->middleware('permission:timesheets.convert');
    Route::delete('/clocks/{clock}/delete', [ClockController::class, 'destroy'])->name('clocks.destroy')
        ->middleware('permission:clocks.delete');

    // ============================================
    // WORKTYPE MANAGEMENT
    // ============================================
    Route::middleware('permission:worktypes.view')->group(function () {
        Route::get('/worktypes', [WorktypeController::class, 'index'])->name('worktypes.index');
        Route::get('/worktypes/{worktype}', [WorktypeController::class, 'show'])->name('worktypes.show');
    });
    Route::post('/worktypes', [WorktypeController::class, 'store'])->name('worktypes.store')
        ->middleware('permission:worktypes.create');
    Route::get('/worktypes/{worktype}/edit', [WorktypeController::class, 'edit'])->name('worktypes.edit')
        ->middleware('permission:worktypes.edit');
    Route::put('/worktypes/{worktype}', [WorktypeController::class, 'update'])->name('worktypes.update')
        ->middleware('permission:worktypes.edit');
    Route::delete('/worktypes/{worktype}', [WorktypeController::class, 'destroy'])->name('worktypes.destroy')
        ->middleware('permission:worktypes.delete');
    Route::get('/worktypes/sync', [WorktypeController::class, 'syncWorktypes'])->name('worktypes.sync')
        ->middleware('permission:worktypes.sync');

    // ============================================
    // REQUISITION MANAGEMENT
    // ============================================
    Route::get('/requisition/all', [PurchasingController::class, 'index'])->name('requisition.index')
        ->middleware('permission:requisitions.view');
    Route::middleware('permission:requisitions.create')->group(function () {
        Route::get('/requisition/create', [PurchasingController::class, 'create'])->name('requisition.create');
        Route::post('/requisition/store', [PurchasingController::class, 'store'])->name('requisition.store');
        Route::get('/requisition/{id}/copy', [PurchasingController::class, 'copy'])->name('requisition.copy');
    });
    // Note: {id} route must come AFTER /create to avoid matching "create" as an id
    Route::get('/requisition/{id}', [PurchasingController::class, 'show'])->name('requisition.show')
        ->middleware('permission:requisitions.view');
    Route::middleware('permission:requisitions.edit')->group(function () {
        Route::get('/requisition/{id}/edit', [PurchasingController::class, 'edit'])->name('requisition.edit');
        Route::put('/requisition/{requisition}', [PurchasingController::class, 'update'])->name('requisition.update');
        Route::get('/requisition/{id}/toggle-requisition-template', [PurchasingController::class, 'toggleRequisitionTemplate'])->name('requisition.toggle-template');
        Route::post('/requisition/{id}/notes', [RequisitionNoteController::class, 'store'])->name('requisition.addNote');
        Route::get('/location/{locationId}/req-header/edit', [RequisitionHeaderTemplateController::class, 'edit'])->name('location.req-header.edit');
        Route::put('/location/{locationId}/req-header/update', [RequisitionHeaderTemplateController::class, 'update'])->name('location.req-header.update');
    });
    Route::get('/requisition/{id}/delete', [PurchasingController::class, 'destroy'])->name('requisition.delete')
        ->middleware('permission:requisitions.delete');
    Route::middleware('permission:requisitions.process')->group(function () {
        Route::get('/requisition/{id}/process', [PurchasingController::class, 'process'])->name('requisition.process');
        Route::get('/requisition/{id}/api-send', [PurchasingController::class, 'sendApi'])->name('requisition.sendapi');
        Route::get('/location/{locationId}/purchase-orders/sync-premier', [PurchasingController::class, 'getPurchaseOrdersForLocation'])->name('location.purchase-orders');
    });
    Route::get('/requisition/{id}/mark-sent-to-supplier', [PurchasingController::class, 'markSentToSupplier'])->name('requisition.markSentToSupplier')
        ->middleware('permission:requisitions.send');
    Route::middleware('permission:requisitions.export')->group(function () {
        Route::get('requisition/pdf/{requisition}', PurchasingController::class)->name('requisition.pdf');
        Route::get('requisition/excel/{requisition}', [PurchasingController::class, 'excelImport'])->name('requisition.excel');
    });

    // ============================================
    // MATERIAL ITEMS MANAGEMENT
    // ============================================
    Route::middleware('permission:materials.view')->group(function () {
        Route::get('material-items/all', [MaterialItemController::class, 'index'])->name('material-items.index');
        Route::get('/material-items', [MaterialItemController::class, 'getMaterialItems']);
        Route::get('/material-items/{id}/{locationId}', [MaterialItemController::class, 'getMaterialItemById'])->where(['id' => '[0-9]+', 'locationId' => '[0-9]+']);
        Route::get('/material-items/code/{code}/{locationId}', [MaterialItemController::class, 'getMaterialItemByCode']);
    });
    Route::middleware('permission:materials.create')->group(function () {
        Route::get('material-items/create', [MaterialItemController::class, 'create'])->name('material-items.create');
        Route::post('material-items/store', [MaterialItemController::class, 'store'])->name('material-items.store');
    });
    Route::middleware('permission:materials.edit')->group(function () {
        Route::get('material-items/{materialItem}/edit', [MaterialItemController::class, 'edit'])->name('material-items.edit');
        Route::get('material-items/{materialItem}/next', [MaterialItemController::class, 'next'])->name('material-items.next');
        Route::get('material-items/{materialItem}/previous', [MaterialItemController::class, 'previous'])->name('material-items.previous');
        Route::put('material-items/{materialItem}', [MaterialItemController::class, 'update'])->name('material-items.update');
        Route::patch('material-items/{materialItem}/category', [MaterialItemController::class, 'updateCategory'])->name('material-items.update-category');
    });
    Route::delete('material-items/{materialItem}', [MaterialItemController::class, 'destroy'])->name('material-items.destroy')
        ->middleware('permission:materials.delete');
    Route::delete('material-items/delete-multiple', [MaterialItemController::class, 'destroyMultiple'])->name('material-items.destroyMultiple')
        ->middleware('permission:materials.bulk-delete');
    Route::middleware('permission:materials.import')->group(function () {
        Route::post('/material-items/upload', [MaterialItemController::class, 'upload']);
        Route::post('/material-items/location/upload', [MaterialItemController::class, 'uploadLocationPricing']);
    });
    Route::middleware('permission:materials.export')->group(function () {
        Route::get('material-items/download', [MaterialItemController::class, 'download'])->name('material-items.download');
        Route::get('/material-items/location/{locationId}/download-csv', [MaterialItemController::class, 'downloadLocationPricingListCSV']);
        Route::get('/material-items/location/{locationId}/download-excel', [MaterialItemController::class, 'downloadLocationPricingListExcel']);
    });

    // ============================================
    // SUPPLIER MANAGEMENT
    // ============================================
    Route::get('/suppliers', [SupplierController::class, 'index'])->name('suppliers.index')
        ->middleware('permission:suppliers.view');
    Route::get('/suppliers/download', [SupplierController::class, 'download'])->name('suppliers.download')
        ->middleware('permission:suppliers.export');
    Route::post('/suppliers/upload', [SupplierController::class, 'upload'])->name('suppliers.upload')
        ->middleware('permission:suppliers.import');

    // ============================================
    // SUPPLIER CATEGORY MANAGEMENT
    // ============================================
    Route::get('/supplier-categories', [SupplierCategoryController::class, 'index'])->name('supplier-categories.index');
    Route::get('/supplier-categories/create', [SupplierCategoryController::class, 'create'])->name('supplier-categories.create');
    Route::post('/supplier-categories/store', [SupplierCategoryController::class, 'store'])->name('supplier-categories.store');
    Route::get('/supplier-categories/{supplierCategory}/edit', [SupplierCategoryController::class, 'edit'])->name('supplier-categories.edit');
    Route::put('/supplier-categories/{supplierCategory}', [SupplierCategoryController::class, 'update'])->name('supplier-categories.update');
    Route::delete('/supplier-categories/{supplierCategory}', [SupplierCategoryController::class, 'destroy'])->name('supplier-categories.destroy');
    Route::get('/supplier-categories/by-supplier/{supplierId}', [SupplierCategoryController::class, 'getBySupplier']);

    // ============================================
    // UPDATE PRICING
    // ============================================
    Route::get('/update-pricing', [UpdatePricingController::class, 'index'])->name('update-pricing.index');
    Route::post('/update-pricing/preview', [UpdatePricingController::class, 'preview'])->name('update-pricing.preview');
    Route::post('/update-pricing/apply', [UpdatePricingController::class, 'apply'])->name('update-pricing.apply');

    // ============================================
    // COST CODE MANAGEMENT
    // ============================================
    Route::get('/cost-codes', [CostcodeController::class, 'index'])->name('costcodes.index')
        ->middleware('permission:costcodes.view');
    Route::post('/cost-codes/upload', [CostcodeController::class, 'upload'])->name('costcodes.upload')
        ->middleware('permission:costcodes.import');
    Route::get('/cost-codes/download', [CostcodeController::class, 'download'])->name('costcodes.download')
        ->middleware('permission:costcodes.export');
    Route::delete('/cost-codes/{costcode}', [CostcodeController::class, 'destroy'])->name('costcodes.destroy')
        ->middleware('permission:costcodes.delete');

    // Cost Types
    Route::get('/cost-types', [CostTypeController::class, 'index'])->name('costtypes.index')
        ->middleware('permission:costtypes.view');
    Route::post('/cost-types/upload', [CostTypeController::class, 'upload'])->name('costtypes.upload')
        ->middleware('permission:costtypes.import');
    Route::get('/cost-types/download', [CostTypeController::class, 'download'])->name('costtypes.download')
        ->middleware('permission:costtypes.export');

    // Allowance Types
    Route::get('/allowance-types', [AllowanceTypeController::class, 'index'])->name('allowance-types.index')
        ->middleware('permission:materials.view');
    Route::post('/allowance-types', [AllowanceTypeController::class, 'store'])->name('allowance-types.store')
        ->middleware('permission:materials.view');
    Route::put('/allowance-types/{allowanceType}', [AllowanceTypeController::class, 'update'])->name('allowance-types.update')
        ->middleware('permission:materials.view');
    Route::delete('/allowance-types/{allowanceType}', [AllowanceTypeController::class, 'destroy'])->name('allowance-types.destroy')
        ->middleware('permission:materials.view');

    // Oncosts
    Route::get('/oncosts', [OncostController::class, 'index'])->name('oncosts.index')
        ->middleware('permission:materials.view');
    Route::post('/oncosts', [OncostController::class, 'store'])->name('oncosts.store')
        ->middleware('permission:materials.view');
    Route::put('/oncosts/{oncost}', [OncostController::class, 'update'])->name('oncosts.update')
        ->middleware('permission:materials.view');
    Route::delete('/oncosts/{oncost}', [OncostController::class, 'destroy'])->name('oncosts.destroy')
        ->middleware('permission:materials.view');

    // Location Cost Codes
    Route::get('/location/{location}/cost-codes/sync', [LocationCostcodeController::class, 'sync'])->name('locationCostcodes.sync')
        ->middleware('permission:costcodes.edit');
    Route::get('/location/{location}/cost-codes/edit', [LocationCostcodeController::class, 'edit'])->name('locationCostcodes.edit')
        ->middleware('permission:costcodes.edit');
    Route::get('/locations/{location}/cost-codes/{id}/delete', [LocationCostcodeController::class, 'delete'])->name('locationCostcodes.delete')
        ->middleware('permission:costcodes.delete');
    Route::get('/location/{location}/cost-code-ratios/download-csv', [LocationCostcodeController::class, 'downloadCostCodeRatios'])->name('location.cost-code-ratios.download')
        ->middleware('permission:costcodes.export');
    Route::post('/location/{location}/cost-code-ratios/upload', [LocationCostcodeController::class, 'upload'])->name('locationCostcodes.upload')
        ->middleware('permission:costcodes.import');
    Route::put('/location/{location}/cost-codes/update', [LocationCostcodeController::class, 'update'])->name('locationCostcodes.update')
        ->middleware('permission:costcodes.edit');

    // ============================================
    // CALENDAR & TIMESHEET EVENTS
    // ============================================
    Route::get('/calendar', [CalendarController::class, 'main'])->name('calendar.main')
        ->middleware('permission:calendar.view');
    Route::post('/timesheet-events/store', [TimesheetEventController::class, 'store'])->name('timesheetEvents.store')
        ->middleware('permission:timesheet-events.create');
    Route::post('/timesheet-events/update', [TimesheetEventController::class, 'update'])->name('timesheetEvents.update')
        ->middleware('permission:timesheet-events.edit');
    Route::get('/timesheet-events/{event}', [TimesheetEventController::class, 'destroy'])->name('timesheetEvents.destroy')
        ->middleware('permission:timesheet-events.delete');
    Route::middleware('permission:timesheet-events.generate')->group(function () {
        Route::get('/{kiosk}/timesheet-events/generate', [TimesheetEventController::class, 'generateTimesheetForToday'])->name('timesheetEvents.generateToday');
        Route::post('/timesheet-events/{eventId}/{kioskId}/generate-timesheets', [TimesheetEventController::class, 'generateTimesheets'])->name('events.generateTimesheets');
    });

    // ============================================
    // FORECASTING
    // ============================================
    Route::middleware('permission:forecast.view')->group(function () {
        Route::get('/location/{location}/job-data', [LocationController::class, 'LoadJobDataFromPremier'])->name('locations.loadJobData');
        Route::get('/location/{location}/job-forecast', [JobForecastController::class, 'show'])->name('jobForecast.show');
        Route::get('/location/{location}/job-forecast/labour-costs', [JobForecastController::class, 'getLabourCostsForJobForecast'])->name('jobForecast.labourCosts');
        Route::get('/location/{location}/compare-forecast-actuals', [JobForecastController::class, 'compareForecast'])->name('forecast.compareForecast');
    });
    Route::middleware('permission:forecast.edit')->group(function () {
        Route::post('/location/{location}/job-forecast', [JobForecastController::class, 'store'])->name('jobForecast.store');
        Route::post('/location/{location}/job-forecast/lock', [JobForecastController::class, 'toggleLock'])->name('jobForecast.lock');
        Route::post('/location/{location}/job-forecast/copy-from-previous', [JobForecastController::class, 'copyFromPreviousMonth'])->name('jobForecast.copyFromPrevious');
        Route::post('/location/{location}/job-forecast/summary-comments', [JobForecastController::class, 'updateSummaryComments'])->name('jobForecast.summaryComments');
    });
    Route::post('/location/{location}/job-forecast/submit', [JobForecastController::class, 'submit'])->name('jobForecast.submit')
        ->middleware('permission:forecast.submit');
    Route::middleware('permission:forecast.approve')->group(function () {
        Route::post('/location/{location}/job-forecast/finalize', [JobForecastController::class, 'finalize'])->name('jobForecast.finalize');
    });
    Route::post('/location/{location}/job-forecast/reject', [JobForecastController::class, 'reject'])->name('jobForecast.reject')
        ->middleware('permission:forecast.reject');

    // Forecast Projects
    Route::get('/forecast-projects', [ForecastProjectController::class, 'index'])->name('forecastProjects.index')
        ->middleware('permission:forecast-projects.view');
    Route::get('/forecast-projects/{id}', [ForecastProjectController::class, 'show'])->name('forecastProjects.show')
        ->middleware('permission:forecast-projects.view');
    Route::post('/forecast-projects', [ForecastProjectController::class, 'store'])->name('forecastProjects.store')
        ->middleware('permission:forecast-projects.create');
    Route::middleware('permission:forecast-projects.edit')->group(function () {
        Route::put('/forecast-projects/{id}', [ForecastProjectController::class, 'update'])->name('forecastProjects.update');
        Route::post('/forecast-projects/{id}/items', [ForecastProjectController::class, 'saveItems'])->name('forecastProjects.saveItems');
        Route::post('/forecast-projects/{id}/cost-items', [ForecastProjectController::class, 'addCostItem'])->name('forecastProjects.addCostItem');
        Route::put('/forecast-projects/{projectId}/cost-items/{itemId}', [ForecastProjectController::class, 'updateCostItem'])->name('forecastProjects.updateCostItem');
        Route::delete('/forecast-projects/{projectId}/cost-items/{itemId}', [ForecastProjectController::class, 'deleteCostItem'])->name('forecastProjects.deleteCostItem');
        Route::post('/forecast-projects/{id}/revenue-items', [ForecastProjectController::class, 'addRevenueItem'])->name('forecastProjects.addRevenueItem');
        Route::put('/forecast-projects/{projectId}/revenue-items/{itemId}', [ForecastProjectController::class, 'updateRevenueItem'])->name('forecastProjects.updateRevenueItem');
        Route::delete('/forecast-projects/{projectId}/revenue-items/{itemId}', [ForecastProjectController::class, 'deleteRevenueItem'])->name('forecastProjects.deleteRevenueItem');
        Route::post('/forecast-projects/{id}/forecast', [ForecastProjectController::class, 'storeForecast'])->name('forecastProjects.storeForecast');
    });
    Route::delete('/forecast-projects/{id}', [ForecastProjectController::class, 'destroy'])->name('forecastProjects.destroy')
        ->middleware('permission:forecast-projects.delete');

    // Turnover & Cash Forecast
    Route::get('/turnover-forecast', [TurnoverForecastController::class, 'index'])->name('turnoverForecast.index')
        ->middleware('permission:turnover-forecast.view');
    Route::get('/cash-forecast', CashForecastController::class)->name('cashForecast.show')
        ->middleware('permission:cash-forecast.view');
    Route::get('/cash-forecast/unmapped', [CashForecastController::class, 'unmappedTransactions'])->name('cashForecast.unmapped')
        ->middleware('permission:cash-forecast.view');
    Route::middleware('permission:cash-forecast.edit')->group(function () {
        Route::post('/cash-forecast/settings', [CashForecastController::class, 'updateSettings'])->name('cashForecast.updateSettings');
        Route::post('/cash-forecast/general-costs', [CashForecastController::class, 'storeGeneralCost'])->name('cashForecast.storeGeneralCost');
        Route::put('/cash-forecast/general-costs/{generalCost}', [CashForecastController::class, 'updateGeneralCost'])->name('cashForecast.updateGeneralCost');
        Route::delete('/cash-forecast/general-costs/{generalCost}', [CashForecastController::class, 'destroyGeneralCost'])->name('cashForecast.destroyGeneralCost');
        Route::post('/cash-forecast/cash-in-adjustments', [CashForecastController::class, 'storeCashInAdjustments'])->name('cashForecast.storeCashInAdjustments');
        Route::post('/cash-forecast/cash-out-adjustments', [CashForecastController::class, 'storeCashOutAdjustments'])->name('cashForecast.storeCashOutAdjustments');
        Route::post('/cash-forecast/vendor-payment-delays', [CashForecastController::class, 'storeVendorPaymentDelays'])->name('cashForecast.storeVendorPaymentDelays');
    });

    // Labour Forecast
    Route::get('/labour-forecast', [LabourForecastController::class, 'index'])->name('labour-forecast.index');
    Route::get('/location/{location}/labour-forecast/show', [LabourForecastController::class, 'show'])->name('labour-forecast.show');
    Route::get('/location/{location}/labour-forecast/variance', [LabourForecastController::class, 'variance'])->name('labour-forecast.variance');
    Route::get('/location/{location}/labour-forecast/cost-breakdown', [LabourForecastController::class, 'getCostBreakdown'])->name('labour-forecast.cost-breakdown');
    Route::post('/location/{location}/labour-forecast/calculate-weekly-cost', [LabourForecastController::class, 'calculateWeeklyCost'])->name('labour-forecast.calculate-weekly-cost');
    Route::post('/location/{location}/labour-forecast/calculate-weekly-costs-batch', [LabourForecastController::class, 'calculateWeeklyCostsBatch'])->name('labour-forecast.calculate-weekly-costs-batch');
    Route::post('/location/{location}/labour-forecast/templates', [LabourForecastController::class, 'updateTemplates'])->name('labour-forecast.update-templates');
    Route::post('/location/{location}/labour-forecast/templates/add', [LabourForecastController::class, 'addTemplate'])->name('labour-forecast.add-template');
    Route::delete('/location/{location}/labour-forecast/templates/{template}', [LabourForecastController::class, 'removeTemplate'])->name('labour-forecast.remove-template');
    Route::put('/location/{location}/labour-forecast/templates/{template}/label', [LabourForecastController::class, 'updateTemplateLabel'])->name('labour-forecast.update-template-label');
    Route::put('/location/{location}/labour-forecast/templates/{template}/allowances', [LabourForecastController::class, 'updateTemplateAllowances'])->name('labour-forecast.update-template-allowances');
    // Labour Forecast - Save & Workflow
    Route::post('/location/{location}/labour-forecast/save', [LabourForecastController::class, 'save'])->name('labour-forecast.save');
    Route::post('/location/{location}/labour-forecast/copy-previous', [LabourForecastController::class, 'copyFromPreviousMonth'])->name('labour-forecast.copy-previous');
    Route::post('/location/{location}/labour-forecast/{forecast}/submit', [LabourForecastController::class, 'submit'])->name('labour-forecast.submit');
    Route::post('/location/{location}/labour-forecast/{forecast}/approve', [LabourForecastController::class, 'approve'])->name('labour-forecast.approve');
    Route::post('/location/{location}/labour-forecast/{forecast}/reject', [LabourForecastController::class, 'reject'])->name('labour-forecast.reject');
    Route::post('/location/{location}/labour-forecast/{forecast}/revert', [LabourForecastController::class, 'revertToDraft'])->name('labour-forecast.revert');

    // ============================================
    // PAY RATE TEMPLATES
    // ============================================
    Route::get('/pay-rate-templates', [PayRateTemplateController::class, 'index'])->name('pay-rate-templates.index');
    Route::get('/pay-rate-templates/sync-categories', [PayRateTemplateController::class, 'syncPayCategories'])->name('pay-rate-templates.sync-categories');
    Route::get('/pay-rate-templates/sync-templates', [PayRateTemplateController::class, 'syncPayRateTemplates'])->name('pay-rate-templates.sync-templates');
    Route::get('/pay-rate-templates/sync-all', [PayRateTemplateController::class, 'syncAll'])->name('pay-rate-templates.sync-all');

    // ============================================
    // BUDGET MANAGEMENT (Admin only)
    // ============================================
    Route::middleware('permission:budget.view')->group(function () {
        Route::get('/budget-management', [CompanyRevenueTargetController::class, 'index'])->name('budgetManagement.index');
    });
    Route::post('/budget-management', [CompanyRevenueTargetController::class, 'store'])->name('budgetManagement.store')
        ->middleware('permission:budget.edit');

    // ============================================
    // VARIATIONS
    // ============================================
    Route::middleware('permission:variations.view')->group(function () {
        Route::get('/locations/{location}/variations', [VariationController::class, 'locationVariations'])->name('locations.variations');
        Route::get('/variations', [VariationController::class, 'index'])->name('variations.index');
    });
    Route::middleware('permission:variations.create')->group(function () {
        Route::get('/variations/create', [VariationController::class, 'create'])->name('variations.create');
        Route::post('/variations/store', [VariationController::class, 'store'])->name('variations.store');
        Route::get('/variations/{variation}/duplicate', [VariationController::class, 'duplicate'])->name('variations.duplicate');
    });
    Route::middleware('permission:variations.edit')->group(function () {
        Route::get('/variations/{variation}/edit', [VariationController::class, 'edit'])->name('variations.edit');
        Route::post('/variations/{variation}/update', [VariationController::class, 'update'])->name('variations.update');
    });
    Route::get('/variations/{id}', [VariationController::class, 'destroy'])->name('variations.destroy')
        ->middleware('permission:variations.delete');
    Route::get('/locations/{location}/variations/sync', [VariationController::class, 'loadVariationsFromPremier'])->name('variations.sync')
        ->middleware('permission:variations.sync');
    Route::get('/variations/{variation}/send-to-premier', [VariationController::class, 'sendToPremier'])->name('variations.send')
        ->middleware('permission:variations.send');
    Route::get('/variations/{id}/download/excel', [VariationController::class, 'download'])->name('variations.download')
        ->middleware('permission:variations.export');

    // ============================================
    // QA STAGES
    // ============================================
    Route::get('/qa-stages', [QaStageController::class, 'index'])->name('qa-stages.index')
        ->middleware('permission:qa-stages.view');
    Route::get('/qa-stages/{qaStage}', [QaStageController::class, 'show'])->name('qa-stages.show')
        ->middleware('permission:qa-stages.view');
    Route::post('/qa-stages', [QaStageController::class, 'store'])->name('qa-stages.store')
        ->middleware('permission:qa-stages.create');
    Route::delete('/qa-stages/{qaStage}', [QaStageController::class, 'destroy'])->name('qa-stages.destroy')
        ->middleware('permission:qa-stages.delete');

    // QA Drawings
    Route::get('/qa-stage-drawings/{drawing}', [QaStageDrawingController::class, 'show'])->name('qa-stage-drawings.show')
        ->middleware('permission:qa-drawings.view');
    Route::get('/qa-stage-drawings/{drawing}/download', [QaStageDrawingController::class, 'download'])->name('qa-stage-drawings.download')
        ->middleware('permission:qa-drawings.view');
    Route::middleware('permission:qa-drawings.create')->group(function () {
        Route::post('/qa-stages/{qaStage}/drawings', [QaStageDrawingController::class, 'store'])->name('qa-stage-drawings.store');
        Route::post('/qa-stage-drawings/{drawing}/extract-metadata', [QaStageDrawingController::class, 'extractMetadata'])->name('qa-stage-drawings.extract-metadata');
    });
    Route::delete('/qa-stage-drawings/{drawing}', [QaStageDrawingController::class, 'destroy'])->name('qa-stage-drawings.destroy')
        ->middleware('permission:qa-drawings.delete');
    Route::middleware('permission:qa-observations.manage')->group(function () {
        Route::post('/qa-stage-drawings/{drawing}/observations', [QaStageDrawingObservationController::class, 'store'])->name('qa-stage-drawings.observations.store');
        Route::post('/qa-stage-drawings/{drawing}/observations/{observation}', [QaStageDrawingObservationController::class, 'update'])->name('qa-stage-drawings.observations.update');
        Route::post('/qa-stage-drawings/{drawing}/observations/{observation}/confirm', [QaStageDrawingObservationController::class, 'confirm'])->name('qa-stage-drawings.observations.confirm');
        Route::delete('/qa-stage-drawings/{drawing}/observations/{observation}', [QaStageDrawingObservationController::class, 'destroy'])->name('qa-stage-drawings.observations.destroy');
        Route::post('/qa-stage-drawings/{drawing}/observations/{observation}/describe', [QaStageDrawingObservationController::class, 'describe'])->name('qa-stage-drawings.observations.describe');
    });

    // Drawing alignment persistence
    Route::post('/qa-stage-drawings/{drawing}/alignment', [QaStageDrawingController::class, 'saveAlignment'])->name('qa-stage-drawings.alignment.save')
        ->middleware('permission:qa-drawings.view');
    Route::get('/qa-stage-drawings/{drawing}/alignment/{candidateDrawing}', [QaStageDrawingController::class, 'getAlignment'])->name('qa-stage-drawings.alignment.get')
        ->middleware('permission:qa-drawings.view');
    Route::delete('/qa-stage-drawings/{drawing}/alignment/{candidateDrawing}', [QaStageDrawingController::class, 'deleteAlignment'])->name('qa-stage-drawings.alignment.delete')
        ->middleware('permission:qa-drawings.view');

    // ============================================
    // DRAWING INDEX (All drawings for a project)
    // ============================================
    Route::get('/projects/{project}/drawings', [DrawingIndexController::class, 'index'])
        ->name('drawings.index')
        ->middleware('permission:qa-drawings.view');

    // ============================================
    // DRAWING SETS (PDF Upload & Textract Extraction)
    // ============================================
    Route::middleware('permission:qa-drawings.view')->group(function () {
        Route::get('/projects/{project}/drawing-sets', [DrawingSetController::class, 'index'])->name('drawing-sets.index');
        Route::get('/drawing-sets/{drawingSet}', [DrawingSetController::class, 'show'])->name('drawing-sets.show');
        Route::get('/drawing-sets/{drawingSet}/pdf', [DrawingSetController::class, 'servePdf'])->name('drawing-sets.pdf');
        Route::get('/drawing-sheets/{sheet}/preview', [DrawingSetController::class, 'sheetPreview'])->name('drawing-sheets.preview');
        Route::get('/drawing-sheets/{sheet}/thumbnail', [DrawingSetController::class, 'sheetThumbnail'])->name('drawing-sheets.thumbnail');
    });
    Route::middleware('permission:qa-drawings.create')->group(function () {
        Route::post('/projects/{project}/drawing-sets', [DrawingSetController::class, 'store'])->name('drawing-sets.store');
        Route::patch('/drawing-sheets/{sheet}', [DrawingSetController::class, 'updateSheet'])->name('drawing-sheets.update');
        Route::post('/drawing-sheets/{sheet}/retry', [DrawingSetController::class, 'retryExtraction'])->name('drawing-sheets.retry');
        Route::post('/drawing-sets/{drawingSet}/retry-all', [DrawingSetController::class, 'retryAllExtraction'])->name('drawing-sets.retry-all');
        Route::post('/drawing-sets/{drawingSet}/relink-sheets', [DrawingSetController::class, 'relinkSheets'])->name('drawing-sets.relink-sheets');
        Route::post('/drawing-sheets/{sheet}/create-template', [TitleBlockTemplateController::class, 'createFromSheet'])->name('drawing-sheets.create-template');
        // AI Drawing Comparison
        Route::post('/drawing-sheets/compare', [DrawingSetController::class, 'compareRevisions'])->name('drawing-sheets.compare');
        Route::post('/drawing-sheets/compare/save-observations', [DrawingSetController::class, 'saveComparisonAsObservations'])->name('drawing-sheets.compare.save-observations');
        Route::get('/drawing-sheets-group/{drawingSheet}/revisions', [DrawingSetController::class, 'getDrawingSheetRevisions'])->name('drawing-sheets-group.revisions');
    });
    Route::delete('/drawing-sets/{drawingSet}', [DrawingSetController::class, 'destroy'])->name('drawing-sets.destroy')
        ->middleware('permission:qa-drawings.delete');

    // Title Block Templates
    Route::middleware('permission:qa-drawings.view')->group(function () {
        Route::get('/projects/{project}/templates', [TitleBlockTemplateController::class, 'index'])->name('title-block-templates.index');
        Route::post('/templates/{template}/test', [TitleBlockTemplateController::class, 'test'])->name('title-block-templates.test');
        Route::post('/drawing-sheets/{sheet}/detect-text', [TitleBlockTemplateController::class, 'detectTextBlocks'])->name('drawing-sheets.detect-text');
    });
    Route::middleware('permission:qa-drawings.create')->group(function () {
        Route::post('/projects/{project}/templates', [TitleBlockTemplateController::class, 'store'])->name('title-block-templates.store');
        Route::put('/templates/{template}', [TitleBlockTemplateController::class, 'update'])->name('title-block-templates.update');
        Route::put('/templates/{template}/field-mappings', [TitleBlockTemplateController::class, 'saveFieldMappings'])->name('title-block-templates.field-mappings');
        Route::delete('/templates/{template}', [TitleBlockTemplateController::class, 'destroy'])->name('title-block-templates.destroy');
    });

    // ============================================
    // REPORTS
    // ============================================
    Route::get('/reports/req-line-items-desc', [ReportController::class, 'reqLineReport'])->name('reports.reqLineReport')
        ->middleware('permission:reports.requisition-lines');

    // ============================================
    // SYSTEM & ADMIN
    // ============================================
    Route::get('/queue-status', [QueueStatusController::class, 'index'])->name('queueStatus.index')
        ->middleware('permission:queue-status.view');
    Route::get('/queue-status/stats', [QueueStatusController::class, 'stats'])->name('queueStatus.stats')
        ->middleware('permission:queue-status.view');

    // Role & Permission Management (Admin only)
    Route::middleware('permission:admin.roles')->group(function () {
        Route::get('/admin/roles', [RoleController::class, 'index'])->name('admin.roles.index');
        Route::post('/admin/roles', [RoleController::class, 'store'])->name('admin.roles.store');
        Route::put('/admin/roles/{role}', [RoleController::class, 'update'])->name('admin.roles.update');
        Route::delete('/admin/roles/{role}', [RoleController::class, 'destroy'])->name('admin.roles.destroy');
        Route::get('/admin/permissions', [PermissionController::class, 'index'])->name('admin.permissions.index');
        Route::post('/admin/permissions', [PermissionController::class, 'store'])->name('admin.permissions.store');
        Route::delete('/admin/permissions/{permission}', [PermissionController::class, 'destroy'])->name('admin.permissions.destroy');
    });

    // Favourite Material Items for Locations
    Route::post('/location/{location}/favourite-materials/upload', [LocationFavouriteMaterialItemsController::class, 'uploadFavouriteMaterials'])->name('location.favourite-materials.upload')
        ->middleware('permission:materials.import');
    Route::get('/location/{location}/favourite-materials/download-csv', [LocationFavouriteMaterialItemsController::class, 'downloadFavouriteMaterials'])->name('location.favourite-materials.download')
        ->middleware('permission:materials.export');

    // PHP Limits (debug route)
    Route::get('/php-limits', fn() => response()->json([
        'sapi' => php_sapi_name(),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'post_max_size' => ini_get('post_max_size'),
        'memory_limit' => ini_get('memory_limit'),
    ]));
});

Route::get('kiosks/{kioskId}/validate-token', [KioskController::class, 'validateToken'])->name('kiosk.validateToken');

Route::get('/kiosk', function () {
    $employees = Employee::all();
    return Inertia::render('kiosks/show', [
        'employees' => $employees,
    ]);
})->name('kiosk');

require __DIR__ . '/settings.php';
require __DIR__ . '/location.php';
require __DIR__ . '/auth.php';
