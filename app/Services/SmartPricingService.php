<?php

namespace App\Services;

use App\Models\MaterialItem;
use App\Models\Requisition;
use App\Models\RequisitionLineItem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmartPricingService
{
    private string $apiKey;

    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.openai.api_key') ?: env('OPENAI_API_KEY') ?: '';
        $this->model = env('OPENAI_CHAT_MODEL', 'gpt-4o');
    }

    /**
     * Fast check for line items that need attention (no AI).
     * Categorizes: no_code, unmatched_code, not_in_price_list, no_price.
     */
    public function checkForProblems(Requisition $requisition): array
    {
        $requisition->loadMissing('lineItems');

        $supplierId = $requisition->supplier_number;
        $locationId = $requisition->project_number;

        // Load ALL supplier item codes (existence check)
        $supplierItemCodes = MaterialItem::where('supplier_id', $supplierId)
            ->pluck('code')
            ->toArray();

        // Load codes that HAVE location pricing for this project
        $locationPricedCodes = [];
        if ($locationId) {
            $locationPricedCodes = MaterialItem::where('supplier_id', $supplierId)
                ->whereIn('id', function ($q) use ($locationId) {
                    $q->select('material_item_id')
                        ->from('location_item_pricing')
                        ->where('location_id', $locationId)
                        ->where('unit_cost_override', '>', 0);
                })
                ->pluck('code')
                ->toArray();
        }

        $problems = [];

        foreach ($requisition->lineItems as $item) {
            if ($item->is_locked) {
                continue;
            }

            $ctx = $item->resolution_context;
            if (is_array($ctx) && in_array($ctx['status'] ?? null, ['resolved', 'removed'])) {
                continue;
            }

            $reasons = [];

            if (empty($item->code)) {
                $reasons[] = 'no_code';
            } elseif (! in_array($item->code, $supplierItemCodes)) {
                $reasons[] = 'unmatched_code';
            } elseif (! in_array($item->code, $locationPricedCodes)) {
                $reasons[] = 'not_in_price_list';
            }

            if (! $item->unit_cost || (float) $item->unit_cost <= 0) {
                $reasons[] = 'no_price';
            }

            if (! empty($reasons)) {
                $problems[] = [
                    'line_item_id' => $item->id,
                    'serial_number' => $item->serial_number,
                    'code' => $item->code,
                    'description' => $item->description,
                    'qty' => $item->qty,
                    'unit_cost' => $item->unit_cost,
                    'total_cost' => $item->total_cost,
                    'reasons' => $reasons,
                    'item_exists_in_db' => ! empty($item->code) && in_array($item->code, $supplierItemCodes),
                ];
            }
        }

        return [
            'problems' => $problems,
            'count' => count($problems),
        ];
    }

    /**
     * AI assessment for a single line item.
     * Returns assessment text, path routing, matches, and parsed length.
     */
    public function getAIAssessment(array $itemContext, int $supplierId, ?int $locationId = null): array
    {
        if (! $this->apiKey) {
            return [
                'success' => false,
                'error' => 'OpenAI API key not configured',
            ];
        }

        $catalog = $this->buildCatalogContext($supplierId, $locationId);
        $reasons = $itemContext['reasons'] ?? [];

        // If item is explicitly not_in_price_list (code exists but no location pricing),
        // we still send catalog for AI to confirm and provide assessment
        try {
            $messages = [
                ['role' => 'system', 'content' => $this->getAssessmentSystemPrompt()],
                ['role' => 'user', 'content' => $this->buildAssessmentPrompt($itemContext, $catalog, $reasons)],
            ];

            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(60)->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => $messages,
                'temperature' => 0.2,
                'max_tokens' => 2000,
                'response_format' => ['type' => 'json_object'],
            ]);

            if ($response->failed()) {
                Log::error('SmartPricing AI assessment failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return $this->fallbackAssessment($reasons, $catalog, $itemContext);
            }

            $content = $response->json('choices.0.message.content');
            $parsed = json_decode($content, true);

            if (! is_array($parsed)) {
                return $this->fallbackAssessment($reasons, $catalog, $itemContext);
            }

            // Validate matches against real DB
            $matches = $this->validateMatches($parsed['matches'] ?? [], $supplierId, $locationId);

            // AI determines the path, but we can override based on match results
            $aiPath = $parsed['path'] ?? 'not_in_price_list';
            $path = (count($matches) > 0) ? 'custom_length' : $aiPath;

            // For items that were flagged as not_in_price_list by code check,
            // only override to custom_length if AI found real matches
            if (in_array('not_in_price_list', $reasons) && count($matches) === 0) {
                $path = 'not_in_price_list';
            }

            return [
                'success' => true,
                'assessment' => $parsed['assessment'] ?? '',
                'path' => $path,
                'recommended_action' => $parsed['recommended_action'] ?? null,
                'parsed_length' => $parsed['parsed_length'] ?? null,
                'is_meterage' => $parsed['is_meterage'] ?? false,
                'matches' => $matches,
            ];

        } catch (\Exception $e) {
            Log::error('SmartPricing AI assessment exception', ['error' => $e->getMessage()]);

            return $this->fallbackAssessment($reasons, $catalog, $itemContext);
        }
    }

    /**
     * Save the field worker's context on a line item. Supports both paths.
     */
    public function saveFieldWorkerContext(int $lineItemId, array $context): void
    {
        $lineItem = RequisitionLineItem::findOrFail($lineItemId);

        $path = $context['path'] ?? 'custom_length';

        $itemExistsInDb = (bool) ($context['item_exists_in_db'] ?? false);

        if ($path === 'not_in_price_list') {
            $resolutionContext = [
                'path' => 'not_in_price_list',
                'field_worker_choice' => $context['field_worker_choice'] ?? null,
                'field_worker_notes' => $context['field_worker_notes'] ?? null,
                'ai_assessment' => $context['ai_assessment'] ?? null,
                'item_exists_in_db' => $itemExistsInDb,
                'status' => 'pending_review',
                'created_at' => now()->toIso8601String(),
                'resolved_at' => null,
                'resolved_by' => null,
            ];
        } else {
            $resolutionContext = [
                'path' => 'custom_length',
                'is_custom_length' => $context['is_custom_length'] ?? null,
                'matched_catalog_code' => $context['matched_catalog_code'] ?? null,
                'matched_catalog_item_id' => $context['matched_catalog_item_id'] ?? null,
                'matched_catalog_description' => $context['matched_catalog_description'] ?? null,
                'matched_catalog_unit_cost' => $context['matched_catalog_unit_cost'] ?? null,
                'requested_length_meters' => $context['requested_length_meters'] ?? null,
                'field_worker_notes' => $context['field_worker_notes'] ?? null,
                'ai_assessment' => $context['ai_assessment'] ?? null,
                'ai_matches' => $context['ai_matches'] ?? [],
                'item_exists_in_db' => $itemExistsInDb,
                'status' => 'pending_review',
                'created_at' => now()->toIso8601String(),
                'resolved_at' => null,
                'resolved_by' => null,
            ];
        }

        $lineItem->update(['resolution_context' => $resolutionContext]);
    }

    /**
     * Remove a line item from the requisition (field worker chose "remove from order").
     */
    public function removeLineItem(Requisition $requisition, int $lineItemId): array
    {
        $lineItem = RequisitionLineItem::where('id', $lineItemId)
            ->where('requisition_id', $requisition->id)
            ->firstOrFail();

        $description = $lineItem->description;
        $serialNumber = $lineItem->serial_number;
        $code = $lineItem->code;

        $lineItem->delete();

        activity()
            ->performedOn($requisition)
            ->causedBy(auth()->user())
            ->event('line_item_removed')
            ->withProperties([
                'line_item_id' => $lineItemId,
                'code' => $code,
                'description' => $description,
            ])
            ->log("Line item #{$serialNumber} removed by field worker (not in price list)");

        return ['success' => true, 'message' => 'Item removed from requisition'];
    }

    /**
     * Apply a resolution from the office side.
     * Supports custom_length, direct_price, and path_a_price resolution types.
     */
    public function applyResolution(Requisition $requisition, int $lineItemId, array $data): array
    {
        return DB::transaction(function () use ($requisition, $lineItemId, $data) {
            $lineItem = RequisitionLineItem::where('id', $lineItemId)
                ->where('requisition_id', $requisition->id)
                ->firstOrFail();

            $originalValues = $lineItem->only(['code', 'description', 'qty', 'unit_cost', 'total_cost', 'cost_code']);

            $qty = (float) $data['qty'];
            $unitCost = (float) $data['unit_cost'];
            $totalCost = round($qty * $unitCost, 2);

            // Determine price_list label: use location name when adding to project price list
            $priceList = 'smart_pricing';
            if (! empty($data['save_as_new_item'])) {
                $locationName = DB::table('locations')
                    ->where('id', $requisition->project_number)
                    ->value('name');
                $priceList = $locationName ?: 'smart_pricing';
            }

            // 1. Update the line item
            $lineItem->update([
                'code' => $data['new_code'] ?? $lineItem->code,
                'description' => $data['description'] ?? $lineItem->description,
                'qty' => $qty,
                'unit_cost' => $unitCost,
                'total_cost' => $totalCost,
                'cost_code' => $data['cost_code'] ?? $lineItem->cost_code,
                'price_list' => $priceList,
                'resolution_context' => array_merge(
                    $lineItem->resolution_context ?? [],
                    [
                        'status' => 'resolved',
                        'resolution_type' => $data['resolution_type'] ?? 'custom_length',
                        'resolved_at' => now()->toIso8601String(),
                        'resolved_by' => auth()->id(),
                    ]
                ),
            ]);

            // 2. Optionally create MaterialItem + location pricing
            if (! empty($data['save_as_new_item'])) {
                $this->createMaterialItemWithLocationPricing(
                    $requisition,
                    $data['new_item_code'] ?? $data['new_code'] ?? $lineItem->code,
                    $data['new_item_description'] ?? $data['description'] ?? $lineItem->description,
                    (float) ($data['new_item_price'] ?? $unitCost),
                    (bool) ($data['new_item_is_locked'] ?? false),
                    $data['cost_code_id'] ?? null,
                    isset($data['new_item_supplier_category_id']) ? (int) $data['new_item_supplier_category_id'] : null,
                );
            }

            // 3. Activity log
            activity()
                ->performedOn($requisition)
                ->causedBy(auth()->user())
                ->event('smart_pricing_applied')
                ->withProperties([
                    'line_item_id' => $lineItemId,
                    'resolution_type' => $data['resolution_type'] ?? 'custom_length',
                    'original' => $originalValues,
                    'resolved' => [
                        'code' => $data['new_code'] ?? $lineItem->code,
                        'qty' => $qty,
                        'unit_cost' => $unitCost,
                        'total_cost' => $totalCost,
                    ],
                    'saved_as_new_item' => ! empty($data['save_as_new_item']),
                ])
                ->log("Smart pricing applied to line item #{$lineItem->serial_number}");

            return [
                'success' => true,
                'message' => 'Resolution applied',
                'line_item' => $lineItem->fresh(),
            ];
        });
    }

    /**
     * Create or update MaterialItem and set location pricing.
     */
    private function createMaterialItemWithLocationPricing(
        Requisition $requisition,
        string $code,
        string $description,
        float $price,
        bool $isLocked,
        ?int $costCodeId,
        ?int $supplierCategoryId = null,
    ): void {
        $existingItem = MaterialItem::firstOrCreate(
            [
                'code' => $code,
                'supplier_id' => $requisition->supplier_number,
            ],
            array_filter([
                'description' => $description,
                'unit_cost' => $price,
                'created_by' => auth()->id(),
                'cost_code_id' => $costCodeId,
                'supplier_category_id' => $supplierCategoryId,
            ], fn ($v) => $v !== null)
        );

        $locationId = $requisition->project_number;

        DB::table('location_item_pricing')->updateOrInsert(
            ['material_item_id' => $existingItem->id, 'location_id' => $locationId],
            [
                'unit_cost_override' => $price,
                'is_locked' => $isLocked,
                'updated_by' => auth()->id(),
                'updated_at' => now(),
            ]
        );
    }

    /**
     * Build catalog context for AI matching.
     * Only includes items with location pricing for this project.
     */
    private function buildCatalogContext(int $supplierId, ?int $locationId = null): array
    {
        if (! $locationId) {
            return [];
        }

        $locationPricing = DB::table('location_item_pricing')
            ->where('location_id', $locationId)
            ->where('unit_cost_override', '>', 0)
            ->pluck('unit_cost_override', 'material_item_id')
            ->mapWithKeys(fn ($cost, $id) => [(int) $id => (float) $cost])
            ->toArray();

        if (empty($locationPricing)) {
            return [];
        }

        $items = MaterialItem::where('supplier_id', $supplierId)
            ->whereIn('id', array_keys($locationPricing))
            ->select('id', 'code', 'description', 'unit_cost', 'cost_code_id')
            ->with('costCode:id,code')
            ->limit(200)
            ->get();

        return $items->map(function ($item) use ($locationPricing) {
            return [
                'id' => $item->id,
                'code' => $item->code,
                'description' => $item->description,
                'unit_cost' => $locationPricing[$item->id],
                'price_source' => 'location_price',
                'cost_code' => $item->costCode?->code,
            ];
        })->toArray();
    }

    private function getAssessmentSystemPrompt(): string
    {
        return <<<'PROMPT'
You are a construction materials pricing specialist for an Australian construction company.

A field worker has created a requisition line item that has a problem. You need to:

1. ASSESS: Write a brief, clear explanation of what the item appears to be and what the issue is. Address the field worker directly in simple language (e.g., "This looks like a 3m length of 76mm Flexible Track..."). Keep it under 2 sentences.

2. ROUTE: Determine the path:
   - "custom_length" — if the item matches something in the project price list catalog (even partially). This includes items that are custom lengths, cut-to-size, or variations of catalog items.
   - "not_in_price_list" — if the item does NOT match anything in the catalog at all.

3. RECOMMEND: Suggest an action:
   - "custom_length" — if it's a custom length of a catalog item
   - "keep_for_office" — if you're unsure and the office should handle it
   - "remove_item" — if it clearly doesn't belong on this order

4. MATCH: If path is "custom_length", find the best catalog matches:
   - Same material type, size, gauge, specifications
   - A per-meter or per-unit version of what they described
   - Rank up to 3 matches by confidence: "high", "medium", "low"
   - Do NOT match to the same code as the item

5. PARSE: Extract length/meterage from the description if present:
   - "15m" = 15.0 meters
   - "3000mm" = 3.0 meters
   - "3000" in a product name could mean 3000mm = 3.0m

Respond ONLY with valid JSON:
{
  "assessment": "This looks like a 3m length of 76mm Flexible Track. The base item is on your project price list at $2.50/m.",
  "path": "custom_length",
  "recommended_action": "custom_length",
  "parsed_length": 3.0,
  "is_meterage": true,
  "matches": [
    {
      "catalog_item_id": 456,
      "code": "FT-76MM",
      "description": "76mm Flexible Track",
      "unit_cost": 2.50,
      "cost_code": "32-01",
      "confidence": "high",
      "reasoning": "Same material (76mm flex track), per-meter catalog item"
    }
  ]
}

If the item doesn't match any catalog item, return path "not_in_price_list" with empty matches.
If no length is detected, set parsed_length to null and is_meterage to false.
PROMPT;
    }

    private function buildAssessmentPrompt(array $itemContext, array $catalog, array $reasons): string
    {
        $catalogJson = ! empty($catalog) ? json_encode($catalog, JSON_PRETTY_PRINT) : '[]';
        $reasonsStr = implode(', ', $reasons);

        $code = $itemContext['code'] ?? 'none';
        $description = $itemContext['description'] ?? 'no description';
        $qty = $itemContext['qty'] ?? 0;
        $unitCost = $itemContext['unit_cost'] ?? 0;

        return <<<PROMPT
LINE ITEM:
- Code: {$code}
- Description: "{$description}"
- Qty: {$qty}
- Unit Cost: \${$unitCost}
- Problems detected: {$reasonsStr}

PROJECT PRICE LIST CATALOG (items with location-specific pricing):
{$catalogJson}

Analyze this item, assess the situation, determine the path, and find matching catalog items if applicable.
PROMPT;
    }

    /**
     * Fallback when AI fails — use code-based routing with description analysis.
     */
    private function fallbackAssessment(array $reasons, array $catalog, ?array $itemContext = null): array
    {
        $hasLocationMatches = ! empty($catalog);
        $path = in_array('not_in_price_list', $reasons) || ! $hasLocationMatches
            ? 'not_in_price_list'
            : 'custom_length';

        // Try to extract length from description for a more useful fallback
        $parsedLength = null;
        $isMeterage = false;
        $description = $itemContext['description'] ?? '';

        if ($description && preg_match('/(\d+(?:\.\d+)?)\s*(?:m(?:eter|etre)?s?\b|mtr)/i', $description, $m)) {
            $parsedLength = (float) $m[1];
            $isMeterage = true;
        } elseif ($description && preg_match('/(\d{3,5})\s*mm\b/i', $description, $m)) {
            $parsedLength = round((float) $m[1] / 1000, 2);
            $isMeterage = true;
        }

        if ($path === 'not_in_price_list') {
            $assessment = $description
                ? "This item (\"{$description}\") is not part of the project price list. The office will need to handle pricing. (AI assessment was unavailable.)"
                : 'This item is not part of the price list set at project level. AI assessment was unavailable.';
        } else {
            $lengthNote = $parsedLength ? " A length of {$parsedLength}m was detected in the description." : '';
            $assessment = $description
                ? "This item (\"{$description}\") may be a variation of an existing catalog item.{$lengthNote} (AI assessment was unavailable.)"
                : 'This item may be a custom length of an existing catalog item. AI assessment was unavailable.';
        }

        return [
            'success' => true,
            'assessment' => $assessment,
            'path' => $path,
            'recommended_action' => $path === 'not_in_price_list' ? 'keep_for_office' : 'custom_length',
            'parsed_length' => $parsedLength,
            'is_meterage' => $isMeterage,
            'matches' => [],
        ];
    }

    /**
     * Validate AI matches against real DB data (location pricing only).
     */
    private function validateMatches(array $matches, int $supplierId, ?int $locationId): array
    {
        $validated = [];

        foreach ($matches as $match) {
            $catalogItemId = $match['catalog_item_id'] ?? null;

            if (! $catalogItemId) {
                continue;
            }

            $item = MaterialItem::where('id', $catalogItemId)
                ->where('supplier_id', $supplierId)
                ->first();

            if (! $item) {
                continue;
            }

            if (! $locationId) {
                continue;
            }

            $locationPricing = DB::table('location_item_pricing')
                ->where('material_item_id', $item->id)
                ->where('location_id', $locationId)
                ->where('unit_cost_override', '>', 0)
                ->first();

            if (! $locationPricing) {
                continue;
            }

            $validated[] = [
                'catalog_item_id' => $item->id,
                'code' => $item->code,
                'description' => $item->description,
                'unit_cost' => (float) $locationPricing->unit_cost_override,
                'price_source' => 'location_price',
                'cost_code' => $item->costCode?->code,
                'cost_code_id' => $item->cost_code_id,
                'confidence' => $match['confidence'] ?? 'low',
                'reasoning' => $match['reasoning'] ?? '',
            ];
        }

        return $validated;
    }
}
