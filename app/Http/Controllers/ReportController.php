<?php

namespace App\Http\Controllers;

use App\Models\RequisitionLineItem;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function reqLineReport()
    {
        $lineItems = RequisitionLineItem::with('requisition.supplier')
            ->where(function ($query) {
                $query->whereNull('code')
                    ->orWhere('code', '');
            })
            ->has('requisition') // ✅ only include items with a related requisition
            ->get();


        return Inertia::render('reports/reqLineItems', [
            'lineItems' => $lineItems,
        ]);
    }

}