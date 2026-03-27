<?php

namespace App\Http\Controllers;

use App\Jobs\SyncPremierPoHeadersForJob;
use App\Models\Location;
use App\Models\PremierPoHeader;
use Inertia\Inertia;

class PremierPoHeaderController extends Controller
{
    public function index(Location $location)
    {
        $poHeaders = collect();

        if ($location->external_id) {
            $poHeaders = PremierPoHeader::where('job_number', $location->external_id)
                ->orderBy('po_date', 'desc')
                ->select([
                    'id',
                    'premier_po_id',
                    'requisition_id',
                    'po_number',
                    'vendor_code',
                    'vendor_name',
                    'job_number',
                    'po_date',
                    'required_date',
                    'total_amount',
                    'invoiced_amount',
                    'status',
                    'approval_status',
                    'description',
                    'synced_at',
                ])
                ->get()
                ->map(function ($po) {
                    $po->remaining_amount = (float) $po->total_amount - (float) $po->invoiced_amount;

                    return $po;
                });
        }

        return Inertia::render('premier-po-headers/index', [
            'location' => $location,
            'poHeaders' => $poHeaders,
            'stats' => [
                'total' => $poHeaders->count(),
                'linked' => $poHeaders->whereNotNull('requisition_id')->count(),
                'orphaned' => $poHeaders->whereNull('requisition_id')->count(),
            ],
        ]);
    }

    public function sync(Location $location)
    {
        if (! $location->external_id) {
            return redirect()->back()->with('error', 'This location has no job number linked.');
        }

        SyncPremierPoHeadersForJob::dispatch($location->external_id, $location->id);

        return redirect()->back()->with('success', 'PO sync started for job ' . $location->external_id . '. This may take a few minutes.');
    }
}
