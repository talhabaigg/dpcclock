<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeFile;
use App\Models\EmployeeTransfer;
use App\Models\Injury;
use App\Models\Kiosk;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class EmployeeTransferController extends Controller
{
    public function index(Request $request): Response
    {
        $query = EmployeeTransfer::with(['currentKiosk', 'proposedKiosk', 'currentForeman', 'receivingForeman', 'initiator']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('employee_name', 'like', "%{$search}%");
            });
        }

        if ($request->filled('kiosk_id')) {
            $kioskId = $request->kiosk_id;
            $query->where(function ($q) use ($kioskId) {
                $q->where('current_kiosk_id', $kioskId)
                  ->orWhere('proposed_kiosk_id', $kioskId);
            });
        }

        $transfers = $query->latest()->paginate(25)->withQueryString();

        return Inertia::render('employee-transfers/index', [
            'transfers' => $transfers,
            'filters' => $request->only(['status', 'search', 'kiosk_id']),
            'kiosks' => Kiosk::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function create(Request $request): Response
    {
        $kiosks = Kiosk::where('is_active', true)->orderBy('name')->get(['id', 'name']);

        return Inertia::render('employee-transfers/create', [
            'kiosks' => $kiosks,
            'authUser' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
            ],
        ]);
    }

    /**
     * API: get employees for a given kiosk.
     */
    public function kioskEmployees(Kiosk $kiosk): \Illuminate\Http\JsonResponse
    {
        $employees = $kiosk->employees()
            ->select('employees.id', 'employees.name', 'employees.preferred_name', 'employees.employment_type')
            ->orderBy('name')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->display_name,
                'employment_type' => $e->employment_type,
            ]);

        return response()->json($employees);
    }

    /**
     * API: get injuries for a given employee.
     */
    public function employeeInjuries(Employee $employee): \Illuminate\Http\JsonResponse
    {
        $injuries = Injury::where('employee_id', $employee->id)
            ->with(['location'])
            ->latest('occurred_at')
            ->get()
            ->map(fn ($injury) => [
                'id' => $injury->id,
                'id_formal' => $injury->id_formal,
                'incident' => $injury->incident,
                'occurred_at' => $injury->occurred_at?->format('d/m/Y'),
                'location_name' => $injury->location?->name,
                'report_type' => $injury->report_type,
                'work_cover_claim' => $injury->work_cover_claim,
                'claim_active' => $injury->claim_active,
                'claim_status' => $injury->claim_status,
                'capacity' => $injury->capacity,
                'work_days_missed' => $injury->work_days_missed,
                'description' => $injury->description,
            ]);

        return response()->json($injuries);
    }

    /**
     * API: get managers for a given kiosk.
     */
    public function kioskManagers(Kiosk $kiosk): \Illuminate\Http\JsonResponse
    {
        $managers = $kiosk->managers()->select('users.id', 'users.name')->orderBy('name')->get();

        return response()->json($managers);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => 'required|exists:employees,id',
            'employee_name' => 'required|string',
            'employee_position' => 'nullable|string',
            'current_kiosk_id' => 'required|exists:kiosks,id',
            'current_foreman_id' => 'required|exists:users,id',
            'proposed_kiosk_id' => 'required|exists:kiosks,id',
            'receiving_foreman_id' => 'required|exists:users,id',
            'proposed_start_date' => 'required|date',

            // Part A
            'transfer_reason' => 'required|string',
            'transfer_reason_other' => 'nullable|string|required_if:transfer_reason,other',

            // Part B
            'overall_performance' => 'required|string',
            'work_ethic_honesty' => 'required|string',
            'quality_of_work' => 'required|string',
            'productivity_rating' => 'required|string',
            'performance_comments' => 'nullable|string',

            // Part C
            'punctuality' => 'required|string',
            'attendance' => 'required|string',
            'excessive_sick_leave' => 'required|boolean',
            'sick_leave_details' => 'nullable|string|required_if:excessive_sick_leave,true,1',

            // Part D (has_incidents is now derived from injury register)
            'safety_attitude' => 'required|string',
            'swms_compliance' => 'required|string',
            'ppe_compliance' => 'required|string',
            'prestart_toolbox_attendance' => 'required|string',

            // Part E
            'workplace_behaviour' => 'required|string',
            'attitude_towards_foreman' => 'required|string',
            'attitude_towards_coworkers' => 'required|string',
            'has_disciplinary_actions' => 'required|boolean',
            'disciplinary_details' => 'nullable|string|required_if:has_disciplinary_actions,true,1',
            'concerns' => 'nullable|array',
            'concerns_details' => 'nullable|string|required_with:concerns',

            'injury_review_notes' => 'nullable|string',
        ]);

        $validated['initiated_by'] = $request->user()->id;
        $validated['status'] = 'submitted';

        $transfer = EmployeeTransfer::create($validated);

        return redirect()->route('employee-transfers.show', $transfer)
            ->with('success', 'Transfer request submitted successfully.');
    }

    public function show(EmployeeTransfer $employeeTransfer, Request $request): Response
    {
        $employeeTransfer->load([
            'employee',
            'currentKiosk',
            'proposedKiosk',
            'currentForeman',
            'receivingForeman',
            'initiator',
            'safetyManager',
            'constructionManager',
        ]);

        // Pull injury data for Parts F/G from the system
        $injuries = Injury::where('employee_id', $employeeTransfer->employee_id)
            ->with(['location'])
            ->latest('occurred_at')
            ->get()
            ->map(fn ($injury) => [
                'id' => $injury->id,
                'id_formal' => $injury->id_formal,
                'incident' => $injury->incident,
                'occurred_at' => $injury->occurred_at?->format('d/m/Y'),
                'location_name' => $injury->location?->name,
                'report_type' => $injury->report_type,
                'work_cover_claim' => $injury->work_cover_claim,
                'claim_active' => $injury->claim_active,
                'claim_status' => $injury->claim_status,
                'capacity' => $injury->capacity,
                'work_days_missed' => $injury->work_days_missed,
                'description' => $injury->description,
            ]);

        // Pull employee files for compliance review
        $employeeFiles = EmployeeFile::where('employee_id', $employeeTransfer->employee_id)
            ->with(['fileType'])
            ->latest()
            ->get()
            ->map(fn ($file) => [
                'id' => $file->id,
                'type_name' => $file->fileType?->name,
                'category' => $file->fileType?->category,
                'document_number' => $file->document_number,
                'expires_at' => $file->expires_at?->format('d/m/Y'),
                'expires_at_raw' => $file->expires_at?->toDateString(),
                'completed_at' => $file->completed_at?->format('d/m/Y'),
                'status' => $file->getStatus(),
                'notes' => $file->notes,
            ]);

        $isAdmin = $request->user()->isAdmin();
        $isReceivingForeman = $isAdmin || $request->user()->id === $employeeTransfer->receiving_foreman_id;
        $isCurrentForeman = $isAdmin || $request->user()->id === $employeeTransfer->current_foreman_id;

        return Inertia::render('employee-transfers/show', [
            'transfer' => $employeeTransfer,
            'injuries' => $injuries,
            'employeeFiles' => $employeeFiles,
            'isReceivingForeman' => $isReceivingForeman,
            'isCurrentForeman' => $isCurrentForeman,
            'authUser' => [
                'id' => $request->user()->id,
                'name' => $request->user()->name,
            ],
        ]);
    }

    /**
     * Receiving foreman submits Part H + Part I.
     */
    public function submitReceivingReview(EmployeeTransfer $employeeTransfer, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            // Part H
            'position_applying_for' => 'required|string',
            'position_other' => 'nullable|string|required_if:position_applying_for,other',
            'suitable_for_tasks' => 'required|string',
            'primary_skillset' => 'required|string',
            'primary_skillset_other' => 'nullable|string',
            'has_required_tools' => 'required|boolean',
            'tools_tagged' => 'required|boolean',

            // Part I
            'would_have_worker_again' => 'required|string',
            'rehire_conditions' => 'nullable|string',
            'main_strengths' => 'nullable|string',
            'areas_for_improvement' => 'nullable|string',
        ]);

        $employeeTransfer->update(array_merge($validated, [
            'status' => 'final_review',
        ]));

        return redirect()->route('employee-transfers.show', $employeeTransfer)
            ->with('success', 'Receiving foreman review submitted.');
    }

    /**
     * Submit a recommendation (Part J) for a specific role.
     */
    public function submitRecommendation(EmployeeTransfer $employeeTransfer, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'role' => 'required|in:current_foreman,safety_manager,receiving_foreman,construction_manager',
            'recommendation' => 'required|string',
            'comments' => 'nullable|string',
        ]);

        $role = $validated['role'];

        if ($role === 'construction_manager') {
            $employeeTransfer->update([
                'construction_manager_decision' => $validated['recommendation'],
                'construction_manager_comments' => $validated['comments'],
                'construction_manager_id' => $request->user()->id,
                'construction_manager_signed_at' => now(),
                'status' => match ($validated['recommendation']) {
                    'accept' => 'approved',
                    'accept_with_conditions' => 'approved_with_conditions',
                    'decline' => 'declined',
                },
            ]);
        } else {
            $prefix = $role;
            $data = [
                "{$prefix}_recommendation" => $validated['recommendation'],
                "{$prefix}_comments" => $validated['comments'],
                "{$prefix}_signed_at" => now(),
            ];

            if ($role === 'safety_manager') {
                $data['safety_manager_id'] = $request->user()->id;
            }

            $employeeTransfer->update($data);
        }

        return redirect()->route('employee-transfers.show', $employeeTransfer)
            ->with('success', 'Recommendation submitted.');
    }
}
