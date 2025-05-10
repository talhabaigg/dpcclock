<?php

namespace App\Http\Controllers;

use App\Models\MaterialItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MaterialItemController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(MaterialItem $materialItem)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(MaterialItem $materialItem)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, MaterialItem $materialItem)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(MaterialItem $materialItem)
    {
        //
    }

    public function getMaterialItems(Request $request)
    {
        $supplierId = $request->input('supplier_id');

        $query = MaterialItem::query();

        // Wrap search + supplier filter inside the same where block
        if ($request->has('search') && $request->has('supplier_id')) {
            $search = $request->input('search');

            $query->where('supplier_id', $supplierId)
                ->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
        } elseif ($request->has('supplier_id')) {
            // No search, just filter by supplier
            $query->where('supplier_id', $supplierId);
        }

        $materialItems = $query->limit(10)->get();

        return response()->json($materialItems);
    }

    public function getMaterialItemById($id)
    {
        Log::info('Fetching material item with ID: ' . $id);
        $item = MaterialItem::with('costCode')->find($id);
       

        if (!$item) {
            return response()->json(['message' => 'Item not found'], 404);
        }
        $itemArray = $item->toArray();
        $itemArray['price_list'] = 'base_price';
        $itemArray['cost_code'] = $item->costCode ? $item->costCode->code : null;
        Log::info('Material item found: ' . json_encode($itemArray));
        return response()->json($itemArray);
    }
}
