<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\PpeIssuance;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class PpeRegisterController extends Controller
{
    /**
     * Smart entry from sidebar `/ppe-register`:
     *  - 0 accessible projects → render an empty-state picker
     *  - 1 accessible project  → redirect straight to that project's register
     *  - 2+ projects           → render the picker (also reads localStorage client-side)
     */
    public function selectLocation()
    {
        $locations = $this->scopedLocations()->orderBy('name')->get(['id', 'name']);

        if ($locations->count() === 1) {
            return redirect()->route('locations.ppe-register.index', $locations->first()->id);
        }

        return Inertia::render('ppe-register/select-location', [
            'locations' => $locations,
        ]);
    }

    public function index(Request $request, Location $location)
    {
        $this->authorizeLocation($location);

        $request->validate([
            'per_page' => 'nullable|integer|in:10,25,50,100',
            'trashed' => 'nullable|in:0,1',
            'reason' => 'nullable|string',
            'source' => 'nullable|in:qr,kiosk',
        ]);

        $perPage = (int) $request->input('per_page', 25);
        $showTrashed = $request->boolean('trashed');

        $query = PpeIssuance::with(['employee:id,name,preferred_name', 'authorisedBy:id,name'])
            ->where('location_id', $location->id);

        if ($showTrashed) {
            $query->withTrashed();
        }

        foreach (['reason', 'source'] as $col) {
            if ($request->filled($col)) {
                $query->where($col, $request->input($col));
            }
        }

        $issuances = $query->latest('submitted_at')->paginate($perPage)->withQueryString();

        $issuances->getCollection()->transform(function (PpeIssuance $i) {
            return [
                'id' => $i->id,
                'submitted_at' => $i->submitted_at?->toIso8601String(),
                'submitted_at_formatted' => $i->submitted_at?->format('D d/m/Y g:ia'),
                'employee' => $i->employee ? [
                    'id' => $i->employee->id,
                    'name' => $i->employee->preferred_name ?? $i->employee->name,
                ] : null,
                'authorised_by' => $i->authorisedBy ? ['id' => $i->authorisedBy->id, 'name' => $i->authorisedBy->name] : null,
                'reason' => $i->reason,
                'reason_label' => $i->reason_label,
                'items_count' => collect($i->issued_items ?? [])->sum(fn ($it) => (int) ($it['qty'] ?? 0)),
                'ppe_returned' => $i->ppe_returned,
                'returned_label' => $i->returned_label,
                'source' => $i->source,
                'fit_test_completed' => $i->fit_test_completed,
                'deleted_at' => $i->deleted_at?->toIso8601String(),
            ];
        });

        return Inertia::render('ppe-register/index', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'external_id' => $location->external_id,
            ],
            'issuances' => $issuances,
            'filters' => array_merge(
                $request->only(['reason', 'source']),
                ['trashed' => $showTrashed],
            ),
            'reasonOptions' => PpeIssuance::REASON_OPTIONS,
            'sourceOptions' => [
                PpeIssuance::SOURCE_QR => 'PPE cabinet QR',
                PpeIssuance::SOURCE_KIOSK => 'Site kiosk',
            ],
            'trashedCount' => PpeIssuance::onlyTrashed()->where('location_id', $location->id)->count(),
            'siblings' => $this->scopedLocations()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function show(Location $location, string $id)
    {
        $this->authorizeLocation($location);

        $issuance = PpeIssuance::with(['employee:id,name,preferred_name', 'authorisedBy:id,name'])
            ->withTrashed()
            ->where('location_id', $location->id)
            ->findOrFail($id);

        $catalogByKey = collect(PpeIssuance::PPE_CATALOG)->keyBy('key');

        $items = collect($issuance->issued_items ?? [])->map(function ($it) use ($catalogByKey) {
            $catalog = $catalogByKey->get($it['key']) ?? null;

            return [
                'key' => $it['key'],
                'label' => $catalog['label'] ?? $it['key'],
                'qty' => (int) ($it['qty'] ?? 0),
                'size' => $it['size'] ?? null,
                'make_model' => $it['make_model'] ?? null,
            ];
        })->values();

        return Inertia::render('ppe-register/show', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'external_id' => $location->external_id,
            ],
            'issuance' => [
                'id' => $issuance->id,
                'submitted_at' => $issuance->submitted_at?->toIso8601String(),
                'submitted_at_formatted' => $issuance->submitted_at?->format('D d/m/Y g:ia'),
                'reason' => $issuance->reason,
                'reason_label' => $issuance->reason_label,
                'ppe_returned' => $issuance->ppe_returned,
                'returned_label' => $issuance->returned_label,
                'fit_test_completed' => $issuance->fit_test_completed,
                'source' => $issuance->source,
                'items' => $items,
                'employee' => $issuance->employee ? [
                    'id' => $issuance->employee->id,
                    'name' => $issuance->employee->preferred_name ?? $issuance->employee->name,
                    'full_name' => $issuance->employee->name,
                ] : null,
                'authorised_by' => $issuance->authorisedBy ? [
                    'id' => $issuance->authorisedBy->id,
                    'name' => $issuance->authorisedBy->name,
                ] : null,
                'deleted_at' => $issuance->deleted_at?->toIso8601String(),
            ],
        ]);
    }

    public function destroy(Location $location, string $id)
    {
        $this->authorizeLocation($location);

        $issuance = PpeIssuance::where('location_id', $location->id)->findOrFail($id);
        $issuance->delete();

        return redirect()->route('locations.ppe-register.index', $location->id)
            ->with('success', 'PPE register entry deleted.');
    }

    public function restore(Location $location, string $id)
    {
        $this->authorizeLocation($location);

        $issuance = PpeIssuance::onlyTrashed()->where('location_id', $location->id)->findOrFail($id);
        $issuance->restore();

        return redirect()->back()->with('success', 'PPE register entry restored.');
    }

    /**
     * Render the printable PPE cabinet QR sheet as a PDF (mirrors toolbox QR sheet style).
     */
    public function qr(Location $location)
    {
        $this->authorizeLocation($location);

        $token = $location->ensurePpePublicToken();
        $url = url("/ppe/{$token}");

        $html = view('pdf.ppe-cabinet-qr-sheet', [
            'location' => $location,
            'signInUrl' => $url,
        ])->render();

        $pdf = $this->renderPdf($html);

        $filename = 'ppe-cabinet-qr-' . ($location->external_id ?: $location->id) . '.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    private function authorizeLocation(Location $location): void
    {
        $user = auth()->user();
        if ($user && $user->hasPermissionTo('prestarts.view-all')) {
            return;
        }

        $allowedIds = $this->scopedLocations()->pluck('id')->all();
        abort_unless(in_array($location->id, $allowedIds, true), 403);
    }

    private function scopedLocations()
    {
        $query = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open();

        $user = auth()->user();
        if ($user && ! $user->hasPermissionTo('prestarts.view-all')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $query->whereIn('eh_location_id', $ehLocationIds);
        }

        return $query;
    }

    private function renderPdf(string $html): string
    {
        $browsershot = Browsershot::html($html);

        if ($nodeBinary = env('BROWSERSHOT_NODE_BINARY')) {
            $browsershot->setNodeBinary($nodeBinary);
        }
        if ($npmBinary = env('BROWSERSHOT_NPM_BINARY')) {
            $browsershot->setNpmBinary($npmBinary);
        }
        if ($chromePath = env('BROWSERSHOT_CHROME_PATH')) {
            $browsershot->setChromePath($chromePath);
        }

        return $browsershot
            ->noSandbox()
            ->format('A4')
            ->margins(15, 19, 20, 19, 'mm')
            ->showBackground()
            ->pdf();
    }
}
