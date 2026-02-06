<?php

namespace App\Http\Controllers;

use App\Models\MaterialItem;
use App\Models\Supplier;
use App\Models\SupplierCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class UpdatePricingController extends Controller
{
    public function index()
    {
        return Inertia::render('updatePricing/index', [
            'suppliers' => Supplier::orderBy('name')->get(),
            'categories' => SupplierCategory::with('supplier')->orderBy('name')->get(),
        ]);
    }

    /**
     * Preview items that will be affected by the pricing update
     */
    public function preview(Request $request)
    {
        $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'supplier_category_id' => 'nullable|exists:supplier_categories,id',
            'adjustment_type' => 'required|in:percentage,fixed',
            'adjustment_value' => 'required|numeric',
        ]);

        $query = MaterialItem::where('supplier_id', $request->supplier_id);

        if ($request->supplier_category_id) {
            $query->where('supplier_category_id', $request->supplier_category_id);
        }

        $items = $query->get();

        $adjustmentType = $request->adjustment_type;
        $adjustmentValue = (float) $request->adjustment_value;

        $previewItems = $items->map(function ($item) use ($adjustmentType, $adjustmentValue) {
            $currentPrice = (float) $item->unit_cost;

            if ($adjustmentType === 'percentage') {
                $newPrice = $currentPrice * (1 + ($adjustmentValue / 100));
            } else {
                $newPrice = $currentPrice + $adjustmentValue;
            }

            // Ensure price doesn't go negative
            $newPrice = max(0, $newPrice);

            return [
                'id' => $item->id,
                'code' => $item->code,
                'description' => $item->description,
                'current_price' => round($currentPrice, 6),
                'new_price' => round($newPrice, 6),
                'difference' => round($newPrice - $currentPrice, 6),
            ];
        });

        return response()->json([
            'items' => $previewItems,
            'total_items' => $previewItems->count(),
        ]);
    }

    /**
     * Apply the pricing update to all affected items
     */
    public function apply(Request $request)
    {
        $request->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'supplier_category_id' => 'nullable|exists:supplier_categories,id',
            'adjustment_type' => 'required|in:percentage,fixed',
            'adjustment_value' => 'required|numeric',
        ]);

        $supplierId = $request->supplier_id;
        $categoryId = $request->supplier_category_id;
        $adjustmentType = $request->adjustment_type;
        $adjustmentValue = (float) $request->adjustment_value;

        $query = MaterialItem::where('supplier_id', $supplierId);

        if ($categoryId) {
            $query->where('supplier_category_id', $categoryId);
        }

        $items = $query->get();

        if ($items->isEmpty()) {
            return redirect()->back()->with('error', 'No items found matching the criteria.');
        }

        $supplier = Supplier::find($supplierId);
        $category = $categoryId ? SupplierCategory::find($categoryId) : null;

        $updatedCount = 0;

        DB::beginTransaction();

        try {
            foreach ($items as $item) {
                $oldPrice = (float) $item->unit_cost;

                if ($adjustmentType === 'percentage') {
                    $newPrice = $oldPrice * (1 + ($adjustmentValue / 100));
                } else {
                    $newPrice = $oldPrice + $adjustmentValue;
                }

                // Ensure price doesn't go negative
                $newPrice = max(0, round($newPrice, 6));

                // Skip if no change
                if ($oldPrice == $newPrice) {
                    continue;
                }

                $item->unit_cost = $newPrice;
                $item->save();

                // Log the change using activity log
                activity()
                    ->performedOn($item)
                    ->causedBy(auth()->user())
                    ->withProperties([
                        'old_price' => $oldPrice,
                        'new_price' => $newPrice,
                        'adjustment_type' => $adjustmentType,
                        'adjustment_value' => $adjustmentValue,
                        'supplier' => $supplier->name,
                        'category' => $category ? $category->name : 'All Categories',
                    ])
                    ->log('bulk_price_update');

                $updatedCount++;
            }

            DB::commit();

            Log::info('Bulk pricing update completed', [
                'user_id' => auth()->id(),
                'supplier_id' => $supplierId,
                'category_id' => $categoryId,
                'adjustment_type' => $adjustmentType,
                'adjustment_value' => $adjustmentValue,
                'items_updated' => $updatedCount,
            ]);

            return redirect()->back()->with('success', "Successfully updated pricing for {$updatedCount} items.");

        } catch (\Exception $e) {
            DB::rollBack();

            Log::error('Bulk pricing update failed', [
                'error' => $e->getMessage(),
                'user_id' => auth()->id(),
                'supplier_id' => $supplierId,
                'category_id' => $categoryId,
            ]);

            return redirect()->back()->with('error', 'Failed to update pricing: '.$e->getMessage());
        }
    }
}
