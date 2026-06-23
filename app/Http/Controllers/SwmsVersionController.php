<?php

namespace App\Http\Controllers;

use App\Enums\SwmsVersionStatus;
use App\Models\Employee;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\Swms;
use App\Models\SwmsVersion;
use App\Models\SwmsVersionSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class SwmsVersionController extends Controller
{
    public function store(Request $request, Location $location, Swms $swms)
    {
        $this->ensureScope($location, $swms);

        $data = $request->validate([
            'version_number' => 'nullable|string|max:50',
            'change_summary' => 'nullable|string|max:2000',
            'requires_resignature' => 'nullable|boolean',
            'approved_at' => 'nullable|date',
            'document' => 'required|file|mimes:pdf|max:25600',
        ]);

        $versionNumber = $this->resolveVersionNumber($swms, $data['version_number'] ?? null);

        $version = $swms->versions()->create([
            'version_number' => $versionNumber,
            'status' => SwmsVersionStatus::Draft,
            'requires_resignature' => $data['requires_resignature'] ?? true,
            'change_summary' => $data['change_summary'] ?? null,
            'approved_at' => $data['approved_at'] ?? null,
        ]);

        $version->addMediaFromRequest('document')
            ->toMediaCollection('document');

        $version->makeActive();

        return redirect()->route('locations.swms.versions.show', [$location->id, $swms->id, $version->id])
            ->with('success', "Version {$version->version_number} uploaded and activated.");
    }

    public function show(Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        $version->load([
            'createdBy:id,name',
            'updatedBy:id,name',
            'previousVersion:id,version_number,status',
            'signatures.employee:id,name,preferred_name',
            'signatures.carriedFromVersion:id,version_number',
        ]);

        $kioskEmployees = collect();
        $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
        if ($kiosk) {
            $kioskEmployees = $kiosk->employees()
                ->orderBy('name')
                ->get(['employees.id', 'name', 'preferred_name']);
        }

        $signedMap = $version->signatures->keyBy('employee_id');

        $signed = $version->signatures->map(function ($sig) use ($location, $swms, $version) {
            return [
                'id' => $sig->id,
                'employee' => [
                    'id' => $sig->employee?->id,
                    'name' => $sig->employee?->display_name ?? $sig->employee?->name,
                ],
                'signed_at' => $sig->signed_at?->toIso8601String(),
                'original_signed_at' => $sig->original_signed_at?->toIso8601String(),
                'carried_from_version' => $sig->carriedFromVersion ? [
                    'id' => $sig->carriedFromVersion->id,
                    'version_number' => $sig->carriedFromVersion->version_number,
                    'url' => route('locations.swms.versions.show', [
                        $location->id,
                        $swms->id,
                        $sig->carriedFromVersion->id,
                    ]),
                ] : null,
                'signature_url' => $sig->signature_url,
                'signature_download_url' => $sig->getFirstMedia('signature')
                    ? route('locations.swms.versions.signatures.download', [
                        $location->id,
                        $swms->id,
                        $version->id,
                        $sig->id,
                    ])
                    : null,
            ];
        })->filter(fn ($s) => $s['employee']['id'] !== null)->values();

        $unsigned = $kioskEmployees
            ->filter(fn ($emp) => ! $signedMap->has($emp->id))
            ->map(fn ($emp) => [
                'id' => $emp->id,
                'name' => $emp->display_name ?? $emp->name,
            ])->values();

        return Inertia::render('swms/version-show', [
            'location' => ['id' => $location->id, 'name' => $location->name],
            'swms' => [
                'id' => $swms->id,
                'name' => $swms->name,
                'description' => $swms->description,
            ],
            'version' => [
                'id' => $version->id,
                'version_number' => $version->version_number,
                'status' => $version->status?->value,
                'status_label' => $version->status?->label(),
                'requires_resignature' => $version->requires_resignature,
                'change_summary' => $version->change_summary,
                'approved_at' => $version->approved_at?->toIso8601String(),
                'created_at' => $version->created_at->toIso8601String(),
                'updated_at' => $version->updated_at->toIso8601String(),
                'created_by' => $version->createdBy ? ['id' => $version->createdBy->id, 'name' => $version->createdBy->name] : null,
                'updated_by' => $version->updatedBy ? ['id' => $version->updatedBy->id, 'name' => $version->updatedBy->name] : null,
                'document_url' => $version->document_url,
                'document_filename' => $version->document_filename,
                'previous_version' => $version->previousVersion ? [
                    'id' => $version->previousVersion->id,
                    'version_number' => $version->previousVersion->version_number,
                ] : null,
            ],
            'signed' => $signed,
            'unsigned' => $unsigned,
        ]);
    }

    public function update(Request $request, Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        $data = $request->validate([
            'version_number' => 'required|string|max:50',
            'requires_resignature' => 'required|boolean',
            'change_summary' => 'nullable|string|max:2000',
            'approved_at' => 'nullable|date',
        ]);

        $clean = trim($data['version_number']);
        $duplicate = $swms->versions()
            ->where('version_number', $clean)
            ->where('id', '!=', $version->id)
            ->exists();
        abort_if($duplicate, 422, "Version number {$clean} already exists for this SWMS.");

        $wasRequiringResignature = $version->requires_resignature;

        $version->update([
            'version_number' => $clean,
            'requires_resignature' => $data['requires_resignature'],
            'change_summary' => $data['change_summary'] ?? null,
            'approved_at' => $data['approved_at'] ?? null,
        ]);

        // If the user just flipped "requires re-signature" from true → false,
        // retroactively carry signatures forward from the prior version.
        if ($wasRequiringResignature && ! $data['requires_resignature'] && $version->supersedes_id) {
            $prior = SwmsVersion::find($version->supersedes_id);
            if ($prior) {
                $version->carrySignaturesFrom($prior);
            }
        }

        return redirect()->back()->with('success', 'Version updated.');
    }

    public function archive(Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        $version->status = SwmsVersionStatus::Archived;
        $version->save();

        return redirect()->back()->with('success', 'Version archived.');
    }

    public function destroy(Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        abort_unless($version->status === SwmsVersionStatus::Draft, 422, 'Only draft versions can be deleted.');

        $version->delete();

        return redirect()->route('locations.swms.show', [$location->id, $swms->id])
            ->with('success', 'Draft version deleted.');
    }

    public function downloadDocument(Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        $media = $version->getFirstMedia('document');
        abort_unless($media, 404);

        if ($media->disk === 's3') {
            $url = $media->getTemporaryUrl(now()->addMinutes(10));

            return redirect()->away($url);
        }

        return response()->file($media->getPath(), [
            'Content-Type' => $media->mime_type,
            'Content-Disposition' => 'inline; filename="' . $media->file_name . '"',
        ]);
    }

    public function downloadSignSheet(Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        $version->load(['signatures.employee', 'signatures.carriedFromVersion']);

        $html = view('pdf.swms-signed-workers', [
            'version' => $version,
            'swms' => $swms,
            'location' => $location,
            'signatures' => $version->signatures->sortByDesc('signed_at')->values(),
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
            ->format('A4')
            ->margins(15, 19, 20, 19, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml('<div></div>')
            ->footerHtml('<div style="width:100%;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding:6px 0;"><span class="pageNumber"></span> of <span class="totalPages"></span></div>')
            ->pdf();

        $slug = Str::slug($swms->name);
        $filename = "swms-{$slug}-{$version->version_number}-signed.pdf";

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function sign(Request $request, Location $location, Swms $swms, SwmsVersion $version)
    {
        $this->ensureScope($location, $swms, $version);

        abort_if(
            $version->status === SwmsVersionStatus::Archived,
            422,
            'Cannot sign an archived version.'
        );

        $data = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'signature' => 'required|string',
        ]);

        $base64 = preg_replace('/^data:image\/png;base64,/', '', $data['signature']);
        $binary = base64_decode($base64, true);
        abort_if($binary === false, 422, 'Invalid signature data.');

        $employee = Employee::findOrFail($data['employee_id']);

        $signature = $version->signatures()->firstOrNew([
            'employee_id' => $employee->id,
        ]);

        $signature->signed_at = now();
        if (! $signature->original_signed_at) {
            $signature->original_signed_at = now();
        }
        $signature->carried_from_version_id = null;
        $signature->save();

        $signature->clearMediaCollection('signature');

        $signature->addMediaFromString($binary)
            ->usingFileName(sprintf('%s-%s.png', $employee->id, Str::random(8)))
            ->toMediaCollection('signature');

        return redirect()->back()->with('success', 'Signed.');
    }

    public function downloadSignature(Location $location, Swms $swms, SwmsVersion $version, SwmsVersionSignature $signature)
    {
        $this->ensureScope($location, $swms, $version);
        abort_unless($signature->swms_version_id === $version->id, 404);

        $media = $signature->getFirstMedia('signature');
        abort_unless($media, 404);

        $employeeName = Str::slug($signature->employee?->name ?? 'unknown');
        $filename = "swms-{$version->version_number}-{$employeeName}.png";

        if ($media->disk === 's3') {
            $url = $media->getTemporaryUrl(
                now()->addMinutes(10),
                '',
                ['ResponseContentDisposition' => 'attachment; filename="' . $filename . '"']
            );

            return redirect()->away($url);
        }

        return response()->download($media->getPath(), $filename, [
            'Content-Type' => $media->mime_type,
        ]);
    }

    private function ensureScope(Location $location, Swms $swms, ?SwmsVersion $version = null): void
    {
        abort_unless($swms->location_id === $location->id, 404);

        if ($version !== null) {
            abort_unless($version->swms_id === $swms->id, 404);
        }
    }

    private function resolveVersionNumber(Swms $swms, ?string $provided): string
    {
        if ($provided && trim($provided) !== '') {
            $clean = trim($provided);
            $exists = $swms->versions()->where('version_number', $clean)->exists();
            abort_if($exists, 422, "Version number {$clean} already exists for this SWMS.");

            return $clean;
        }

        // Auto: increment from the highest integer-castable version, or start at 1
        $existing = $swms->versions()->pluck('version_number')->all();
        $maxInt = 0;
        foreach ($existing as $v) {
            if (is_numeric($v) && (int) $v > $maxInt) {
                $maxInt = (int) $v;
            }
        }

        return (string) ($maxInt + 1);
    }
}
