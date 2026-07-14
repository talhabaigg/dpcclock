<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\PpeIssuance;
use App\Models\User;
use App\Services\KioskPinService;
use App\Services\KioskService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PpeFormController extends Controller
{
    /**
     * Public PPE cabinet QR landing page.
     * Reachable from a static wall-mounted QR — must not expose clock in/out.
     */
    public function publicShow(string $token)
    {
        $location = $this->loadLocationByToken($token);

        return Inertia::render('ppe-sign-in/index', [
            'mode' => 'qr',
            'location' => $this->locationPayload($location),
            'roster' => $this->rosterFor($location),
            'managers' => $this->managersFor($location),
            'options' => $this->options(),
            'endpoints' => [
                'verifyPin' => "/ppe/{$token}/verify-pin",
                'submit' => "/ppe/{$token}/submit",
            ],
        ]);
    }

    /**
     * Kiosk PPE entry page — device-cookie gated and reused inside the iPad shell.
     */
    public function kioskShow(string $kioskId)
    {
        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        $location = $kiosk->location;
        abort_unless($location, 404, 'Kiosk has no associated location.');

        return Inertia::render('kiosks/clocking/ppe', [
            'kiosk' => [
                'id' => $kiosk->id,
                'eh_kiosk_id' => $kiosk->eh_kiosk_id,
                'name' => $kiosk->name,
            ],
            'location' => $this->locationPayload($location),
            'roster' => $this->rosterFor($location),
            'managers' => $this->managersFor($location),
            'options' => $this->options(),
            'endpoints' => [
                'verifyPin' => "/kiosks/{$kioskId}/ppe/verify-pin",
                'submit' => "/kiosks/{$kioskId}/ppe/submit",
                'back' => "/kiosks/{$kiosk->id}",
            ],
        ]);
    }

    /**
     * Authed kiosk PPE form — entered from the "Additional actions" panel after
     * an employee has just completed a kiosk PIN check. No second PIN required;
     * the session-bound recent-auth window proves identity.
     */
    public function kioskAuthedShow(string $kioskId, int $employeeId)
    {
        $kiosk = Kiosk::with('relatedKiosks', 'managers')->where('eh_kiosk_id', $kioskId)->firstOrFail();
        $location = $kiosk->location;
        abort_unless($location, 404, 'Kiosk has no associated location.');

        $employee = $this->guardRecentAuth($kiosk, $employeeId);

        $kioskService = app(KioskService::class);
        $layoutProps = $kioskService->getKioskLayoutProps($kiosk);
        $adminMode = $kioskService->isAdminModeActive();

        return Inertia::render('kiosks/clocking/ppe-authed', [
            'kiosk' => $kiosk,
            'adminMode' => $adminMode,
            'location' => $this->locationPayload($location),
            'employee' => [
                'id' => $employee->id,
                'eh_employee_id' => $employee->eh_employee_id,
                'name' => $employee->preferred_name ?? $employee->name,
            ],
            'managers' => $this->managersFor($location),
            'options' => $this->options(),
            'endpoints' => [
                'submit' => "/kiosks/{$kioskId}/ppe/authed/{$employee->id}/submit",
                'back' => "/kiosks/{$kiosk->id}",
            ],
            ...$layoutProps,
        ]);
    }

    public function kioskAuthedSubmit(Request $request, string $kioskId, int $employeeId)
    {
        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        $location = $kiosk->location;
        abort_unless($location, 404, 'Kiosk has no associated location.');

        $employee = $this->guardRecentAuth($kiosk, $employeeId);

        return $this->submit($request, $location, PpeIssuance::SOURCE_KIOSK, $employee);
    }

    private function guardRecentAuth(Kiosk $kiosk, int $employeeId): Employee
    {
        $auth = app(KioskService::class)->getRecentAuth($kiosk);
        abort_if(! $auth, 403, 'Your session has timed out — tap your name and enter your PIN again.');
        abort_unless((int) $auth['employee_id'] === $employeeId, 403, 'That action is not available for the current session.');

        return Employee::findOrFail($employeeId);
    }

    public function publicVerifyPin(Request $request, string $token)
    {
        $location = $this->loadLocationByToken($token);

        return $this->verifyPin($request, $location);
    }

    public function kioskVerifyPin(Request $request, string $kioskId)
    {
        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        abort_unless($kiosk->location, 404);

        return $this->verifyPin($request, $kiosk->location);
    }

    public function publicSubmit(Request $request, string $token)
    {
        $location = $this->loadLocationByToken($token);

        return $this->submit($request, $location, PpeIssuance::SOURCE_QR);
    }

    public function kioskSubmit(Request $request, string $kioskId)
    {
        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        abort_unless($kiosk->location, 404);

        return $this->submit($request, $kiosk->location, PpeIssuance::SOURCE_KIOSK);
    }

    private function verifyPin(Request $request, Location $location)
    {
        $data = $request->validate([
            'employee_id' => 'required|integer|exists:employees,id',
            'pin' => 'required|string|max:8',
        ]);

        $employee = Employee::findOrFail($data['employee_id']);
        $kiosk = $this->kioskFor($location);
        $this->guardOnRoster($kiosk, $employee);

        if (! app(KioskPinService::class)->verify($kiosk, $employee, $data['pin'])) {
            return response()->json(['ok' => false, 'message' => 'Incorrect PIN.'], 422);
        }

        return response()->json(['ok' => true]);
    }

    private function submit(Request $request, Location $location, string $source, ?Employee $preAuthedEmployee = null)
    {
        $itemKeys = collect(PpeIssuance::PPE_CATALOG)->pluck('key')->all();

        $rules = [
            'issued_items' => 'required|array|min:1',
            'issued_items.*.key' => ['required', 'string', 'in:'.implode(',', $itemKeys)],
            'issued_items.*.qty' => 'required|integer|min:1|max:50',
            'issued_items.*.reason' => ['required', 'string', 'in:'.implode(',', array_keys(PpeIssuance::REASON_OPTIONS))],
            'issued_items.*.size' => 'nullable|string|max:8',
            'issued_items.*.make_model' => 'nullable|string|max:255',
            'fit_test_completed' => 'nullable|boolean',
            'authorised_by_user_id' => 'required|integer|exists:users,id',
            'ppe_returned' => ['required', 'string', 'in:'.implode(',', array_keys(PpeIssuance::RETURNED_OPTIONS))],
        ];

        if (! $preAuthedEmployee) {
            $rules['employee_id'] = 'required|integer|exists:employees,id';
            $rules['pin'] = 'required|string|max:8';
        }

        $data = $request->validate($rules);

        $employee = $preAuthedEmployee ?? Employee::findOrFail($data['employee_id']);
        $kiosk = $this->kioskFor($location);
        $this->guardOnRoster($kiosk, $employee);

        if (! $preAuthedEmployee) {
            if (! app(KioskPinService::class)->verify($kiosk, $employee, $data['pin'])) {
                return response()->json(['ok' => false, 'message' => 'Incorrect PIN.'], 422);
            }
        }

        $this->guardAuthorisedBy($location, (int) $data['authorised_by_user_id']);

        $issuedItems = $this->normaliseItems($data['issued_items']);
        $summaryReason = PpeIssuance::summariseItemReasons($issuedItems);

        $issuance = DB::transaction(function () use ($data, $issuedItems, $summaryReason, $location, $employee, $source) {
            return PpeIssuance::create([
                'location_id' => $location->id,
                'employee_id' => $employee->id,
                'reason' => $summaryReason,
                'issued_items' => $issuedItems,
                'fit_test_completed' => $data['fit_test_completed'] ?? null,
                'authorised_by_user_id' => $data['authorised_by_user_id'],
                'ppe_returned' => $data['ppe_returned'],
                'source' => $source,
                'submitted_at' => now(),
            ]);
        });

        return response()->json([
            'ok' => true,
            'id' => $issuance->id,
            'employee_name' => $employee->preferred_name ?? $employee->name,
            'submitted_at' => $issuance->submitted_at->toIso8601String(),
        ]);
    }

    private function loadLocationByToken(string $token): Location
    {
        return Location::where('ppe_public_token', $token)->firstOrFail();
    }

    private function kioskFor(Location $location): ?Kiosk
    {
        return Kiosk::where('eh_location_id', $location->eh_location_id)->first();
    }

    private function guardOnRoster(?Kiosk $kiosk, Employee $employee): void
    {
        abort_if(! $kiosk, 404, 'Roster unavailable for this location.');
        abort_unless(
            $kiosk->employees()->where('employees.id', $employee->id)->exists(),
            403,
            'Employee is not on the roster for this location.',
        );
    }

    private function guardAuthorisedBy(Location $location, int $userId): void
    {
        $kiosk = $this->kioskFor($location);
        if (! $kiosk) {
            return;
        }

        abort_unless(
            $kiosk->managers()->where('users.id', $userId)->exists(),
            422,
            'Selected supervisor is not authorised for this location.',
        );
    }

    private function rosterFor(Location $location): array
    {
        $kiosk = $this->kioskFor($location);
        if (! $kiosk) {
            return [];
        }

        return $kiosk->employees()
            ->orderBy('name')
            ->get(['employees.id', 'name', 'preferred_name'])
            ->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->preferred_name ?? $e->name,
                'full_name' => $e->name,
            ])
            ->values()
            ->all();
    }

    private function managersFor(Location $location): array
    {
        $kiosk = $this->kioskFor($location);
        if (! $kiosk) {
            return [];
        }

        return $kiosk->managers()
            ->orderBy('users.name')
            ->get(['users.id', 'users.name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])
            ->values()
            ->all();
    }

    private function locationPayload(Location $location): array
    {
        return [
            'id' => $location->id,
            'name' => $location->name,
            'external_id' => $location->external_id,
        ];
    }

    private function options(): array
    {
        return [
            'reasons' => PpeIssuance::REASON_OPTIONS,
            'returned' => PpeIssuance::RETURNED_OPTIONS,
            'catalog' => PpeIssuance::PPE_CATALOG,
        ];
    }

    /**
     * Strip blank size/make_model entries and cast qty to int.
     */
    private function normaliseItems(array $items): array
    {
        return array_values(array_map(function ($item) {
            return array_filter([
                'key' => $item['key'],
                'qty' => (int) $item['qty'],
                'reason' => $item['reason'],
                'size' => ! empty($item['size']) ? $item['size'] : null,
                'make_model' => ! empty($item['make_model']) ? $item['make_model'] : null,
            ], fn ($v) => $v !== null);
        }, $items));
    }
}
