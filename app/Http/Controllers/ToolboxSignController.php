<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Kiosk;
use App\Models\ToolboxTalk;
use App\Models\ToolboxTalkAttendee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ToolboxSignController extends Controller
{
    public function show(string $token)
    {
        $talk = $this->loadTalk($token);

        return Inertia::render('toolbox-sign-in/index', [
            'mode' => 'mobile',
            'talk' => $this->talkPayload($talk),
            'roster' => $this->rosterFor($talk),
        ]);
    }

    public function ipad(string $token)
    {
        $talk = $this->loadTalk($token);

        return Inertia::render('toolbox-sign-in/index', [
            'mode' => 'ipad',
            'talk' => $this->talkPayload($talk),
            'roster' => $this->rosterFor($talk),
        ]);
    }

    public function verifyPin(Request $request, string $token)
    {
        $data = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'pin' => 'required|string|max:8',
        ]);

        $talk = $this->loadTalk($token);
        $this->guardLocked($talk);

        $employee = Employee::findOrFail($data['employee_id']);
        $this->guardOnRoster($talk, $employee);

        $kiosk = $talk->location ? Kiosk::where('eh_location_id', $talk->location->eh_location_id)->first() : null;

        if (! $this->checkPin($kiosk, $employee, $data['pin'])) {
            return response()->json(['ok' => false, 'message' => 'Incorrect PIN.'], 422);
        }

        return response()->json(['ok' => true]);
    }

    public function submit(Request $request, string $token)
    {
        $data = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'pin' => 'required|string|max:8',
            'signature' => ['required', 'string', 'regex:/^data:image\/png;base64,/'],
            'source' => 'nullable|in:qr,ipad',
        ]);

        $talk = $this->loadTalk($token);
        $this->guardLocked($talk);

        $employee = Employee::findOrFail($data['employee_id']);
        $this->guardOnRoster($talk, $employee);

        $kiosk = $talk->location ? Kiosk::where('eh_location_id', $talk->location->eh_location_id)->first() : null;

        if (! $this->checkPin($kiosk, $employee, $data['pin'])) {
            return response()->json(['ok' => false, 'message' => 'Incorrect PIN.'], 422);
        }

        $existing = ToolboxTalkAttendee::where('toolbox_talk_id', $talk->id)
            ->where('employee_id', $employee->id)
            ->first();

        if ($existing && $existing->signed_at) {
            return response()->json(['ok' => false, 'message' => 'You have already signed this toolbox talk.'], 409);
        }

        $signaturePath = $this->storeSignature($talk, $employee, $data['signature']);

        DB::transaction(function () use ($talk, $employee, $signaturePath, $data) {
            ToolboxTalkAttendee::updateOrCreate(
                [
                    'toolbox_talk_id' => $talk->id,
                    'employee_id' => $employee->id,
                ],
                [
                    'signed' => true,
                    'signed_at' => now(),
                    'acknowledged_at' => now(),
                    'signature_path' => $signaturePath,
                    'source' => $data['source'] ?? 'qr',
                ],
            );
        });

        return response()->json([
            'ok' => true,
            'employee_name' => $employee->preferred_name ?? $employee->name,
            'signed_at' => now()->toIso8601String(),
        ]);
    }

    private function loadTalk(string $token): ToolboxTalk
    {
        return ToolboxTalk::with(['location', 'calledBy'])
            ->where('public_token', $token)
            ->firstOrFail();
    }

    private function guardLocked(ToolboxTalk $talk): void
    {
        abort_if($talk->is_locked, 423, 'This toolbox talk is locked.');
    }

    private function guardOnRoster(ToolboxTalk $talk, Employee $employee): void
    {
        $kiosk = $talk->location ? Kiosk::where('eh_location_id', $talk->location->eh_location_id)->first() : null;
        if (! $kiosk) {
            abort(404, 'Roster unavailable for this talk.');
        }

        $exists = $kiosk->employees()->where('employees.id', $employee->id)->exists();
        abort_unless($exists, 403, 'Employee is not on the roster for this talk.');
    }

    private function rosterFor(ToolboxTalk $talk): array
    {
        $location = $talk->location;
        if (! $location) {
            return [];
        }

        $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
        if (! $kiosk) {
            return [];
        }

        $signed = ToolboxTalkAttendee::where('toolbox_talk_id', $talk->id)
            ->whereNotNull('signed_at')
            ->pluck('signed_at', 'employee_id');

        return $kiosk->employees()
            ->orderBy('name')
            ->get(['employees.id', 'name', 'preferred_name'])
            ->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->preferred_name ?? $e->name,
                'full_name' => $e->name,
                'signed_at' => optional($signed->get($e->id))->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    private function talkPayload(ToolboxTalk $talk): array
    {
        return [
            'id' => $talk->id,
            'token' => $talk->public_token,
            'meeting_date' => $talk->meeting_date,
            'meeting_date_formatted' => $talk->meeting_date_formatted,
            'meeting_subject' => $talk->meeting_subject,
            'subject_label' => ToolboxTalk::SUBJECT_OPTIONS[$talk->meeting_subject] ?? $talk->meeting_subject,
            'location' => $talk->location ? ['id' => $talk->location->id, 'name' => $talk->location->name] : null,
            'called_by' => $talk->calledBy ? ['id' => $talk->calledBy->id, 'name' => $talk->calledBy->name] : null,
            'general_items' => ToolboxTalk::GENERAL_ITEMS,
            'key_topics' => $talk->key_topics ?? [],
            'action_points' => $talk->action_points ?? [],
            'injuries' => $talk->injuries ?? [],
            'near_misses' => $talk->near_misses ?? [],
            'floor_comments' => $talk->floor_comments ?? [],
            'is_locked' => $talk->is_locked,
        ];
    }

    private function storeSignature(ToolboxTalk $talk, Employee $employee, string $dataUrl): string
    {
        $base64 = preg_replace('/^data:image\/png;base64,/', '', $dataUrl);
        $binary = base64_decode($base64, true);
        abort_if($binary === false, 422, 'Invalid signature data.');

        $filename = sprintf('toolbox-signatures/%s/%d-%s.png', $talk->id, $employee->id, Str::random(8));
        Storage::disk('public')->put($filename, $binary);

        return $filename;
    }

    private function checkPin(?Kiosk $kiosk, Employee $employee, string $pin): bool
    {
        if (env('APP_ENV') === 'local') {
            return $employee->pin === $pin;
        }

        if (! $kiosk) {
            return false;
        }

        $apiKey = config('services.employment_hero.api_key');
        $kioskExternalId = $kiosk->eh_kiosk_id;
        $employeeExternalId = $employee->eh_employee_id;

        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Content-Type' => 'Application/Json',
        ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/kiosk/{$kioskExternalId}/checkpin", [
            'employeeId' => (int) $employeeExternalId,
            'pin' => (string) $pin,
        ]);

        if (! $response->successful()) {
            Log::warning('Toolbox sign-in PIN check failed', [
                'status' => $response->status(),
                'kiosk' => $kioskExternalId,
                'employee' => $employeeExternalId,
            ]);

            return false;
        }

        return true;
    }
}
