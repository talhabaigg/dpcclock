<?php

namespace App\Http\Controllers;

use App\Models\Requisition;
use App\Models\RequisitionLineItem;
use App\Services\SmartPricingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SmartPricingController extends Controller
{
    /**
     * GET /requisition/{id}/smart-pricing-check
     * Fast check for problem items (no AI). Called when field worker clicks "Send to Office".
     */
    public function check($id)
    {
        $requisition = Requisition::with('lineItems')->findOrFail($id);

        $service = new SmartPricingService;
        $result = $service->checkForProblems($requisition);

        return response()->json($result);
    }

    /**
     * POST /requisition/{id}/smart-pricing-assess
     * AI assessment for a single line item. Returns assessment, path, matches.
     */
    public function assess(Request $request, $id)
    {
        $requisition = Requisition::findOrFail($id);

        $validated = $request->validate([
            'line_item_id' => 'required|integer',
            'reasons' => 'required|array',
        ]);

        $lineItem = RequisitionLineItem::where('id', $validated['line_item_id'])
            ->where('requisition_id', $requisition->id)
            ->firstOrFail();

        try {
            $service = new SmartPricingService;
            $result = $service->getAIAssessment(
                [
                    'code' => $lineItem->code,
                    'description' => $lineItem->description ?? '',
                    'qty' => $lineItem->qty,
                    'unit_cost' => $lineItem->unit_cost,
                    'reasons' => $validated['reasons'],
                ],
                $requisition->supplier_number,
                $requisition->project_number
            );

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('SmartPricing assess error', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Failed to assess item pricing'], 500);
        }
    }

    /**
     * POST /requisition/{id}/smart-pricing-context
     * Save field worker's answers for a line item (both paths).
     */
    public function saveContext(Request $request, $id)
    {
        $requisition = Requisition::findOrFail($id);

        $validated = $request->validate([
            'line_item_id' => 'required|integer',
            'path' => 'required|in:not_in_price_list,custom_length',
            // Path A fields
            'field_worker_choice' => 'nullable|in:remove_item,keep_for_office,other',
            // Path B fields
            'is_custom_length' => 'nullable|boolean',
            'matched_catalog_code' => 'nullable|string|max:255',
            'matched_catalog_item_id' => 'nullable|integer',
            'matched_catalog_description' => 'nullable|string|max:255',
            'matched_catalog_unit_cost' => 'nullable|numeric|min:0',
            'requested_length_meters' => 'nullable|numeric|min:0',
            // Common fields
            'field_worker_notes' => 'nullable|string|max:1000',
            'ai_assessment' => 'nullable|string|max:2000',
            'ai_matches' => 'nullable|array',
            'item_exists_in_db' => 'nullable|boolean',
        ]);

        RequisitionLineItem::where('id', $validated['line_item_id'])
            ->where('requisition_id', $requisition->id)
            ->firstOrFail();

        $service = new SmartPricingService;
        $service->saveFieldWorkerContext($validated['line_item_id'], $validated);

        return response()->json(['success' => true]);
    }

    /**
     * POST /requisition/{id}/smart-pricing-remove-item
     * Remove a line item from the requisition (field worker chose to send quote separately).
     */
    public function removeItem(Request $request, $id)
    {
        $requisition = Requisition::with('lineItems')->findOrFail($id);

        $validated = $request->validate([
            'line_item_id' => 'required|integer',
        ]);

        try {
            $service = new SmartPricingService;
            $result = $service->removeLineItem($requisition, $validated['line_item_id']);

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('SmartPricing remove item error', ['error' => $e->getMessage()]);

            return response()->json(['error' => 'Failed to remove line item'], 500);
        }
    }

    /**
     * POST /requisition/{id}/smart-pricing-apply
     * Apply resolution from office side. Supports one-off and save-as-new-item.
     */
    public function apply(Request $request, $id)
    {
        $requisition = Requisition::with('lineItems')->findOrFail($id);

        if ($requisition->status !== 'office_review') {
            return response()->json(['error' => 'Requisition must be in office_review status'], 422);
        }

        $validated = $request->validate([
            'line_item_id' => 'required|integer',
            'resolution_type' => 'required|in:custom_length,direct_price,path_a_price',
            'new_code' => 'nullable|string|max:255',
            'description' => 'nullable|string|max:500',
            'qty' => 'required|numeric|min:0.01',
            'unit_cost' => 'required|numeric|min:0',
            'cost_code' => 'nullable|string|max:255',
            'cost_code_id' => 'nullable|integer',
            // Save as new item / add to price list sub-fields
            'save_as_new_item' => 'nullable|boolean',
            'new_item_code' => 'nullable|required_if:save_as_new_item,true|string|max:255',
            'new_item_description' => 'nullable|string|max:500',
            'new_item_price' => 'nullable|numeric|min:0',
            'new_item_is_locked' => 'nullable|boolean',
            'new_item_supplier_category_id' => 'nullable|integer|exists:supplier_categories,id',
        ]);

        try {
            $service = new SmartPricingService;
            $result = $service->applyResolution($requisition, $validated['line_item_id'], $validated);

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('SmartPricing apply error', ['error' => $e->getMessage(), 'line_item_id' => $validated['line_item_id']]);

            return response()->json(['error' => 'Failed to apply pricing resolution'], 500);
        }
    }
}
