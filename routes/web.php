<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Models\Employee;
use App\Http\Controllers\EmployeeController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('employees', [EmployeeController::class, 'index'])->name('employees.index');
    Route::get('/employees/sync', [EmployeeController::class, 'sync'])->name('employees.sync');

});

Route::get('/kiosk', function () {
    $employees = Employee::all();

    return Inertia::render('kiosks/show', [
        'employees' => $employees,
    ]);
})->name('kiosk');


require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
