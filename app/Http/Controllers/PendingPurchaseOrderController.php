<?php

namespace App\Http\Controllers;

use App\Models\ApPurchaseOrder;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PendingPurchaseOrderController extends Controller
{
    public function index(Request $request, Location $location)
    {
        $asOfDate = $request->query('as_of_date')
            ? Carbon::parse($request->query('as_of_date'))
            : Carbon::now();

        $pendingOrders = collect();

        if ($location->external_id) {
            $pendingOrders = ApPurchaseOrder::where('job_number', $location->external_id)
                ->where('status', 'PENDING')
                ->whereYear('po_date', $asOfDate->year)
                ->whereMonth('po_date', $asOfDate->month)
                ->where('po_date', '<=', $asOfDate)
                ->select([
                    'po_number',
                    'vendor_code',
                    'vendor_name',
                    'po_date',
                    'po_required_date',
                    'approval_status',
                    'created_by',
                    DB::raw('COUNT(*) as line_count'),
                    DB::raw('SUM(amount) as total_amount'),
                    DB::raw('SUM(qty) as total_qty'),
                ])
                ->groupBy('po_number', 'vendor_code', 'vendor_name', 'po_date', 'po_required_date', 'approval_status', 'created_by')
                ->orderBy('po_date', 'desc')
                ->orderBy('po_number')
                ->get();
        }

        $totalAmount = round((float) $pendingOrders->sum('total_amount'), 2);

        return Inertia::render('pending-purchase-orders/index', [
            'location' => $location,
            'pendingOrders' => $pendingOrders,
            'asOfDate' => $asOfDate->format('Y-m-d'),
            'stats' => [
                'total_amount' => $totalAmount,
                'po_count' => $pendingOrders->count(),
                'line_count' => (int) $pendingOrders->sum('line_count'),
            ],
        ]);
    }
}
