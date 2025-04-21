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
        $query = MaterialItem::query();
    
        if ($request->has('search') && $search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }
    
        $materialItems = $query->limit(10)->get();
    
        return response()->json($materialItems);
    }

    public function getMaterialItemById($id)
{
    Log::info('Fetching material item with ID: ' . $id);
    $item = MaterialItem::find($id);

    if (!$item) {
        return response()->json(['message' => 'Item not found'], 404);
    }
    Log::info('Material item found: ' . json_encode($item));
    return response()->json($item);
}
}
