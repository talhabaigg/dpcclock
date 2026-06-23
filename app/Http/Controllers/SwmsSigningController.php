<?php

namespace App\Http\Controllers;

use App\Enums\SwmsVersionStatus;
use App\Models\Employee;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\Swms;
use App\Models\SwmsSigningRequest;
use App\Models\SwmsVersion;
use App\Services\ClickSendSmsService;
use App\Services\GetCompanyCodeService;
use App\Services\KioskPinService;
use App\Services\ShortLinkService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class SwmsSigningController extends Controller
{
    public function __construct(
        private KioskPinService $pinService,
        private ClickSendSmsService $smsService,
        private ShortLinkService $shortLinks,
    ) {}

    /**
     * Supervisor-side: create a signing request from the bulk action on the SWMS index.
     */
    public function store(Request $request, Location $location)
    {
        $data = $request->validate([
            'swms_ids' => 'required|array|min:1',
            'swms_ids.*' => 'string|exists:swms,id',
            'employee_ids' => 'required|array|min:1',
            'employee_ids.*' => 'integer|exists:employees,id',
            'delivery_method' => 'required|in:ipad,qr,sms',
            'recipient_phone' => 'required_if:delivery_method,sms|nullable|string|max:32',
        ]);

        // For each selected SWMS, target its current active version. SWMS without an
        // active version are silently skipped (workers can't sign nothing).
        $versions = SwmsVersion::query()
            ->whereIn('swms_id', $data['swms_ids'])
            ->where('status', SwmsVersionStatus::Active->value)
            ->whereHas('swms', fn ($q) => $q->where('location_id', $location->id))
            ->get();

        abort_if($versions->isEmpty(), 422, 'None of the selected SWMS have an active version to sign.');

        $signingRequest = DB::transaction(function () use ($location, $data, $versions) {
            $req = SwmsSigningRequest::create([
                'location_id' => $location->id,
                'delivery_method' => $data['delivery_method'],
                'recipient_phone' => $data['recipient_phone'] ?? null,
            ]);

            $req->versions()->sync($versions->pluck('id')->all());
            $req->employees()->sync($data['employee_ids']);

            return $req;
        });

        $publicUrl = $signingRequest->publicUrl();
        $shortUrl = null;

        if ($data['delivery_method'] === SwmsSigningRequest::DELIVERY_SMS) {
            $shortUrl = $this->shortLinks->create($publicUrl, 60 * 24 * 7);
            $expiry = $signingRequest->expires_at?->format('d/m/Y') ?? '';
            $body = "SWMS signing requested for {$location->name}. Sign here: {$shortUrl}"
                . ($expiry ? " (expires {$expiry})" : '');
            $this->smsService->send($data['recipient_phone'], $body);
        }

        return response()->json([
            'id' => $signingRequest->id,
            'token' => $signingRequest->token,
            'public_url' => $publicUrl,
            'short_url' => $shortUrl,
            'delivery_method' => $signingRequest->delivery_method,
            'expires_at' => $signingRequest->expires_at?->toIso8601String(),
        ]);
    }

    /**
     * Public sign page (no auth — token guards access).
     */
    public function show(string $token)
    {
        $signingRequest = SwmsSigningRequest::where('token', $token)
            ->with([
                'location:id,name,eh_location_id,eh_parent_id',
                'versions.swms:id,name',
                'employees',
            ])
            ->firstOrFail();

        if ($signingRequest->status === SwmsSigningRequest::STATUS_PENDING) {
            $signingRequest->update(['status' => SwmsSigningRequest::STATUS_OPENED]);
        }

        $expired = $signingRequest->isExpired();

        $companyCode = app(GetCompanyCodeService::class)
            ->getCompanyCode($signingRequest->location->eh_parent_id);
        $logoFile = in_array($companyCode, ['GREEN', 'GRE'], true) ? 'gre_logo.jpg' : 'logo.png';
        $logoUrl = asset($logoFile);

        // Filter out employees who've already signed in this request
        $employees = $signingRequest->employees->map(fn ($e) => [
            'id' => $e->id,
            'name' => $e->display_name ?? $e->name,
            'signed' => $e->pivot->signed_at !== null,
        ])->values();

        $versions = $signingRequest->versions->map(fn ($v) => [
            'id' => $v->id,
            'version_number' => $v->version_number,
            'swms_name' => $v->swms->name,
            'document_url' => route('swms-sign.document', ['token' => $token, 'version' => $v->id]),
        ])->values();

        return Inertia::render('swms-sign/show', [
            'token' => $token,
            'location' => [
                'id' => $signingRequest->location->id,
                'name' => $signingRequest->location->name,
            ],
            'employees' => $employees,
            'versions' => $versions,
            'expired' => $expired,
            'completed' => $signingRequest->isComplete(),
            'logoUrl' => $logoUrl,
        ]);
    }

    /**
     * Public — proxies the document download through the signing request scope
     * so workers don't need separate auth.
     */
    public function downloadDocument(string $token, SwmsVersion $version)
    {
        $signingRequest = SwmsSigningRequest::where('token', $token)->firstOrFail();
        abort_if($signingRequest->isExpired(), 410, 'This signing request has expired.');
        abort_unless(
            $signingRequest->versions()->where('swms_versions.id', $version->id)->exists(),
            404
        );

        $media = $version->getFirstMedia('document');
        abort_unless($media, 404);

        if ($media->disk === 's3') {
            return redirect()->away($media->getTemporaryUrl(now()->addMinutes(10)));
        }

        return response()->file($media->getPath(), [
            'Content-Type' => $media->mime_type,
            'Content-Disposition' => 'inline; filename="' . $media->file_name . '"',
        ]);
    }

    /**
     * Public — verify a worker's PIN against the kiosk for the request's location.
     */
    public function verifyPin(Request $request, string $token)
    {
        $data = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'pin' => 'required|string',
        ]);

        $signingRequest = SwmsSigningRequest::where('token', $token)->firstOrFail();
        abort_if($signingRequest->isExpired(), 410, 'This signing request has expired.');

        $employee = $signingRequest->employees()->where('employees.id', $data['employee_id'])->first();
        abort_unless($employee, 404, 'Worker is not on this signing request.');
        abort_if($employee->pivot->signed_at !== null, 422, 'This worker has already signed.');

        $kiosk = Kiosk::where('eh_location_id', $signingRequest->location->eh_location_id)->first();
        $ok = $this->pinService->verify($kiosk, $employee, $data['pin']);

        if (! $ok) {
            return response()->json(['ok' => false], 422);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Public — accept a signature, create SwmsVersionSignature for each version in
     * this request, mark the worker as signed, and complete the request if everyone's done.
     */
    public function sign(Request $request, string $token)
    {
        $data = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'pin' => 'required|string',
            'signature' => 'required|string',
        ]);

        $signingRequest = SwmsSigningRequest::where('token', $token)
            ->with('versions')
            ->firstOrFail();
        abort_if($signingRequest->isExpired(), 410, 'This signing request has expired.');

        $employee = $signingRequest->employees()->where('employees.id', $data['employee_id'])->first();
        abort_unless($employee, 404, 'Worker is not on this signing request.');
        abort_if($employee->pivot->signed_at !== null, 422, 'This worker has already signed.');

        // Re-verify the PIN at submit time so the signature is authoritative
        $kiosk = Kiosk::where('eh_location_id', $signingRequest->location->eh_location_id)->first();
        abort_unless(
            $this->pinService->verify($kiosk, $employee, $data['pin']),
            422,
            'Invalid PIN.'
        );

        $base64 = preg_replace('/^data:image\/png;base64,/', '', $data['signature']);
        $binary = base64_decode($base64, true);
        abort_if($binary === false, 422, 'Invalid signature data.');

        DB::transaction(function () use ($signingRequest, $employee, $binary) {
            foreach ($signingRequest->versions as $version) {
                $existing = $version->signatures()->where('employee_id', $employee->id)->first();
                if ($existing) {
                    // Already signed this version directly — leave it untouched
                    continue;
                }

                $sig = $version->signatures()->create([
                    'employee_id' => $employee->id,
                    'signed_at' => now(),
                    'original_signed_at' => now(),
                ]);

                $sig->addMediaFromString($binary)
                    ->usingFileName(sprintf('%s-%s.png', $employee->id, Str::random(8)))
                    ->toMediaCollection('signature');
            }

            $signingRequest->employees()->updateExistingPivot($employee->id, [
                'signed_at' => now(),
            ]);
        });

        $signingRequest->refresh()->recomputeCompletion();

        return response()->json(['ok' => true]);
    }
}
