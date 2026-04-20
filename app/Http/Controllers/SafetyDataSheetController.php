<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\SafetyDataSheet;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SafetyDataSheetController extends Controller
{
    public function index(Request $request)
    {
        $query = SafetyDataSheet::with(['locations', 'media']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('manufacturer')) {
            $query->where('manufacturer', $request->manufacturer);
        }

        if ($request->filled('location_id')) {
            $query->whereHas('locations', fn ($q) => $q->where('locations.id', $request->location_id));
        }

        if ($request->filled('expiry')) {
            match ($request->expiry) {
                'expired' => $query->where('expires_at', '<', now()),
                'tomorrow' => $query->whereBetween('expires_at', [now(), now()->addDay()]),
                '7days' => $query->whereBetween('expires_at', [now(), now()->addDays(7)]),
                '30days' => $query->whereBetween('expires_at', [now(), now()->addDays(30)]),
                '90days' => $query->whereBetween('expires_at', [now(), now()->addDays(90)]),
                default => null,
            };
        }

        $sds = $query->orderBy('product_name')->paginate(25)->withQueryString();

        $manufacturers = SafetyDataSheet::distinct()->orderBy('manufacturer')->pluck('manufacturer');
        $locations = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->orderBy('name')->get(['id', 'name']);

        return Inertia::render('sds/index', [
            'sds' => $sds,
            'filters' => $request->only(['search', 'manufacturer', 'location_id', 'expiry']),
            'manufacturers' => $manufacturers,
            'locations' => $locations,
            'hazardClassifications' => SafetyDataSheet::HAZARD_CLASSIFICATIONS,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_name' => 'required|string|max:255',
            'manufacturer' => 'required|string|max:255',
            'description' => 'nullable|string',
            'hazard_classifications' => 'nullable|array',
            'hazard_classifications.*' => 'string',
            'expires_at' => 'required|date',
            'location_ids' => 'nullable|array',
            'location_ids.*' => 'integer|exists:locations,id',
            'sds_file' => 'required|file|max:20480',
            'other_files' => 'nullable|array',
            'other_files.*' => 'file|max:20480',
        ]);

        $sds = SafetyDataSheet::create([
            'product_name' => $validated['product_name'],
            'manufacturer' => $validated['manufacturer'],
            'description' => $validated['description'] ?? null,
            'hazard_classifications' => $validated['hazard_classifications'] ?? [],
            'expires_at' => $validated['expires_at'],
            'created_by' => auth()->id(),
        ]);

        if (!empty($validated['location_ids'])) {
            $sds->locations()->sync($validated['location_ids']);
        }

        $sds->addMedia($request->file('sds_file'))->toMediaCollection('sds_file');

        if ($request->hasFile('other_files')) {
            foreach ($request->file('other_files') as $file) {
                $sds->addMedia($file)->toMediaCollection('other_files');
            }
        }

        return redirect()->route('sds.index')->with('success', 'SDS created successfully.');
    }

    public function apiStore(Request $request)
    {
        $validated = $request->validate([
            'product_name' => 'required|string|max:255',
            'manufacturer' => 'required|string|max:255',
            'description' => 'nullable|string',
            'hazard_classifications' => 'nullable|array',
            'hazard_classifications.*' => 'string',
            'expires_at' => 'required|date',
            'sds_file' => 'required|file|max:20480',
            'other_files' => 'nullable|array',
            'other_files.*' => 'file|max:20480',
        ]);

        $sds = SafetyDataSheet::create([
            'product_name' => $validated['product_name'],
            'manufacturer' => $validated['manufacturer'],
            'description' => $validated['description'] ?? null,
            'hazard_classifications' => $validated['hazard_classifications'] ?? [],
            'expires_at' => $validated['expires_at'],
            'created_by' => auth()->id(),
        ]);

        $sds->addMedia($request->file('sds_file'))->toMediaCollection('sds_file');

        if ($request->hasFile('other_files')) {
            foreach ($request->file('other_files') as $file) {
                $sds->addMedia($file)->toMediaCollection('other_files');
            }
        }

        return response()->json(['id' => $sds->id, 'product_name' => $sds->product_name], 201);
    }

    public function update(Request $request, SafetyDataSheet $sd)
    {
        $validated = $request->validate([
            'product_name' => 'required|string|max:255',
            'manufacturer' => 'required|string|max:255',
            'description' => 'nullable|string',
            'hazard_classifications' => 'nullable|array',
            'hazard_classifications.*' => 'string',
            'expires_at' => 'required|date',
            'location_ids' => 'nullable|array',
            'location_ids.*' => 'integer|exists:locations,id',
            'sds_file' => 'nullable|file|max:20480',
            'other_files' => 'nullable|array',
            'other_files.*' => 'file|max:20480',
            'remove_other_files' => 'nullable|array',
            'remove_other_files.*' => 'integer',
        ]);

        $sd->update([
            'product_name' => $validated['product_name'],
            'manufacturer' => $validated['manufacturer'],
            'description' => $validated['description'] ?? null,
            'hazard_classifications' => $validated['hazard_classifications'] ?? [],
            'expires_at' => $validated['expires_at'],
        ]);

        $sd->locations()->sync($validated['location_ids'] ?? []);

        if ($request->hasFile('sds_file')) {
            $sd->addMedia($request->file('sds_file'))->toMediaCollection('sds_file');
        }

        if ($request->hasFile('other_files')) {
            foreach ($request->file('other_files') as $file) {
                $sd->addMedia($file)->toMediaCollection('other_files');
            }
        }

        if (!empty($validated['remove_other_files'])) {
            $sd->media()->whereIn('id', $validated['remove_other_files'])
                ->where('collection_name', 'other_files')
                ->each(fn ($m) => $m->delete());
        }

        return redirect()->route('sds.index')->with('success', 'SDS updated successfully.');
    }

    public function destroy(SafetyDataSheet $sd)
    {
        $sd->delete();

        return redirect()->route('sds.index')->with('success', 'SDS deleted successfully.');
    }

    public function download(SafetyDataSheet $sd)
    {
        $media = $sd->getFirstMedia('sds_file');
        abort_unless($media, 404);

        if (app()->environment('production')) {
            return redirect($media->getTemporaryUrl(now()->addMinutes(30)));
        }

        return $media;
    }

    public function downloadOtherFile(SafetyDataSheet $sd, int $mediaId)
    {
        $media = $sd->media()->where('id', $mediaId)->where('collection_name', 'other_files')->first();
        abort_unless($media, 404);

        if (app()->environment('production')) {
            return redirect($media->getTemporaryUrl(now()->addMinutes(30)));
        }

        return $media;
    }

    public function publicIndex(Request $request)
    {
        $query = SafetyDataSheet::with(['media']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                  ->orWhere('manufacturer', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('manufacturer')) {
            $query->where('manufacturer', $request->manufacturer);
        }

        $sds = $query->orderBy('product_name')->paginate(50)->withQueryString();

        $manufacturers = SafetyDataSheet::distinct()->orderBy('manufacturer')->pluck('manufacturer');

        return Inertia::render('sds/public', [
            'sds' => $sds,
            'filters' => $request->only(['search', 'manufacturer']),
            'manufacturers' => $manufacturers,
        ]);
    }

    public function publicDownload(SafetyDataSheet $sd)
    {
        $media = $sd->getFirstMedia('sds_file');
        abort_unless($media, 404);

        return $this->serveInline($media);
    }

    public function publicDownloadOtherFile(SafetyDataSheet $sd, int $mediaId)
    {
        $media = $sd->media()->where('id', $mediaId)->where('collection_name', 'other_files')->first();
        abort_unless($media, 404);

        return $this->serveInline($media);
    }

    private function serveInline(\Spatie\MediaLibrary\MediaCollections\Models\Media $media)
    {
        $filename = $media->file_name;

        if (app()->environment('production')) {
            return redirect($media->getTemporaryUrl(now()->addMinutes(30), '', [
                'ResponseContentDisposition' => 'inline; filename="' . addslashes($filename) . '"',
                'ResponseContentType' => $media->mime_type,
            ]));
        }

        return response()->file($media->getPath(), [
            'Content-Type' => $media->mime_type,
            'Content-Disposition' => 'inline; filename="' . addslashes($filename) . '"',
        ]);
    }
}
