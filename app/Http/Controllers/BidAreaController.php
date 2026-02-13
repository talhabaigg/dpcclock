<?php

namespace App\Http\Controllers;

use App\Models\BidArea;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BidAreaController extends Controller
{
    public function index(Location $location): JsonResponse
    {
        $bidAreas = BidArea::where('location_id', $location->id)
            ->whereNull('parent_id')
            ->with('children')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['bidAreas' => $bidAreas]);
    }

    public function store(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|integer|exists:bid_areas,id',
            'sort_order' => 'nullable|integer',
        ]);

        if ($validated['parent_id'] ?? null) {
            $parent = BidArea::find($validated['parent_id']);
            if (!$parent || $parent->location_id !== $location->id) {
                abort(422, 'Parent bid area does not belong to this project.');
            }
        }

        $bidArea = BidArea::create([
            'location_id' => $location->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'name' => $validated['name'],
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        $bidArea->load('children');

        return response()->json($bidArea, 201);
    }

    public function update(Request $request, Location $location, BidArea $bidArea): JsonResponse
    {
        if ($bidArea->location_id !== $location->id) {
            abort(404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|integer|exists:bid_areas,id',
            'sort_order' => 'nullable|integer',
        ]);

        if (($validated['parent_id'] ?? null) && $validated['parent_id'] == $bidArea->id) {
            abort(422, 'A bid area cannot be its own parent.');
        }

        if ($validated['parent_id'] ?? null) {
            $parent = BidArea::find($validated['parent_id']);
            if (!$parent || $parent->location_id !== $location->id) {
                abort(422, 'Parent bid area does not belong to this project.');
            }
        }

        $bidArea->update([
            'name' => $validated['name'],
            'parent_id' => $validated['parent_id'] ?? null,
            'sort_order' => $validated['sort_order'] ?? $bidArea->sort_order,
        ]);

        $bidArea->load('children');

        return response()->json($bidArea);
    }

    public function destroy(Location $location, BidArea $bidArea): JsonResponse
    {
        if ($bidArea->location_id !== $location->id) {
            abort(404);
        }

        $bidArea->delete();

        return response()->json(['success' => true]);
    }
}
