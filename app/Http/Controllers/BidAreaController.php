<?php

namespace App\Http\Controllers;

use App\Models\BidArea;
use App\Models\Location;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BidAreaController extends Controller
{
    public function index(Location $location): JsonResponse
    {
        $bidAreas = BidArea::where('location_id', $location->id)
            ->whereNull('parent_id')
            ->with(['children'])
            ->withCount('measurements')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        // withCount on the top level only — recurse manually for children
        $loadCounts = function (BidArea $area) use (&$loadCounts) {
            $area->loadCount('measurements');
            if ($area->children) {
                foreach ($area->children as $child) {
                    $loadCounts($child);
                }
            }
        };
        foreach ($bidAreas as $area) {
            $loadCounts($area);
        }

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

    /**
     * Delete multiple bid areas at once (cascade removes any children via FK).
     */
    public function bulkDestroy(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:bid_areas,id',
        ]);

        $deleted = BidArea::where('location_id', $location->id)
            ->whereIn('id', $validated['ids'])
            ->delete();

        return response()->json(['success' => true, 'deleted_count' => $deleted]);
    }

    /**
     * Re-order siblings under a single parent. Accepts the ordered list of
     * area ids and assigns sort_order = index to each.
     */
    public function reorder(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'parent_id' => 'nullable|integer|exists:bid_areas,id',
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:bid_areas,id',
        ]);

        $parentId = $validated['parent_id'] ?? null;

        // Verify all ids belong to this location and are siblings under parent_id
        $count = BidArea::where('location_id', $location->id)
            ->where(function ($q) use ($parentId) {
                $parentId === null ? $q->whereNull('parent_id') : $q->where('parent_id', $parentId);
            })
            ->whereIn('id', $validated['ids'])
            ->count();

        if ($count !== count($validated['ids'])) {
            abort(422, 'One or more areas do not belong to this parent at this location.');
        }

        DB::transaction(function () use ($validated, $location, $parentId) {
            foreach ($validated['ids'] as $i => $id) {
                BidArea::where('id', $id)
                    ->where('location_id', $location->id)
                    ->update(['sort_order' => $i]);
            }
            unset($parentId); // not needed beyond validation
        });

        return response()->json(['success' => true]);
    }

    /**
     * Bulk-create a numbered sequence of bid areas (e.g. "Level 3" through "Level 42").
     */
    public function bulkStore(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'prefix' => 'required|string|max:200',
            'start' => 'required|integer|min:-999|max:999',
            'end' => 'required|integer|min:-999|max:999',
            'parent_id' => 'nullable|integer|exists:bid_areas,id',
            'pad_zeros' => 'nullable|boolean',
        ]);

        if ($validated['start'] > $validated['end']) {
            abort(422, 'Start must be less than or equal to end.');
        }

        $count = $validated['end'] - $validated['start'] + 1;
        if ($count > 200) {
            abort(422, 'Cannot create more than 200 areas at once.');
        }

        if ($validated['parent_id'] ?? null) {
            $parent = BidArea::find($validated['parent_id']);
            if (!$parent || $parent->location_id !== $location->id) {
                abort(422, 'Parent bid area does not belong to this project.');
            }
        }

        $prefix = trim($validated['prefix']);
        $padZeros = ($validated['pad_zeros'] ?? false) === true;
        $padWidth = $padZeros ? max(strlen((string) abs($validated['start'])), strlen((string) abs($validated['end']))) : 0;

        // Skip names that already exist under this parent at this location
        $existing = BidArea::where('location_id', $location->id)
            ->where('parent_id', $validated['parent_id'] ?? null)
            ->pluck('name')
            ->map(fn ($n) => mb_strtolower($n))
            ->all();
        $existingSet = array_flip($existing);

        $created = [];
        $skipped = [];

        DB::transaction(function () use ($validated, $location, $prefix, $padZeros, $padWidth, $existingSet, &$created, &$skipped) {
            for ($i = $validated['start']; $i <= $validated['end']; $i++) {
                $numStr = $padZeros
                    ? str_pad((string) abs($i), $padWidth, '0', STR_PAD_LEFT) . ($i < 0 ? '-' : '')
                    : (string) $i;
                if ($i < 0 && ! $padZeros) {
                    $numStr = (string) $i; // already has minus sign
                }
                $name = trim($prefix . ' ' . $numStr);

                if (isset($existingSet[mb_strtolower($name)])) {
                    $skipped[] = $name;
                    continue;
                }

                $created[] = BidArea::create([
                    'location_id' => $location->id,
                    'parent_id' => $validated['parent_id'] ?? null,
                    'name' => $name,
                    'sort_order' => $i,
                ]);
            }
        });

        return response()->json([
            'created_count' => count($created),
            'skipped_count' => count($skipped),
            'skipped' => $skipped,
        ], 201);
    }
}
