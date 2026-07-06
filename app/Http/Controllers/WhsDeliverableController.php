<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\WhsDeliverable;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class WhsDeliverableController extends Controller
{
    /** Expiry filter windows: key => number of days from today (inclusive of overdue). */
    private const EXPIRY_WINDOWS = [
        'tomorrow' => 1,
        '7' => 7,
        '30' => 30,
        '90' => 90,
    ];

    /** Labels for the expiry filter dropdown, in display order. */
    private const EXPIRY_OPTIONS = [
        'tomorrow' => 'By tomorrow',
        '7' => 'Within 7 days',
        '30' => 'Within 30 days',
        '90' => 'Within 90 days',
    ];


    /**
     * Smart entry from the sidebar `/whs-deliverables`:
     *  - 1 accessible project  → redirect straight to that project's register
     *  - 0 or 2+ projects      → render the picker (also reads localStorage client-side)
     */
    public function selectLocation()
    {
        $locations = $this->scopedLocations()->orderBy('name')->get(['id', 'name']);

        if ($locations->count() === 1) {
            return redirect()->route('locations.whs-deliverables.index', $locations->first()->id);
        }

        return Inertia::render('whs-deliverables/select-location', [
            'locations' => $locations,
        ]);
    }

    public function index(Request $request, Location $location)
    {
        $this->authorizeLocation($location);

        $request->validate([
            'type' => ['nullable', Rule::in(array_keys(WhsDeliverable::TYPES))],
            'expiry' => ['nullable', Rule::in(array_keys(self::EXPIRY_WINDOWS))],
            'notify' => ['nullable', 'in:yes,no'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $type = $request->input('type');
        $expiry = $request->input('expiry');
        $notify = $request->input('notify');
        $q = trim((string) $request->input('q'));

        $entries = WhsDeliverable::where('location_id', $location->id)
            ->when($type, fn ($query) => $query->where('type', $type))
            ->when($expiry, fn ($query) => $query
                ->whereNotNull('next_date')
                ->whereDate('next_date', '<=', Carbon::today()->addDays(self::EXPIRY_WINDOWS[$expiry])))
            ->when($notify !== null, fn ($query) => $query->where('notify', $notify === 'yes'))
            ->when($q !== '', fn ($query) => $query->where('name', 'like', '%'.$q.'%'))
            ->latest('updated_at')
            ->get();

        return Inertia::render('whs-deliverables/index', [
            'location' => $this->locationPayload($location),
            'entries' => $entries->map(fn (WhsDeliverable $e) => $this->cardPayload($e, $location)),
            'filters' => ['type' => $type, 'expiry' => $expiry, 'notify' => $notify, 'q' => $q ?: null],
            'expiryOptions' => self::EXPIRY_OPTIONS,
            'types' => WhsDeliverable::TYPES,
            'siblings' => $this->scopedLocations()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function create(Location $location)
    {
        $this->authorizeLocation($location);

        return Inertia::render('whs-deliverables/create', [
            'location' => $this->locationPayload($location),
            'types' => WhsDeliverable::TYPES,
        ]);
    }

    public function edit(Location $location, WhsDeliverable $whsDeliverable)
    {
        $this->authorizeLocation($location);
        abort_unless($whsDeliverable->location_id === $location->id, 404);

        return Inertia::render('whs-deliverables/edit', [
            'location' => $this->locationPayload($location),
            'entry' => $this->detailPayload($whsDeliverable, $location),
            'types' => WhsDeliverable::TYPES,
        ]);
    }

    public function show(Location $location, WhsDeliverable $whsDeliverable)
    {
        $this->authorizeLocation($location);
        abort_unless($whsDeliverable->location_id === $location->id, 404);

        $comments = $whsDeliverable->comments()
            ->with(['user', 'media'])
            ->whereNull('parent_id')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'body' => $c->body,
                'user' => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
                'metadata' => $c->metadata,
                'created_at' => $c->created_at->toISOString(),
                'attachments' => $c->getMedia('attachments')->map(fn ($m) => [
                    'id' => $m->id,
                    'file_name' => $m->file_name,
                    'url' => route('comments.attachment', ['comment' => $c->id, 'media' => $m->id]),
                    'mime_type' => $m->mime_type,
                    'size' => $m->size,
                ])->values(),
            ]);

        return Inertia::render('whs-deliverables/show', [
            'location' => $this->locationPayload($location),
            'entry' => $this->detailPayload($whsDeliverable, $location),
            'comments' => $comments,
            'types' => WhsDeliverable::TYPES,
            'siblings' => $this->scopedLocations()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request, Location $location)
    {
        $this->authorizeLocation($location);

        $data = $this->validateEntry($request);

        $entry = WhsDeliverable::create([
            'location_id' => $location->id,
            'type' => $data['type'],
            'name' => $data['name'],
            'details' => $data['details'],
            'checklist' => $data['checklist'],
            'last_date' => $data['last_date'],
            'next_date' => $data['next_date'],
            'notify' => $data['notify'],
            'created_by_user_id' => auth()->id(),
        ]);

        if ($request->hasFile('photo')) {
            $entry->addMediaFromRequest('photo')->toMediaCollection('photo');
        }

        if ($userId = auth()->id()) {
            $entry->addSystemComment(
                'Added "'.$entry->name.'" to the register.',
                ['event' => 'created'],
                $userId,
            );
        }

        return redirect()
            ->route('locations.whs-deliverables.show', [$location->id, $entry->id])
            ->with('success', 'WHS deliverable added.');
    }

    public function update(Request $request, Location $location, WhsDeliverable $whsDeliverable)
    {
        $this->authorizeLocation($location);
        abort_unless($whsDeliverable->location_id === $location->id, 404);

        $data = $this->validateEntry($request);

        $whsDeliverable->update([
            'type' => $data['type'],
            'name' => $data['name'],
            'details' => $data['details'],
            'checklist' => $data['checklist'],
            'last_date' => $data['last_date'],
            'next_date' => $data['next_date'],
            'notify' => $data['notify'],
        ]);

        if ($request->hasFile('photo')) {
            $whsDeliverable->clearMediaCollection('photo');
            $whsDeliverable->addMediaFromRequest('photo')->toMediaCollection('photo');
        } elseif ($request->boolean('remove_photo')) {
            $whsDeliverable->clearMediaCollection('photo');
        }

        return redirect()
            ->route('locations.whs-deliverables.show', [$location->id, $whsDeliverable->id])
            ->with('success', 'WHS deliverable updated.');
    }

    public function toggleNotify(Location $location, WhsDeliverable $whsDeliverable)
    {
        $this->authorizeLocation($location);
        abort_unless($whsDeliverable->location_id === $location->id, 404);

        $whsDeliverable->update(['notify' => ! $whsDeliverable->notify]);

        return redirect()->back();
    }

    public function destroy(Location $location, WhsDeliverable $whsDeliverable)
    {
        $this->authorizeLocation($location);
        abort_unless($whsDeliverable->location_id === $location->id, 404);

        $whsDeliverable->delete();

        return redirect()->route('locations.whs-deliverables.index', $location->id)
            ->with('success', 'WHS deliverable deleted.');
    }

    public function restore(Location $location, string $id)
    {
        $this->authorizeLocation($location);

        $entry = WhsDeliverable::onlyTrashed()->where('location_id', $location->id)->findOrFail($id);
        $entry->restore();

        return redirect()->back()->with('success', 'WHS deliverable restored.');
    }

    /**
     * Same-origin stream of the deliverable's photo (S3-backed via media library).
     */
    public function photo(Location $location, WhsDeliverable $whsDeliverable)
    {
        $this->authorizeLocation($location);
        abort_unless($whsDeliverable->location_id === $location->id, 404);

        $media = $whsDeliverable->getFirstMedia('photo');
        abort_unless($media, 404);

        try {
            $stream = $media->stream();
        } catch (\League\Flysystem\UnableToReadFile) {
            abort(404, 'Photo is missing from storage.');
        }

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $media->mime_type ?? 'image/jpeg',
            'Content-Disposition' => 'inline; filename="'.$media->file_name.'"',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    /**
     * Stream a one-table register PDF for the given type at this project. Used by the
     * "Download register" button on the index when the user has filtered to a single type.
     */
    public function registerPdf(Location $location, string $type)
    {
        $this->authorizeLocation($location);
        abort_unless(array_key_exists($type, WhsDeliverable::TYPES), 404);

        $entries = WhsDeliverable::where('location_id', $location->id)
            ->where('type', $type)
            ->orderBy('name')
            ->get();

        $logoPath = public_path('logo-cms.png');
        $logoBase64 = file_exists($logoPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath))
            : '';

        $html = view('whs-deliverables.register-pdf', [
            'location' => $location,
            'type' => $type,
            'config' => WhsDeliverable::TYPES[$type],
            'entries' => $entries,
            'logoBase64' => $logoBase64,
        ])->render();

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

        $pdf = $browsershot
            ->noSandbox()
            ->landscape()
            ->format('A4')
            ->margins(15, 12, 15, 12, 'mm')
            ->showBackground()
            ->pdf();

        $typeLabel = WhsDeliverable::TYPES[$type]['label'];
        $filename = "{$typeLabel} register - {$location->name}.pdf";

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    private function validateEntry(Request $request): array
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(array_keys(WhsDeliverable::TYPES))],
            'name' => ['required', 'string', 'max:255'],
            'details' => ['nullable', 'array'],
            'checklist' => ['nullable', 'array'],
            'last_date' => ['nullable', 'date'],
            'next_date' => ['nullable', 'date'],
            'notify' => ['nullable', 'boolean'],
            'photo' => ['nullable', 'image', 'max:51200'],
        ]);

        $config = WhsDeliverable::TYPES[$validated['type']];

        // Keep only detail keys defined for this type (fields + any checklist-driven free-text keys).
        $fieldKeys = collect($config['fields'])->pluck('key')->all();
        $checklistInputKeys = collect($config['checklist'] ?? [])->pluck('input_key')->filter()->values()->all();
        $details = collect($request->input('details', []))
            ->only(array_merge($fieldKeys, $checklistInputKeys))
            ->map(fn ($v) => is_string($v) ? trim($v) : $v)
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->all();

        // Checklist only applies to types that define one; store as booleans.
        $checklist = null;
        if (! empty($config['checklist'])) {
            $checklistKeys = collect($config['checklist'])->pluck('key')->all();
            $checklist = collect($checklistKeys)
                ->mapWithKeys(fn ($key) => [$key => $request->boolean("checklist.$key")])
                ->all();
        }

        return [
            'type' => $validated['type'],
            'name' => $validated['name'],
            'details' => $details ?: null,
            'checklist' => $checklist,
            'last_date' => $validated['last_date'] ?? null,
            'next_date' => $validated['next_date'] ?? null,
            'notify' => $request->boolean('notify'),
        ];
    }

    private function cardPayload(WhsDeliverable $entry, Location $location): array
    {
        $config = $entry->type_config;

        return [
            'id' => $entry->id,
            'type' => $entry->type,
            'type_label' => $config['label'],
            'name' => $entry->name,
            'physical' => $config['physical'],
            'photo_url' => $entry->getFirstMedia('photo')
                ? route('locations.whs-deliverables.photo', [$location->id, $entry->id])
                : null,
            'details' => $entry->details ?? [],
            'last_label' => $config['last_label'],
            'next_label' => $config['next_label'],
            'last_date' => $entry->last_date?->toDateString(),
            'next_date' => $entry->next_date?->toDateString(),
            'notify' => $entry->notify,
            'status_key' => $entry->statusKey(),
            'days_until' => $entry->daysUntilDue(),
        ];
    }

    private function detailPayload(WhsDeliverable $entry, Location $location): array
    {
        $config = $entry->type_config;

        return array_merge($this->cardPayload($entry, $location), [
            'checklist' => $entry->checklist ?? [],
            'created_at' => $entry->created_at?->toISOString(),
            'creator' => $entry->creator ? ['id' => $entry->creator->id, 'name' => $entry->creator->name] : null,
        ]);
    }

    private function locationPayload(Location $location): array
    {
        return [
            'id' => $location->id,
            'name' => $location->name,
            'external_id' => $location->external_id,
        ];
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
}
