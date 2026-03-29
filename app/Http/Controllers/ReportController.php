<?php

namespace App\Http\Controllers;

use App\Models\RequisitionLineItem;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function reqLineReport(Request $request)
    {
        $from = $request->query('from');
        $to = $request->query('to');

        $query = RequisitionLineItem::with('requisition.supplier')
            ->where(function ($query) {
                $query->whereNull('code')
                    ->orWhere('code', '');
            })
            ->has('requisition');

        if ($from) {
            $query->whereHas('requisition', function ($q) use ($from) {
                $q->whereDate('created_at', '>=', $from);
            });
        }

        if ($to) {
            $query->whereHas('requisition', function ($q) use ($to) {
                $q->whereDate('created_at', '<=', $to);
            });
        }

        $lineItems = $query->get();

        return Inertia::render('reports/reqLineItems', [
            'lineItems' => $lineItems,
            'filters' => [
                'from' => $from,
                'to' => $to,
            ],
        ]);
    }
}
