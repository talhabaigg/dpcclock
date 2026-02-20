<?php

namespace App\Http\Controllers;

use App\Jobs\LoadVariationsFromPremierJob;
use App\Models\CostCode;
use App\Models\Drawing;
use App\Models\Location;
use App\Models\TakeoffCondition;
use App\Models\Variation;
use App\Models\VariationPricingItem;
use App\Services\ChangeOrderGenerator;
use App\Services\GetCompanyCodeService;
use App\Services\PremierAuthenticationService;
use App\Services\VariationCostCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class VariationController extends Controller
{
    public function locationVariations(Request $request, Location $location)
    {
        return $this->index($request, $location);
    }

    public function loadVariationsFromPremier(Location $location)
    {
        LoadVariationsFromPremierJob::dispatch($location);

        return redirect()->back()->with('success', 'Variation sync job has been queued. Changes will appear shortly.');
    }

    public function index(Request $request, ?Location $location = null)
    {
        $user = auth()->user();

        $query = Variation::with('location')
            ->withSum('lineItems', 'total_cost')
            ->withSum('lineItems', 'revenue');

        // Location scope — when accessed via /locations/{location}/variations
        if ($location) {
            $query->where('location_id', $location->id);
        }

        // Permission-based filtering for managers
        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationIds = Location::whereIn('eh_location_id', $ehLocationIds)->pluck('id');
            $query->whereIn('location_id', $locationIds);
        }

        // Search filter
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('co_number', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('location', function ($lq) use ($search) {
                        $lq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        // Status filter
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Location filter (only when not scoped to a specific location)
        if (! $location && $request->filled('location')) {
            $query->whereHas('location', function ($q) use ($request) {
                $q->where('name', $request->input('location'));
            });
        }

        // Type filter
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        $variations = $query->orderByDesc('id')->paginate(50)->withQueryString();

        // Build filter options
        $filterOptionsQuery = Variation::query();
        if ($location) {
            $filterOptionsQuery->where('location_id', $location->id);
        }
        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationIds = Location::whereIn('eh_location_id', $ehLocationIds)->pluck('id');
            $filterOptionsQuery->whereIn('location_id', $locationIds);
        }

        $filterOptions = [
            'statuses' => $filterOptionsQuery->clone()->distinct()->pluck('status')->filter()->values(),
            'types' => $filterOptionsQuery->clone()->distinct()->pluck('type')->filter()->values(),
        ];

        if (! $location) {
            $filterOptions['locations'] = Location::whereIn('id', $filterOptionsQuery->clone()->distinct()->pluck('location_id'))
                ->pluck('name')->filter()->values();
        }

        $props = [
            'variations' => $variations,
            'filterOptions' => $filterOptions,
            'filters' => [
                'search' => $request->input('search', ''),
                'status' => $request->input('status', ''),
                'location' => $request->input('location', ''),
                'type' => $request->input('type', ''),
            ],
        ];

        // Location-specific extras
        if ($location) {
            $approvedRevenue = Variation::where('location_id', $location->id)
                ->where('type', 'APPROVED')
                ->withSum('lineItems', 'revenue')
                ->get()
                ->sum('line_items_sum_revenue');

            $pendingRevenue = Variation::where('location_id', $location->id)
                ->where('type', 'PENDING')
                ->withSum('lineItems', 'revenue')
                ->get()
                ->sum('line_items_sum_revenue');

            $props['location'] = ['id' => $location->id, 'name' => $location->name];
            $props['summaryCards'] = [
                'approvedRevenue' => $approvedRevenue,
                'pendingRevenue' => $pendingRevenue,
            ];
        }

        return Inertia::render('variation/index', $props);
    }

    public function create()
    {
        $user = auth()->user();
        $locationsQuery = Location::with([
            'costCodes.costType',
        ])->where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });

        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }

        $locations = $locationsQuery->get();
        // dd($locations);

        $costCodes = CostCode::with('costType')->orderBy('code')->get();

        // Get conditions for all locations (for the pricing tab condition picker)
        $locationIds = $locations->pluck('id');
        $conditions = TakeoffCondition::whereIn('location_id', $locationIds)
            ->with('conditionType')
            ->orderBy('name')
            ->get();

        $changeTypes = Variation::distinct()->whereNotNull('type')->pluck('type')->filter()->values()->toArray();

        return Inertia::render('variation/create', [
            'locations' => $locations,
            'costCodes' => $costCodes,
            'conditions' => $conditions,
            'selectedLocationId' => request()->query('location_id'),
            'changeTypes' => $changeTypes,
        ]);
    }

    public function edit($id)
    {
        $variation = Variation::with('lineItems', 'location', 'pricingItems.condition.conditionType')->findOrFail($id);
        $user = auth()->user();
        $locationsQuery = Location::with([
            'costCodes.costType',
        ])->where(function ($query) {
            $query->where('eh_parent_id', 1149031)
                ->orWhere('eh_parent_id', 1249093)
                ->orWhere('eh_parent_id', 1198645);
        });
        if ($user->hasRole('manager')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $locationsQuery->whereIn('eh_location_id', $ehLocationIds);
        }
        $locations = $locationsQuery->get();
        $costCodes = CostCode::with('costType')->orderBy('code')->get();

        $locationIds = $locations->pluck('id');
        $conditions = TakeoffCondition::whereIn('location_id', $locationIds)
            ->with('conditionType')
            ->orderBy('name')
            ->get();

        $changeTypes = Variation::distinct()->whereNotNull('type')->pluck('type')->filter()->values()->toArray();

        return Inertia::render('variation/create', [
            'locations' => $locations,
            'costCodes' => $costCodes,
            'variation' => $variation,
            'conditions' => $conditions,
            'changeTypes' => $changeTypes,
        ]);
    }

    public function show(Variation $variation)
    {
        $variation->load(['lineItems', 'location', 'pricingItems.condition.conditionType', 'drawing']);

        return Inertia::render('variation/show', [
            'variation' => $variation,
            'totals' => [
                'cost' => $variation->lineItems->sum('total_cost'),
                'revenue' => $variation->lineItems->sum('revenue'),
                'pricing_cost' => $variation->pricingItems->sum('total_cost'),
                'pricing_sell' => $variation->pricingItems->sum('sell_total'),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'type' => 'required|string',
            'co_number' => 'required|string',
            'description' => 'required|string',
            'client_notes' => 'nullable|string',

            'date' => 'required|date',
            'line_items' => 'required|array',
            'line_items.*.line_number' => 'required',
            'line_items.*.cost_item' => 'required|string',
            'line_items.*.cost_type' => 'required|string',
            'line_items.*.description' => 'required|string',
            'line_items.*.qty' => 'required|integer|min:1',
            'line_items.*.unit_cost' => 'required|numeric|min:0',
            'line_items.*.total_cost' => 'required|numeric|min:0',
            'line_items.*.revenue' => 'required|numeric|min:0',
        ]);

        $variation = Variation::create([
            'location_id' => $validated['location_id'],
            'type' => $validated['type'],
            'co_number' => $validated['co_number'],
            'description' => $validated['description'],
            'client_notes' => $validated['client_notes'] ?? null,
            'created_by' => auth()->user()->name ?? null,
            'co_date' => $validated['date'],
        ]);

        $lineItems = collect($validated['line_items'])->map(function ($item) {
            return [
                'line_number' => $item['line_number'],
                'cost_item' => $item['cost_item'],
                'cost_type' => $item['cost_type'],
                'description' => $item['description'],
                'qty' => 1,
                'unit_cost' => $item['total_cost'],
                'total_cost' => $item['total_cost'],
                'revenue' => $item['revenue'],
            ];
        })->toArray();

        $variation->lineItems()->createMany($lineItems);

        return redirect()->route('variations.index');
    }

    public function update(Request $request, Variation $variation)
    {
        $validated = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'type' => 'required|string',
            'co_number' => 'required|string',
            'description' => 'required|string',
            'client_notes' => 'nullable|string',

            'date' => 'required|date',
            'line_items' => 'required|array',
            'line_items.*.line_number' => 'required',
            'line_items.*.cost_item' => 'required|string',
            'line_items.*.cost_type' => 'required|string',
            'line_items.*.description' => 'required|string',
            'line_items.*.qty' => 'required',
            'line_items.*.unit_cost' => 'required|numeric|min:0',
            'line_items.*.total_cost' => 'required|numeric|min:0',
            'line_items.*.revenue' => 'required|numeric|min:0',
        ]);

        $variation->update([
            'location_id' => $validated['location_id'],
            'type' => $validated['type'],
            'co_number' => $validated['co_number'],
            'description' => $validated['description'],
            'client_notes' => $validated['client_notes'] ?? null,

            'co_date' => $validated['date'],
        ]);

        $variation->lineItems()->delete();

        $lineItems = collect($validated['line_items'])->map(function ($item) {
            return [
                'line_number' => $item['line_number'],
                'cost_item' => $item['cost_item'],
                'cost_type' => $item['cost_type'],
                'description' => $item['description'],
                'qty' => 1,
                'unit_cost' => $item['total_cost'],
                'total_cost' => $item['total_cost'],
                'revenue' => $item['revenue'],
            ];
        })->toArray();

        $variation->lineItems()->createMany($lineItems);

        return redirect()->route('variations.index');
    }

    public function destroy($id)
    {
        $variation = Variation::findOrFail($id);
        $variation->delete();

        return redirect()->route('variations.index')->with('success', 'Variation deleted successfully.');
    }

    public function download($id)
    {

        $variation = Variation::with('lineItems')->findOrFail($id);
        $companyService = new GetCompanyCodeService;
        $companyCode = $companyService->getCompanyCode($variation->location->eh_parent_id);

        // CSV Header
        $csvData = [];
        $csvData[] = [
            'Company Code',
            'Job Number',
            'CO Number',
            'Description',
            'CO Date',
            'Internal CO',
            'Extra Days',
            'Line',
            'Cost Item',
            'Cost Type',
            'Department',
            'Location',
            'Line Description',
            'UofM',
            'Qty',
            'Unit Cost',
            'Cost',
            'Revenue',
            'Vendor Name',
            'Subcontract',
            'PO',
            'Memo',
            'RFI',
        ];

        foreach ($variation->lineItems as $lineItem) {
            $csvData[] = [
                $companyCode,                           // Company Code (fill if needed)
                $variation->location->external_id ?? '', // Job Number
                $variation->co_number,        // CO Number
                $variation->description,      // Description
                $variation->co_date,          // CO Date
                '',                           // Internal CO
                '',                           // Extra Days
                $lineItem->line_number,       // Line
                '="'.$lineItem->cost_item.'"',         // Cost Item
                $lineItem->cost_type,
                '',                             // Department
                '',                           // Location
                $lineItem->description,       // Line Description
                '',                           // UofM
                $lineItem->qty,               // Qty
                $lineItem->unit_cost,         // Unit Cost
                $lineItem->total_cost,        // Cost
                $lineItem->revenue > 0 ? $lineItem->revenue : '',           // Revenue
                '',                           // Vendor Name
                '',                           // Subcontract
                '',                           // PO
                '',                           // Memo
                '',                            // RFI
            ];
        }

        $filename = "variation_{$variation->id}.csv";
        header('Content-Type: text/csv');
        header("Content-Disposition: attachment; filename={$filename}");

        $handle = fopen('php://output', 'w');

        foreach ($csvData as $row) {
            fputcsv($handle, $row);
        }

        fclose($handle);
        exit;
    }

    // public function LoadVariationsFromPremier()
    // {
    //     Log::info('LoadVariationsFromPremier called');
    //     $authService = new PremierAuthenticationService();
    //     $token = $authService->getAccessToken();
    //     $companyId = '3341c7c6-2abb-49e1-8a59-839d1bcff972';
    //     $base_url = env('PREMIER_SWAGGER_API_URL');

    //     $jobNumber = 'QTMP00';
    //     $queryParams = [
    //         'parameter.company' => $companyId,

    //         'parameter.pageSize' => 1000,
    //     ];
    //     $response = Http::withToken($token)
    //         ->acceptJson()
    //         ->get($base_url . '/api/ChangeOrder/GetChangeOrders', $queryParams);
    //     Log::info('response', $response->json());
    //     if ($response->successful()) {
    //         $data = $response->json('Data');
    //         Log::info('Premier Variations Data:', $data);
    //         dd($data);
    //     }
    //     return redirect()->back()->with('error', 'Failed to fetch variations from Premier');

    // }

    public function sendToPremier(Variation $variation)
    {
        $authService = new PremierAuthenticationService;
        $token = $authService->getAccessToken();
        $companyId = '3341c7c6-2abb-49e1-8a59-839d1bcff972';
        $base_url = config('premier.swagger_api.base_url');
        // dd($variation->co_date);
        $lineItems = $variation->lineItems->map(function ($item) {
            return [
                'LineNumber' => $item->line_number,
                'JobCostItem' => $item->cost_item,
                'JobCostType' => $item->cost_type,
                'LineDescription' => $item->description,
                'Quantity' => $item->qty,
                'UnitCost' => $item->unit_cost,
                'Amount' => $item->total_cost,
            ];
        })->toArray();

        $data = [
            // Construct the data payload as per Premier's API requirements
            'Company' => $companyId,
            'JobSubledger' => 'SWCJOB',
            'Job' => $variation->location->external_id,
            'ChangeOrderNumber' => $variation->co_number,
            'Description' => $variation->description,
            'ChangeOrderDate' => $variation->co_date,
            'ChangeOrderLines' => $lineItems,
        ];

        $response = Http::withToken($token)
            ->acceptJson()
            ->post($base_url.'/api/ChangeOrder/CreateChangeOrders', $data);
        if ($response->successful()) {
            $variation->status = 'sent';
            $variation->save();
            Log::info('Variation sent to Premier successfully.', $response->json());

            if (request()->wantsJson()) {
                return response()->json(['message' => 'Variation sent to Premier successfully.']);
            }

            return redirect()->back()->with('success', 'Variation sent to Premier successfully.');
        } else {
            Log::error('Failed to send variation to Premier.', [
                'response' => $response->json(),
            ]);

            if (request()->wantsJson()) {
                return response()->json(['error' => 'Failed to send variation to Premier.'], 500);
            }

            return redirect()->back()->with('error', 'Failed to send variation to Premier.');
        }
    }

    public function duplicate(Variation $variation)
    {
        $newVariation = $variation->replicate();
        $newVariation->co_number = $variation->co_number.'-COPY';
        $newVariation->status = 'pending';
        $newVariation->save();

        foreach ($variation->lineItems as $lineItem) {
            $newLineItem = $lineItem->replicate();
            $newLineItem->variation_id = $newVariation->id;
            $newLineItem->save();
        }

        return redirect()->route('variations.index')->with('success', 'Variation duplicated successfully.');
    }

    /**
     * Quick-create a variation from the drawing workspace (JSON API).
     */
    public function quickStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'drawing_id' => 'nullable|exists:drawings,id',
            'co_number' => 'required|string|max:50',
            'description' => 'required|string|max:255',
            'type' => 'nullable|string',
        ]);

        $variation = Variation::create([
            'location_id' => $validated['location_id'],
            'drawing_id' => $validated['drawing_id'] ?? null,
            'type' => $validated['type'] ?? 'extra',
            'co_number' => $validated['co_number'],
            'description' => $validated['description'],
            'created_by' => auth()->user()->name ?? null,
            'co_date' => now()->toDateString(),
            'status' => 'pending',
        ]);

        return response()->json(['variation' => $variation], 201);
    }

    // ---- Drawing Variation API endpoints ----

    /**
     * List variations for a drawing (used by the variations workspace page).
     */
    public function drawingVariations(Drawing $drawing): JsonResponse
    {
        $variations = Variation::where('location_id', $drawing->project_id)
            ->where(function ($q) use ($drawing) {
                $q->where('drawing_id', $drawing->id)
                    ->orWhereNull('drawing_id');
            })
            ->with('lineItems')
            ->orderBy('co_number')
            ->get()
            ->map(function ($v) {
                $v->total_cost = $v->lineItems->sum('total_cost');
                $v->total_revenue = $v->lineItems->sum('revenue');

                return $v;
            });

        return response()->json(['variations' => $variations]);
    }

    /**
     * Preview costs for a condition + qty without saving.
     */
    public function previewCosts(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'condition_id' => 'required|integer|exists:takeoff_conditions,id',
            'qty' => 'required|numeric|min:0.0001',
        ]);

        $condition = TakeoffCondition::findOrFail($validated['condition_id']);
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $generator = app(ChangeOrderGenerator::class);
        $preview = $generator->preview(
            $condition,
            (float) $validated['qty'],
            $location,
        );

        return response()->json(['preview' => $preview]);
    }

    /**
     * Generate CO line items from a condition + qty and add to a variation.
     */
    public function generateFromCondition(Request $request, Location $location): JsonResponse
    {
        $validated = $request->validate([
            'variation_id' => 'required|integer|exists:variations,id',
            'condition_id' => 'required|integer|exists:takeoff_conditions,id',
            'qty' => 'required|numeric|min:0.0001',
            'drawing_measurement_id' => 'nullable|integer|exists:drawing_measurements,id',
        ]);

        $variation = Variation::findOrFail($validated['variation_id']);
        if ($variation->location_id !== $location->id) {
            abort(404);
        }

        $condition = TakeoffCondition::findOrFail($validated['condition_id']);
        if ($condition->location_id !== $location->id) {
            abort(404);
        }

        $generator = app(ChangeOrderGenerator::class);
        $result = $generator->generateAndSave(
            $variation,
            $condition,
            (float) $validated['qty'],
            $location,
            $validated['drawing_measurement_id'] ?? null,
        );

        $variation->load('lineItems');

        return response()->json([
            'variation' => $variation,
            'summary' => $result['summary'],
        ]);
    }

    // ---- Pricing Item CRUD (JSON API) ----

    /**
     * List pricing items for a variation.
     */
    public function indexPricingItems(Variation $variation): JsonResponse
    {
        $items = $variation->pricingItems()
            ->with('condition.conditionType')
            ->orderBy('sort_order')
            ->get();

        return response()->json(['pricing_items' => $items]);
    }

    /**
     * Add a pricing item to a variation.
     * For condition items: computes costs via VariationCostCalculator.
     * For manual items: uses provided costs directly.
     */
    public function storePricingItem(Request $request, Variation $variation): JsonResponse
    {
        $validated = $request->validate([
            'takeoff_condition_id' => 'nullable|integer|exists:takeoff_conditions,id',
            'description' => 'required|string|max:255',
            'qty' => 'required|numeric|min:0.0001',
            'unit' => 'nullable|string|max:20',
            // Manual entry fields (used when no condition)
            'labour_cost' => 'nullable|numeric|min:0',
            'material_cost' => 'nullable|numeric|min:0',
            'sell_rate' => 'nullable|numeric|min:0',
        ]);

        $labourCost = 0;
        $materialCost = 0;
        $unit = $validated['unit'] ?? 'EA';

        $conditionId = $validated['takeoff_condition_id'] ?? null;

        if ($conditionId) {
            // Condition-driven: compute costs
            $condition = TakeoffCondition::with('conditionType')->findOrFail($conditionId);
            $calculator = app(VariationCostCalculator::class);
            $costs = $calculator->compute($condition, (float) $validated['qty']);
            $labourCost = $costs['labour_base'];
            $materialCost = $costs['material_base'];
            $unit = $condition->conditionType?->unit ?? $unit;
        } else {
            // Manual entry: use provided costs
            $labourCost = round((float) ($validated['labour_cost'] ?? 0), 2);
            $materialCost = round((float) ($validated['material_cost'] ?? 0), 2);
        }

        $totalCost = round($labourCost + $materialCost, 2);
        $maxSort = $variation->pricingItems()->max('sort_order') ?? 0;

        $sellRate = isset($validated['sell_rate']) ? round((float) $validated['sell_rate'], 2) : null;
        $sellTotal = $sellRate !== null ? round($validated['qty'] * $sellRate, 2) : null;

        $item = $variation->pricingItems()->create([
            'takeoff_condition_id' => $conditionId,
            'description' => $validated['description'],
            'qty' => $validated['qty'],
            'unit' => $unit,
            'labour_cost' => $labourCost,
            'material_cost' => $materialCost,
            'total_cost' => $totalCost,
            'sell_rate' => $sellRate,
            'sell_total' => $sellTotal,
            'sort_order' => $maxSort + 1,
        ]);

        $item->load('condition.conditionType');

        return response()->json(['pricing_item' => $item], 201);
    }

    /**
     * Update a pricing item (qty, sell_rate, or manual cost fields).
     */
    public function updatePricingItem(Request $request, Variation $variation, VariationPricingItem $item): JsonResponse
    {
        if ($item->variation_id !== $variation->id) {
            abort(404);
        }

        $validated = $request->validate([
            'qty' => 'nullable|numeric|min:0.0001',
            'sell_rate' => 'nullable|numeric|min:0',
            'labour_cost' => 'nullable|numeric|min:0',
            'material_cost' => 'nullable|numeric|min:0',
            'description' => 'nullable|string|max:255',
        ]);

        // If qty changed on a condition item, recompute costs
        if (isset($validated['qty']) && $item->takeoff_condition_id) {
            $condition = TakeoffCondition::findOrFail($item->takeoff_condition_id);
            $calculator = app(VariationCostCalculator::class);
            $costs = $calculator->compute($condition, (float) $validated['qty']);
            $item->qty = $validated['qty'];
            $item->labour_cost = $costs['labour_base'];
            $item->material_cost = $costs['material_base'];
            $item->total_cost = round($costs['labour_base'] + $costs['material_base'], 2);
        } elseif (isset($validated['qty'])) {
            // Manual item qty change
            $item->qty = $validated['qty'];
            // Recalculate total from existing per-unit costs if labour/material not also provided
            if (! isset($validated['labour_cost']) && ! isset($validated['material_cost'])) {
                $item->total_cost = round($item->labour_cost + $item->material_cost, 2);
            }
        }

        if (isset($validated['labour_cost']) && ! $item->takeoff_condition_id) {
            $item->labour_cost = round((float) $validated['labour_cost'], 2);
        }
        if (isset($validated['material_cost']) && ! $item->takeoff_condition_id) {
            $item->material_cost = round((float) $validated['material_cost'], 2);
        }
        if (isset($validated['labour_cost']) || isset($validated['material_cost'])) {
            $item->total_cost = round($item->labour_cost + $item->material_cost, 2);
        }

        if (isset($validated['sell_rate'])) {
            $item->sell_rate = round((float) $validated['sell_rate'], 2);
            $item->sell_total = round($item->qty * $item->sell_rate, 2);
        }

        if (isset($validated['description'])) {
            $item->description = $validated['description'];
        }

        $item->save();
        $item->load('condition.conditionType');

        return response()->json(['pricing_item' => $item]);
    }

    /**
     * Delete a pricing item.
     */
    public function destroyPricingItem(Variation $variation, VariationPricingItem $item): JsonResponse
    {
        if ($item->variation_id !== $variation->id) {
            abort(404);
        }

        $item->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Generate Premier line items from pricing items.
     * Wipes existing line_items and regenerates from pricing item totals.
     */
    public function generatePremier(Variation $variation): JsonResponse
    {
        $variation->loadMissing('location');
        $generator = app(ChangeOrderGenerator::class);
        $result = $generator->generateFromPricingItems($variation, $variation->location);

        $variation->load('lineItems');

        return response()->json([
            'variation' => $variation,
            'summary' => $result['summary'],
        ]);
    }

    /**
     * Batch-update sell rates on pricing items.
     */
    public function updateSellRates(Request $request, Variation $variation): JsonResponse
    {
        $validated = $request->validate([
            'rates' => 'required|array',
            'rates.*.id' => 'required|integer|exists:variation_pricing_items,id',
            'rates.*.sell_rate' => 'required|numeric|min:0',
        ]);

        foreach ($validated['rates'] as $rateData) {
            $item = VariationPricingItem::where('id', $rateData['id'])
                ->where('variation_id', $variation->id)
                ->first();

            if ($item) {
                $item->sell_rate = round((float) $rateData['sell_rate'], 2);
                $item->sell_total = round($item->qty * $item->sell_rate, 2);
                $item->save();
            }
        }

        $variation->load('pricingItems.condition.conditionType');

        return response()->json(['pricing_items' => $variation->pricingItems]);
    }

    /**
     * Render printable client quote.
     * Accepts optional ?uom_m2[]=id query params to display specific items in m2 instead of LM.
     */
    public function clientQuote(Request $request, Variation $variation)
    {
        $variation->load('pricingItems.condition.conditionType', 'location');

        // IDs of pricing items the user toggled to m2 display
        $uomM2Ids = collect($request->input('uom_m2', []))->map(fn ($v) => (int) $v)->all();

        return view('variations.client-quote', [
            'variation' => $variation,
            'uomM2Ids' => $uomM2Ids,
        ]);
    }
}
