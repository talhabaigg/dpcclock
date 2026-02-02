<?php

namespace App\Http\Controllers;

use App\Models\ForecastProject;
use App\Models\ForecastProjectCostItem;
use App\Models\ForecastProjectRevenueItem;
use App\Models\JobForecastData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ForecastProjectController extends Controller
{
    /**
     * Display a listing of forecast projects
     */
    public function index()
    {
        $projects = ForecastProject::orderBy('created_at', 'desc')->get();

        return Inertia::render('forecast-projects/index', [
            'projects' => $projects,
        ]);
    }

    /**
     * Store a newly created forecast project
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'project_number' => 'required|string|max:255|unique:forecast_projects,project_number',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|in:potential,likely,confirmed,cancelled',
        ]);

        $project = ForecastProject::create($validated);

        return redirect()->back()->with('success', 'Forecast project created successfully');
    }

    /**
     * Display the forecast view for a specific project
     */
    public function show($id)
    {
        $project = ForecastProject::with(['costItems', 'revenueItems'])->findOrFail($id);

        // Get all unique months from forecast data
        $forecastData = JobForecastData::where('forecast_project_id', $id)->get();

        // Find the earliest month with existing forecast data
        $earliestForecastMonth = $forecastData->min('month');

        // Calculate forecast months
        // For forecast projects, use project start date if available, otherwise current month
        $defaultStartMonth = $project->start_date ? date('Y-m', strtotime($project->start_date->format('Y-m-d'))) : date('Y-m');

        // Use the earliest of: project start date, current month, or earliest forecast data month
        // This ensures users can always edit existing forecasts
        $startMonth = $defaultStartMonth;
        if ($earliestForecastMonth && $earliestForecastMonth < $startMonth) {
            $startMonth = $earliestForecastMonth;
        }

        // For end date, use project end date if available, otherwise default to 12 months from current month
        $endDate = $project->end_date ? $project->end_date->format('Y-m-d') : date('Y-m-d', strtotime(date('Y-m').'-01 +12 months'));
        $endMonth = date('Y-m', strtotime($endDate));

        $forecastMonths = [];
        $current = $startMonth;
        while ($current <= $endMonth) {
            $forecastMonths[] = $current;
            $current = date('Y-m', strtotime($current.' +1 month'));
        }

        // Load saved forecast data grouped by grid_type and cost_item
        $savedForecasts = $forecastData->groupBy(function ($item) {
            return $item->grid_type.'_'.$item->cost_item;
        });

        // Build cost rows (no actuals, just budget and forecast)
        $costRows = $project->costItems->map(function ($item) use ($forecastMonths, $savedForecasts) {
            $row = [
                'id' => $item->id,
                'cost_item' => $item->cost_item,
                'cost_item_description' => $item->cost_item_description,
                'budget' => (float) $item->budget,
                'type' => 'forecast',
            ];

            // Initialize all forecast months to null
            foreach ($forecastMonths as $month) {
                $row[$month] = null;
            }

            // Load forecast data from saved records
            $forecastKey = 'cost_'.$item->cost_item;
            if (isset($savedForecasts[$forecastKey])) {
                foreach ($savedForecasts[$forecastKey] as $forecast) {
                    if (in_array($forecast->month, $forecastMonths)) {
                        $row[$forecast->month] = (float) $forecast->forecast_amount;
                    }
                }
            }

            return $row;
        })->values()->all();

        // Build revenue rows
        $revenueRows = $project->revenueItems->map(function ($item) use ($forecastMonths, $savedForecasts) {
            $row = [
                'id' => $item->id,
                'cost_item' => $item->cost_item,
                'cost_item_description' => $item->cost_item_description,
                'contract_sum_to_date' => (float) $item->contract_sum_to_date,
                'type' => 'forecast',
            ];

            // Initialize all forecast months to null
            foreach ($forecastMonths as $month) {
                $row[$month] = null;
            }

            // Load forecast data from saved records
            $forecastKey = 'revenue_'.$item->cost_item;
            if (isset($savedForecasts[$forecastKey])) {
                foreach ($savedForecasts[$forecastKey] as $forecast) {
                    if (in_array($forecast->month, $forecastMonths)) {
                        $row[$forecast->month] = (float) $forecast->forecast_amount;
                    }
                }
            }

            return $row;
        })->values()->all();

        // Find orphaned revenue forecasts (forecasts that don't have a matching revenue item)
        // This ensures users can see and edit/delete forecast data even if the revenue item was deleted
        $existingRevenueCostItems = $project->revenueItems->pluck('cost_item')->toArray();
        $orphanedRevenueForecasts = $forecastData
            ->where('grid_type', 'revenue')
            ->whereNotIn('cost_item', $existingRevenueCostItems)
            ->groupBy('cost_item');

        foreach ($orphanedRevenueForecasts as $costItem => $forecasts) {
            $row = [
                'id' => -1 * (count($revenueRows) + 1), // Negative ID to indicate orphaned row
                'cost_item' => $costItem,
                'cost_item_description' => '(Orphaned forecast data)',
                'contract_sum_to_date' => 0,
                'type' => 'forecast',
                'is_orphaned' => true,
            ];

            // Initialize all forecast months to null
            foreach ($forecastMonths as $month) {
                $row[$month] = null;
            }

            // Load the orphaned forecast data
            foreach ($forecasts as $forecast) {
                if (in_array($forecast->month, $forecastMonths)) {
                    $row[$forecast->month] = (float) $forecast->forecast_amount;
                }
            }

            $revenueRows[] = $row;
        }

        // Find orphaned cost forecasts (forecasts that don't have a matching cost item)
        $existingCostItems = $project->costItems->pluck('cost_item')->toArray();
        $orphanedCostForecasts = $forecastData
            ->where('grid_type', 'cost')
            ->whereNotIn('cost_item', $existingCostItems)
            ->groupBy('cost_item');

        foreach ($orphanedCostForecasts as $costItem => $forecasts) {
            $row = [
                'id' => -1 * (count($costRows) + 1), // Negative ID to indicate orphaned row
                'cost_item' => $costItem,
                'cost_item_description' => '(Orphaned forecast data)',
                'budget' => 0,
                'type' => 'forecast',
                'is_orphaned' => true,
            ];

            // Initialize all forecast months to null
            foreach ($forecastMonths as $month) {
                $row[$month] = null;
            }

            // Load the orphaned forecast data
            foreach ($forecasts as $forecast) {
                if (in_array($forecast->month, $forecastMonths)) {
                    $row[$forecast->month] = (float) $forecast->forecast_amount;
                }
            }

            $costRows[] = $row;
        }

        return Inertia::render('job-forecast/show', [
            'costRowData' => $costRows,
            'revenueRowData' => $revenueRows,
            'monthsAll' => [], // No actuals for forecast projects
            'projectEndMonth' => $endMonth,
            'forecastMonths' => $forecastMonths,
            'forecastProjectId' => $id,
            'jobName' => $project->name,
            'jobNumber' => $project->project_number,
            'isForecastProject' => true,
            'lastUpdate' => $project->updated_at,
        ]);
    }

    /**
     * Update the specified forecast project
     */
    public function update(Request $request, $id)
    {
        $project = ForecastProject::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'project_number' => 'sometimes|required|string|max:255|unique:forecast_projects,project_number,'.$id,
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status' => 'nullable|in:potential,likely,confirmed,cancelled',
        ]);

        $project->update($validated);

        return redirect()->back()->with('success', 'Forecast project updated successfully');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $project = ForecastProject::findOrFail($id);
        $project->delete();

        return redirect()->back()->with('success', 'Forecast project deleted successfully');
    }

    /**
     * Add a cost item to a forecast project
     */
    public function addCostItem(Request $request, $id)
    {
        $validated = $request->validate([
            'cost_item' => 'required|string|max:255',
            'cost_item_description' => 'nullable|string',
            'budget' => 'required|numeric|min:0',
        ]);

        $project = ForecastProject::findOrFail($id);

        $maxOrder = $project->costItems()->max('display_order') ?? -1;

        $costItem = $project->costItems()->create([
            'cost_item' => $validated['cost_item'],
            'cost_item_description' => $validated['cost_item_description'] ?? '',
            'budget' => $validated['budget'],
            'display_order' => $maxOrder + 1,
        ]);

        return response()->json([
            'message' => 'Cost item added successfully',
            'cost_item' => $costItem,
        ]);
    }

    /**
     * Update a cost item
     */
    public function updateCostItem(Request $request, $projectId, $itemId)
    {
        $validated = $request->validate([
            'cost_item' => 'sometimes|required|string|max:255',
            'cost_item_description' => 'nullable|string',
            'budget' => 'sometimes|required|numeric|min:0',
        ]);

        $costItem = ForecastProjectCostItem::where('forecast_project_id', $projectId)
            ->where('id', $itemId)
            ->firstOrFail();

        $costItem->update($validated);

        return response()->json([
            'message' => 'Cost item updated successfully',
            'cost_item' => $costItem,
        ]);
    }

    /**
     * Delete a cost item
     */
    public function deleteCostItem($projectId, $itemId)
    {
        $costItem = ForecastProjectCostItem::where('forecast_project_id', $projectId)
            ->where('id', $itemId)
            ->firstOrFail();

        // Also delete associated forecast data
        JobForecastData::where('forecast_project_id', $projectId)
            ->where('grid_type', 'cost')
            ->where('cost_item', $costItem->cost_item)
            ->delete();

        $costItem->delete();

        return response()->json([
            'message' => 'Cost item deleted successfully',
        ]);
    }

    /**
     * Add a revenue item to a forecast project
     */
    public function addRevenueItem(Request $request, $id)
    {
        $validated = $request->validate([
            'cost_item' => 'required|string|max:255',
            'cost_item_description' => 'nullable|string',
            'contract_sum_to_date' => 'required|numeric|min:0',
        ]);

        $project = ForecastProject::findOrFail($id);

        $maxOrder = $project->revenueItems()->max('display_order') ?? -1;

        $revenueItem = $project->revenueItems()->create([
            'cost_item' => $validated['cost_item'],
            'cost_item_description' => $validated['cost_item_description'] ?? '',
            'contract_sum_to_date' => $validated['contract_sum_to_date'],
            'display_order' => $maxOrder + 1,
        ]);

        return response()->json([
            'message' => 'Revenue item added successfully',
            'revenue_item' => $revenueItem,
        ]);
    }

    /**
     * Update a revenue item
     */
    public function updateRevenueItem(Request $request, $projectId, $itemId)
    {
        $validated = $request->validate([
            'cost_item' => 'sometimes|required|string|max:255',
            'cost_item_description' => 'nullable|string',
            'contract_sum_to_date' => 'sometimes|required|numeric|min:0',
        ]);

        $revenueItem = ForecastProjectRevenueItem::where('forecast_project_id', $projectId)
            ->where('id', $itemId)
            ->firstOrFail();

        $revenueItem->update($validated);

        return response()->json([
            'message' => 'Revenue item updated successfully',
            'revenue_item' => $revenueItem,
        ]);
    }

    /**
     * Delete a revenue item
     */
    public function deleteRevenueItem($projectId, $itemId)
    {
        $revenueItem = ForecastProjectRevenueItem::where('forecast_project_id', $projectId)
            ->where('id', $itemId)
            ->firstOrFail();

        // Also delete associated forecast data
        JobForecastData::where('forecast_project_id', $projectId)
            ->where('grid_type', 'revenue')
            ->where('cost_item', $revenueItem->cost_item)
            ->delete();

        $revenueItem->delete();

        return response()->json([
            'message' => 'Revenue item deleted successfully',
        ]);
    }

    /**
     * Batch save/delete cost and revenue items
     */
    public function saveItems(Request $request, $id)
    {
        $validated = $request->validate([
            'deletedCostItems' => 'array',
            'deletedCostItems.*' => 'integer|exists:forecast_project_cost_items,id',
            'deletedRevenueItems' => 'array',
            'deletedRevenueItems.*' => 'integer|exists:forecast_project_revenue_items,id',
            'newCostItems' => 'array',
            'newCostItems.*.cost_item' => 'required|string|max:255',
            'newCostItems.*.cost_item_description' => 'nullable|string',
            'newCostItems.*.budget' => 'required|numeric|min:0',
            'newRevenueItems' => 'array',
            'newRevenueItems.*.cost_item' => 'required|string|max:255',
            'newRevenueItems.*.cost_item_description' => 'nullable|string',
            'newRevenueItems.*.contract_sum_to_date' => 'required|numeric|min:0',
        ]);

        $project = ForecastProject::findOrFail($id);

        DB::beginTransaction();
        try {
            // Delete items
            if (! empty($validated['deletedCostItems'])) {
                ForecastProjectCostItem::whereIn('id', $validated['deletedCostItems'])
                    ->where('forecast_project_id', $id)
                    ->delete();
            }

            if (! empty($validated['deletedRevenueItems'])) {
                ForecastProjectRevenueItem::whereIn('id', $validated['deletedRevenueItems'])
                    ->where('forecast_project_id', $id)
                    ->delete();
            }

            // Add new cost items
            if (! empty($validated['newCostItems'])) {
                $maxOrder = $project->costItems()->max('display_order') ?? -1;
                foreach ($validated['newCostItems'] as $item) {
                    $project->costItems()->create([
                        'cost_item' => $item['cost_item'],
                        'cost_item_description' => $item['cost_item_description'] ?? '',
                        'budget' => $item['budget'],
                        'display_order' => ++$maxOrder,
                    ]);
                }
            }

            // Add new revenue items
            if (! empty($validated['newRevenueItems'])) {
                $maxOrder = $project->revenueItems()->max('display_order') ?? -1;
                foreach ($validated['newRevenueItems'] as $item) {
                    $project->revenueItems()->create([
                        'cost_item' => $item['cost_item'],
                        'cost_item_description' => $item['cost_item_description'] ?? '',
                        'contract_sum_to_date' => $item['contract_sum_to_date'],
                        'display_order' => ++$maxOrder,
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'message' => 'Items saved successfully',
                'success' => true,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to save items: '.$e->getMessage(),
                'success' => false,
            ], 500);
        }
    }

    /**
     * Save forecast data and items for a forecast project (all in one request)
     */
    public function storeForecast(Request $request, $id)
    {
        \Log::info('=== FORECAST PROJECT SAVE DEBUG ===');
        \Log::info('Request Data:', $request->all());
        \Log::info('Project ID:', ['id' => $id]);

        $validated = $request->validate([
            // Items management (optional - only for new format)
            'deletedCostItems' => 'sometimes|array',
            'deletedCostItems.*' => 'integer',
            'deletedRevenueItems' => 'sometimes|array',
            'deletedRevenueItems.*' => 'integer',
            // Orphaned forecast data cleanup
            'orphanedCostItemsToDelete' => 'sometimes|array',
            'orphanedCostItemsToDelete.*' => 'string',
            'orphanedRevenueItemsToDelete' => 'sometimes|array',
            'orphanedRevenueItemsToDelete.*' => 'string',
            'newCostItems' => 'sometimes|array',
            'newCostItems.*.cost_item' => 'required|string|max:255',
            'newCostItems.*.cost_item_description' => 'nullable|string',
            'newCostItems.*.budget' => 'required|numeric|min:0',
            'newRevenueItems' => 'sometimes|array',
            'newRevenueItems.*.cost_item' => 'required|string|max:255',
            'newRevenueItems.*.cost_item_description' => 'nullable|string',
            'newRevenueItems.*.contract_sum_to_date' => 'required|numeric|min:0',
            // Forecast data (new format - optional)
            'costForecastData' => 'sometimes|array',
            'costForecastData.*.cost_item' => 'required|string',
            'costForecastData.*.months' => 'present|array',
            'costForecastData.*.months.*' => 'nullable|numeric',
            'revenueForecastData' => 'sometimes|array',
            'revenueForecastData.*.cost_item' => 'required|string',
            'revenueForecastData.*.months' => 'present|array',
            'revenueForecastData.*.months.*' => 'nullable|numeric',
            // Legacy format (optional)
            'grid_type' => 'sometimes|in:cost,revenue',
            'forecast_data' => 'sometimes|array',
            'forecast_data.*.cost_item' => 'required|string',
            'forecast_data.*.months' => 'present|array',
            'forecast_data.*.months.*' => 'nullable|numeric',
        ]);

        $project = ForecastProject::findOrFail($id);

        DB::beginTransaction();
        try {
            // Handle new format (all-in-one save)
            if (isset($validated['costForecastData']) && isset($validated['revenueForecastData'])) {
                // Delete items (only delete items that exist in DB - positive IDs)
                if (! empty($validated['deletedCostItems'])) {
                    $existingCostItemIds = array_filter($validated['deletedCostItems'], function ($id) {
                        return $id > 0;
                    });
                    if (! empty($existingCostItemIds)) {
                        // Get the cost_item values before deleting
                        $costItemsToDelete = ForecastProjectCostItem::whereIn('id', $existingCostItemIds)
                            ->where('forecast_project_id', $id)
                            ->pluck('cost_item')
                            ->toArray();

                        // Delete associated forecast data
                        if (! empty($costItemsToDelete)) {
                            JobForecastData::where('forecast_project_id', $id)
                                ->where('grid_type', 'cost')
                                ->whereIn('cost_item', $costItemsToDelete)
                                ->delete();
                        }

                        ForecastProjectCostItem::whereIn('id', $existingCostItemIds)
                            ->where('forecast_project_id', $id)
                            ->delete();
                    }
                }

                if (! empty($validated['deletedRevenueItems'])) {
                    $existingRevenueItemIds = array_filter($validated['deletedRevenueItems'], function ($id) {
                        return $id > 0;
                    });
                    if (! empty($existingRevenueItemIds)) {
                        // Get the cost_item values before deleting
                        $revenueItemsToDelete = ForecastProjectRevenueItem::whereIn('id', $existingRevenueItemIds)
                            ->where('forecast_project_id', $id)
                            ->pluck('cost_item')
                            ->toArray();

                        // Delete associated forecast data
                        if (! empty($revenueItemsToDelete)) {
                            JobForecastData::where('forecast_project_id', $id)
                                ->where('grid_type', 'revenue')
                                ->whereIn('cost_item', $revenueItemsToDelete)
                                ->delete();
                        }

                        ForecastProjectRevenueItem::whereIn('id', $existingRevenueItemIds)
                            ->where('forecast_project_id', $id)
                            ->delete();
                    }
                }

                // Delete orphaned cost forecast data (forecast data without matching cost items)
                if (! empty($validated['orphanedCostItemsToDelete'])) {
                    JobForecastData::where('forecast_project_id', $id)
                        ->where('grid_type', 'cost')
                        ->whereIn('cost_item', $validated['orphanedCostItemsToDelete'])
                        ->delete();
                }

                // Delete orphaned revenue forecast data (forecast data without matching revenue items)
                if (! empty($validated['orphanedRevenueItemsToDelete'])) {
                    JobForecastData::where('forecast_project_id', $id)
                        ->where('grid_type', 'revenue')
                        ->whereIn('cost_item', $validated['orphanedRevenueItemsToDelete'])
                        ->delete();
                }

                // Add new cost items
                if (! empty($validated['newCostItems'])) {
                    $maxOrder = $project->costItems()->max('display_order') ?? -1;
                    foreach ($validated['newCostItems'] as $item) {
                        $project->costItems()->create([
                            'cost_item' => $item['cost_item'],
                            'cost_item_description' => $item['cost_item_description'] ?? '',
                            'budget' => $item['budget'],
                            'display_order' => ++$maxOrder,
                        ]);
                    }
                }

                // Add new revenue items
                if (! empty($validated['newRevenueItems'])) {
                    $maxOrder = $project->revenueItems()->max('display_order') ?? -1;
                    foreach ($validated['newRevenueItems'] as $item) {
                        $project->revenueItems()->create([
                            'cost_item' => $item['cost_item'],
                            'cost_item_description' => $item['cost_item_description'] ?? '',
                            'contract_sum_to_date' => $item['contract_sum_to_date'],
                            'display_order' => ++$maxOrder,
                        ]);
                    }
                }

                // Save cost forecast data
                foreach ($validated['costForecastData'] as $row) {
                    $costItem = $row['cost_item'];
                    foreach ($row['months'] as $month => $amount) {
                        if ($amount !== null && $amount !== '') {
                            JobForecastData::updateOrCreate(
                                [
                                    'forecast_project_id' => $id,
                                    'grid_type' => 'cost',
                                    'cost_item' => $costItem,
                                    'month' => $month,
                                ],
                                [
                                    'forecast_amount' => $amount,
                                ]
                            );
                        } else {
                            // Delete the record if the value is null or empty
                            JobForecastData::where([
                                'forecast_project_id' => $id,
                                'grid_type' => 'cost',
                                'cost_item' => $costItem,
                                'month' => $month,
                            ])->delete();
                        }
                    }
                }

                // Save revenue forecast data
                foreach ($validated['revenueForecastData'] as $row) {
                    $costItem = $row['cost_item'];
                    foreach ($row['months'] as $month => $amount) {
                        if ($amount !== null && $amount !== '') {
                            JobForecastData::updateOrCreate(
                                [
                                    'forecast_project_id' => $id,
                                    'grid_type' => 'revenue',
                                    'cost_item' => $costItem,
                                    'month' => $month,
                                ],
                                [
                                    'forecast_amount' => $amount,
                                ]
                            );
                        } else {
                            // Delete the record if the value is null or empty
                            JobForecastData::where([
                                'forecast_project_id' => $id,
                                'grid_type' => 'revenue',
                                'cost_item' => $costItem,
                                'month' => $month,
                            ])->delete();
                        }
                    }
                }
            } else {
                // Handle legacy format (separate cost/revenue saves)
                $gridType = $validated['grid_type'];

                foreach ($validated['forecast_data'] as $row) {
                    $costItem = $row['cost_item'];

                    foreach ($row['months'] as $month => $amount) {
                        if ($amount !== null && $amount !== '') {
                            JobForecastData::updateOrCreate(
                                [
                                    'forecast_project_id' => $id,
                                    'grid_type' => $gridType,
                                    'cost_item' => $costItem,
                                    'month' => $month,
                                ],
                                [
                                    'forecast_amount' => $amount,
                                ]
                            );
                        } else {
                            // Delete the record if the value is null or empty
                            JobForecastData::where([
                                'forecast_project_id' => $id,
                                'grid_type' => $gridType,
                                'cost_item' => $costItem,
                                'month' => $month,
                            ])->delete();
                        }
                    }
                }
            }

            DB::commit();

            return redirect()->back()->with('success', 'Forecast saved successfully');
        } catch (\Exception $e) {
            DB::rollBack();

            \Log::error('Forecast save failed:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return redirect()->back()->withErrors(['error' => 'Failed to save forecast: '.$e->getMessage()]);
        }
    }
}
