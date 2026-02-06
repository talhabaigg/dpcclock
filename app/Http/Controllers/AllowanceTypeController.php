<?php

namespace App\Http\Controllers;

use App\Models\AllowanceType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AllowanceTypeController extends Controller
{
    public function index()
    {
        $allowanceTypes = AllowanceType::ordered()->get();

        return Inertia::render('allowanceTypes/index', [
            'allowanceTypes' => $allowanceTypes,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:allowance_types,code',
            'description' => 'nullable|string',
            'default_rate' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        AllowanceType::create($validated);

        return redirect()->back()->with('success', 'Allowance type created successfully.');
    }

    public function update(Request $request, AllowanceType $allowanceType)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:allowance_types,code,'.$allowanceType->id,
            'description' => 'nullable|string',
            'default_rate' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);

        $allowanceType->update($validated);

        return redirect()->back()->with('success', 'Allowance type updated successfully.');
    }

    public function destroy(AllowanceType $allowanceType)
    {
        // Check if allowance type is in use
        if ($allowanceType->locationTemplateAllowances()->exists()) {
            return redirect()->back()->with('error', 'Cannot delete allowance type that is in use.');
        }

        $allowanceType->delete();

        return redirect()->back()->with('success', 'Allowance type deleted successfully.');
    }
}
