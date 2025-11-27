<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\RequisitionHeaderTemplate;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RequisitionHeaderTemplateController extends Controller
{
    public function edit($locationId)
    {
        $location = Location::with('header')->findorfail($locationId);

        return Inertia::render('location-requisition-header/edit', [
            'location' => $location,
        ]);
    }

    public function update(Request $request, $locationId)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'delivery_contact' => 'nullable|string|max:255',
            'requested_by' => 'nullable|string|max:255',
            'deliver_to' => 'nullable|string|max:255',
            'order_reference' => 'nullable|string|max:255',
        ]);

        RequisitionHeaderTemplate::updateOrCreate(
            ['location_id' => $locationId],
            [
                'name' => $request->input('name'),
                'delivery_contact' => $request->input('delivery_contact'),
                'requested_by' => $request->input('requested_by'),
                'deliver_to' => $request->input('deliver_to'),
                'order_reference' => $request->input('order_reference'),
            ]
        );

        return redirect()->route('locations.show', $locationId)
            ->with('success', 'Requisition Header Template updated successfully.');
    }
}
