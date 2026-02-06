<?php

namespace App\Http\Controllers;

use App\Models\Supplier;
use App\Models\SupplierCategory;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SupplierCategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $categories = SupplierCategory::with('supplier')->get();

        return Inertia::render('supplierCategory/index', [
            'categories' => $categories,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return Inertia::render('supplierCategory/edit', [
            'category' => null,
            'suppliers' => Supplier::all(),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'code' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'supplier_id' => 'required|exists:suppliers,id',
        ]);

        SupplierCategory::create([
            'code' => $request->input('code'),
            'name' => $request->input('name'),
            'supplier_id' => $request->input('supplier_id'),
        ]);

        return redirect()->route('supplier-categories.index')->with('success', 'Supplier category created successfully.');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(SupplierCategory $supplierCategory)
    {
        return Inertia::render('supplierCategory/edit', [
            'category' => $supplierCategory->load('supplier'),
            'suppliers' => Supplier::all(),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, SupplierCategory $supplierCategory)
    {
        $request->validate([
            'code' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'supplier_id' => 'required|exists:suppliers,id',
        ]);

        $supplierCategory->update([
            'code' => $request->input('code'),
            'name' => $request->input('name'),
            'supplier_id' => $request->input('supplier_id'),
        ]);

        return redirect()->back()->with('success', 'Supplier category updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(SupplierCategory $supplierCategory)
    {
        $supplierCategory->delete();

        return redirect()->route('supplier-categories.index')->with('success', 'Supplier category deleted successfully.');
    }

    /**
     * Get categories by supplier ID (for API use)
     */
    public function getBySupplier($supplierId)
    {
        $categories = SupplierCategory::where('supplier_id', $supplierId)->get();

        return response()->json($categories);
    }
}
