<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Supplier;
use App\Models\Location;
use App\Models\Requisition;
use App\Models\RequisitionLineItem;

class PurchasingController extends Controller
{
    public function create()
    {
        $suppliers = Supplier::all();

        $locations = Location::where('eh_parent_id', 1149031)->get();
        return Inertia::render('purchasing/create', [
            'suppliers' => $suppliers,
            'locations' => $locations,
        ]);
    }

    public function store(Request $request)
{
    $validated = $request->validate([
        'project_id' => 'nullable|integer|exists:projects,id',
        'supplier_id' => 'required|integer|exists:suppliers,id',
        'date_required' => 'nullable|date',
        'delivery_contact' => 'nullable|string|max:255',
        'requested_by' => 'nullable|string|max:255',
        'deliver_to' => 'nullable|string|max:255',
        'items' => 'required|array|min:1',
        'items.*.itemcode' => 'nullable|string|max:255',
        'items.*.description' => 'nullable|string',
        'items.*.qty' => 'required|numeric|min:1',
        'items.*.unitcost' => 'required|numeric|min:0',
        'items.*.costcode' => 'nullable|string|max:255',
        'items.*.price_list' => 'nullable|string|max:255',
        'items.*.lineIndex' => 'nullable|integer',
        'items.*.total' => 'nullable|numeric|min:0',
    ]);
    // dd($validated);
    $requisition = Requisition::create([
        'project_number' => $validated['project_id']?? 1,
        'supplier_number' => $validated['supplier_id'],
        'date_required' => $validated['date_required'] ?? now(),
        'delivery_contact' => $validated['delivery_contact'] ?? null,
        'requested_by' => $validated['requested_by'] ?? null,
        'deliver_to' => $validated['deliver_to'] ?? null,
    ]);

    foreach ($validated['items'] as $item) {
        RequisitionLineItem::create([
            'serial_number' => $item['lineIndex'] ?? null,
            'requisition_id' => $requisition->id,
            'code' => $item['itemcode'],
            'description' => $item['description'],
            'qty' => $item['qty'],
            'unit_cost' => $item['unitcost'],
            'cost_code' => $item['costcode'] ?? null,
            'price_list' => $item['price_list'] ?? null,
            'total_cost' => $item['total'] ?? null,
        ]);
    }

    return redirect()->route('kiosks.index')->with('success', 'Requisition created successfully.');
}
}
