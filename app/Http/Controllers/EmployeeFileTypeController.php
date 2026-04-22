<?php

namespace App\Http\Controllers;

use App\Models\EmployeeFileType;
use App\Models\Location;
use App\Models\Worktype;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class EmployeeFileTypeController extends Controller
{
    public function index()
    {
        $fileTypes = EmployeeFileType::orderBy('sort_order')->orderBy('name')->get();
        $worktypes = Worktype::orderBy('name')->get(['id', 'name']);
        $locations = Location::whereNull('eh_parent_id')->orderBy('name')->get(['id', 'name']);

        return Inertia::render('employee-file-types/index', [
            'fileTypes' => $fileTypes,
            'worktypes' => $worktypes,
            'locations' => $locations,
            'employmentTypes' => ['FullTime', 'PartTime', 'Casual'],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|array',
            'category.*' => 'string|max:255',
            'description' => 'nullable|string',
            'has_back_side' => 'boolean',
            'expiry_requirement' => 'in:required,optional,none',
            'requires_completed_date' => 'boolean',
            'allow_multiple' => 'boolean',
            'options' => 'nullable|array',
            'options.*' => 'string|max:255',
            'conditions' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $validated['slug'] = Str::slug($validated['name']);

        EmployeeFileType::create($validated);

        return redirect()->back()->with('success', 'File type created successfully.');
    }

    public function update(Request $request, EmployeeFileType $employeeFileType)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|array',
            'category.*' => 'string|max:255',
            'description' => 'nullable|string',
            'has_back_side' => 'boolean',
            'expiry_requirement' => 'in:required,optional,none',
            'requires_completed_date' => 'boolean',
            'allow_multiple' => 'boolean',
            'options' => 'nullable|array',
            'options.*' => 'string|max:255',
            'conditions' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $validated['slug'] = Str::slug($validated['name']);

        $employeeFileType->update($validated);

        return redirect()->back()->with('success', 'File type updated successfully.');
    }

    public function destroy(EmployeeFileType $employeeFileType)
    {
        $employeeFileType->update(['is_active' => false]);

        return redirect()->back()->with('success', 'File type deactivated.');
    }
}
