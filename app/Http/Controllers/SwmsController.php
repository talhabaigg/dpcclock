<?php

namespace App\Http\Controllers;

use App\Enums\SwmsVersionStatus;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\Swms;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SwmsController extends Controller
{
    /**
     * Smart entry from sidebar `/swms`:
     *  - 0 accessible locations → render an empty-state picker
     *  - 1 accessible location  → redirect straight to that project's SWMS
     *  - 2+ accessible locations → render the picker (also reads localStorage client-side)
     */
    public function selectLocation()
    {
        $locations = $this->scopedLocations()->orderBy('name')->get(['id', 'name']);

        if ($locations->count() === 1) {
            return redirect()->route('locations.swms.index', $locations->first()->id);
        }

        return Inertia::render('swms/select-location', [
            'locations' => $locations,
        ]);
    }

    public function index(Request $request, Location $location)
    {
        $this->authorizeLocation($location);

        $perPage = (int) $request->input('per_page', 25);
        if (! in_array($perPage, [10, 25, 50, 100], true)) {
            $perPage = 25;
        }

        $query = Swms::query()
            ->where('location_id', $location->id)
            ->with([
                'activeVersion' => function ($q) {
                    $q->select(['id', 'swms_id', 'version_number', 'status', 'approved_at', 'requires_resignature', 'created_at']);
                },
                'activeVersion.signatures:id,swms_version_id,employee_id',
            ])
            ->withCount('versions');

        if ($request->filled('q')) {
            $query->where('name', 'like', '%' . $request->q . '%');
        }

        $swmsList = $query->latest('updated_at')->paginate($perPage)->withQueryString();

        $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
        $kioskCount = $kiosk ? $kiosk->employees()->count() : 0;

        $swmsList->getCollection()->transform(function ($swms) use ($kioskCount) {
            $swms->signed_count = $swms->activeVersion?->signatures->count() ?? 0;
            $swms->kiosk_count = $kioskCount;

            if ($swms->activeVersion) {
                $swms->activeVersion->unsetRelation('signatures');
            }

            return $swms;
        });

        $availableLocations = $this->scopedLocations()->orderBy('name')->get(['id', 'name']);

        return Inertia::render('swms/index', [
            'location' => ['id' => $location->id, 'name' => $location->name],
            'swms' => $swmsList,
            'filters' => array_merge($request->only(['q']), ['per_page' => $perPage]),
            'availableLocations' => $availableLocations,
        ]);
    }

    public function create(Location $location)
    {
        $this->authorizeLocation($location);

        return Inertia::render('swms/form', [
            'swms' => null,
            'location' => ['id' => $location->id, 'name' => $location->name],
        ]);
    }

    public function store(Request $request, Location $location)
    {
        $this->authorizeLocation($location);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
        ]);

        $exists = Swms::where('location_id', $location->id)
            ->where('name', $data['name'])
            ->exists();
        abort_if($exists, 422, 'A SWMS with this name already exists for this project.');

        $swms = Swms::create([
            'location_id' => $location->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
        ]);

        return redirect()->route('locations.swms.show', [$location->id, $swms->id])
            ->with('success', 'SWMS created. Upload the first version to make it active.');
    }

    public function show(Location $location, Swms $swms)
    {
        $this->authorizeLocation($location);
        abort_unless($swms->location_id === $location->id, 404);

        $swms->load([
            'location:id,name,eh_location_id',
            'createdBy:id,name',
            'versions' => function ($q) {
                $q->orderByDesc('created_at');
            },
            'versions.createdBy:id,name',
            'versions.signatures:id,swms_version_id,employee_id',
        ]);

        $active = $swms->versions->firstWhere('status', SwmsVersionStatus::Active);
        $signedOnActive = $active ? $active->signatures->pluck('employee_id')->all() : [];

        $kioskEmployees = collect();
        $kiosk = Kiosk::where('eh_location_id', $swms->location->eh_location_id)->first();
        if ($kiosk) {
            $kioskEmployees = $kiosk->employees()->orderBy('name')->get(['employees.id', 'name', 'preferred_name']);
        }

        $versions = $swms->versions->map(function ($v) {
            return [
                'id' => $v->id,
                'version_number' => $v->version_number,
                'status' => $v->status?->value,
                'status_label' => $v->status?->label(),
                'requires_resignature' => $v->requires_resignature,
                'change_summary' => $v->change_summary,
                'approved_at' => $v->approved_at?->toIso8601String(),
                'created_at' => $v->created_at->toIso8601String(),
                'created_by' => $v->createdBy ? ['id' => $v->createdBy->id, 'name' => $v->createdBy->name] : null,
                'document_filename' => $v->document_filename,
                'signatures_count' => $v->signatures->count(),
            ];
        })->values();

        return Inertia::render('swms/show', [
            'location' => ['id' => $location->id, 'name' => $location->name],
            'swms' => [
                'id' => $swms->id,
                'name' => $swms->name,
                'description' => $swms->description,
                'created_by' => $swms->createdBy ? ['id' => $swms->createdBy->id, 'name' => $swms->createdBy->name] : null,
                'created_at' => $swms->created_at->toIso8601String(),
            ],
            'versions' => $versions,
            'activeSummary' => $active ? [
                'id' => $active->id,
                'signed_count' => count($signedOnActive),
                'kiosk_count' => $kioskEmployees->count(),
            ] : null,
        ]);
    }

    public function edit(Location $location, Swms $swms)
    {
        $this->authorizeLocation($location);
        abort_unless($swms->location_id === $location->id, 404);

        return Inertia::render('swms/form', [
            'location' => ['id' => $location->id, 'name' => $location->name],
            'swms' => [
                'id' => $swms->id,
                'name' => $swms->name,
                'description' => $swms->description,
            ],
        ]);
    }

    public function update(Request $request, Location $location, Swms $swms)
    {
        $this->authorizeLocation($location);
        abort_unless($swms->location_id === $location->id, 404);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
        ]);

        $duplicate = Swms::where('location_id', $swms->location_id)
            ->where('name', $data['name'])
            ->where('id', '!=', $swms->id)
            ->exists();
        abort_if($duplicate, 422, 'A SWMS with this name already exists for this project.');

        $swms->update($data);

        return redirect()->route('locations.swms.show', [$location->id, $swms->id])
            ->with('success', 'SWMS updated.');
    }

    public function destroy(Location $location, Swms $swms)
    {
        $this->authorizeLocation($location);
        abort_unless($swms->location_id === $location->id, 404);

        $swms->delete();

        return redirect()->route('locations.swms.index', $location->id)
            ->with('success', 'SWMS deleted.');
    }

    private function authorizeLocation(Location $location): void
    {
        $user = auth()->user();
        if ($user->hasPermissionTo('swms.view-all')) {
            return;
        }

        $allowedIds = $this->scopedLocations()->pluck('id')->all();
        abort_unless(in_array($location->id, $allowedIds, true), 403);
    }

    private function scopedLocations()
    {
        $query = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open();

        $user = auth()->user();
        if ($user && ! $user->hasPermissionTo('swms.view-all')) {
            $ehLocationIds = $user->managedKiosks()->pluck('eh_location_id');
            $query->whereIn('eh_location_id', $ehLocationIds);
        }

        return $query;
    }
}
