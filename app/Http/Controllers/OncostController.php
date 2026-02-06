<?php

namespace App\Http\Controllers;

use App\Models\Oncost;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OncostController extends Controller
{
    public function index()
    {
        $oncosts = Oncost::ordered()->get();

        return Inertia::render('oncosts/index', [
            'oncosts' => $oncosts,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:oncosts,code',
            'description' => 'nullable|string',
            'weekly_amount' => 'required_if:is_percentage,false|nullable|numeric|min:0',
            'is_percentage' => 'boolean',
            'percentage_rate' => 'required_if:is_percentage,true|nullable|numeric|min:0|max:1',
            'applies_to_overtime' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        // Ensure weekly_amount is 0 for percentage-based oncosts
        if ($validated['is_percentage'] ?? false) {
            $validated['weekly_amount'] = 0;
        }

        Oncost::create($validated);

        return redirect()->back()->with('success', 'Oncost created successfully.');
    }

    public function update(Request $request, Oncost $oncost)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:oncosts,code,'.$oncost->id,
            'description' => 'nullable|string',
            'weekly_amount' => 'required_if:is_percentage,false|nullable|numeric|min:0',
            'is_percentage' => 'boolean',
            'percentage_rate' => 'required_if:is_percentage,true|nullable|numeric|min:0|max:1',
            'applies_to_overtime' => 'boolean',
            'is_active' => 'boolean',
            'sort_order' => 'integer|min:0',
        ]);

        // Ensure weekly_amount is 0 for percentage-based oncosts
        if ($validated['is_percentage'] ?? false) {
            $validated['weekly_amount'] = 0;
        }

        $oncost->update($validated);

        return redirect()->back()->with('success', 'Oncost updated successfully.');
    }

    public function destroy(Oncost $oncost)
    {
        // Prevent deletion of core oncosts
        $coreOncosts = ['SUPER', 'BERT', 'BEWT', 'CIPQ', 'PAYROLL_TAX', 'WORKCOVER'];
        if (in_array($oncost->code, $coreOncosts)) {
            return redirect()->back()->with('error', 'Cannot delete core oncost types. You can deactivate them instead.');
        }

        $oncost->delete();

        return redirect()->back()->with('success', 'Oncost deleted successfully.');
    }
}
