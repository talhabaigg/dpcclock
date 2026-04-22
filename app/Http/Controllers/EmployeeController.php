<?php

namespace App\Http\Controllers;

use App\Jobs\SyncKioskEmployees;
use App\Models\Employee;
use App\Models\EmployeeFileType;
use App\Models\Location;
use App\Models\Worktype;
use App\Services\EmploymentHeroService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index()
    {
        $user = Auth::user();

        $query = Employee::with('worktypes')->fieldStaff();

        if (! $user->can('employees.view-all')) {
            $kioskEmployeeIds = $user->managedKiosks()
                ->with('employees')
                ->get()
                ->flatMap(fn ($kiosk) => $kiosk->employees->pluck('eh_employee_id'))
                ->unique();

            $query->whereIn('eh_employee_id', $kioskEmployeeIds);
        }

        $employees = $query->get();

        // Load employee files with types for the documents column
        $employees->load('employeeFiles.fileType');

        // Build a lightweight list of uploaded file type names per employee
        $allFileTypeNames = [];
        $employeesData = $employees->map(function (Employee $emp) use (&$allFileTypeNames) {
            // Get unique file types this employee has uploaded (latest per type)
            $docs = $emp->employeeFiles
                ->sortByDesc('created_at')
                ->unique('employee_file_type_id')
                ->map(function ($file) use (&$allFileTypeNames) {
                    $ft = $file->fileType;
                    if ($ft) {
                        $allFileTypeNames[$ft->id] = $ft->name;
                    }
                    return [
                        'file_type_id' => $ft?->id,
                        'name' => $ft?->name ?? 'Unknown',
                        'status' => $file->getStatus(),
                    ];
                })
                ->sortBy('name')
                ->values()
                ->all();

            return array_merge($emp->toArray(), [
                'documents' => $docs,
            ]);
        });

        // Build filter dropdown with category grouping
        $allFileTypes = EmployeeFileType::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category'])
            ->map(fn ($ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
                'category' => $ft->category[0] ?? 'Other',
            ]);

        return Inertia::render('employees/index', [
            'employees' => $employeesData,
            'fileTypes' => $allFileTypes,
        ]);
    }

    public function officeIndex()
    {
        $user = Auth::user();
        $employees = Employee::officeStaff()
            ->orderBy('name')
            ->get();

        $canSend = $user->can('employees.office.send-documents');

        return Inertia::render('office-employees/index', [
            'employees' => $employees,
            'canSendDocuments' => $canSend,
            'documentTemplates' => $canSend
                ? \App\Models\DocumentTemplate::active()->forEmployeeType(true)->orderBy('name')->get(['id', 'name', 'placeholders', 'body_html'])
                : [],
            'savedSenderSignatureUrl' => $canSend ? $user->savedSignatureUrl() : null,
            'appUsers' => $canSend
                ? \App\Models\User::query()->whereNull('disabled_at')->orderBy('name')->get(['id', 'name', 'position'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'position' => $u->position])->values()
                : [],
        ]);
    }

    public function show(Employee $employee)
    {
        Gate::authorize('view', $employee);

        $employee->load(['worktypes', 'kiosks.location', 'incidentReports.location', 'clocks' => function ($query) {
            $query->select('id', 'eh_employee_id', 'clock_in')->latest('clock_in')->limit(10);
        }]);

        // Get unique locations/projects with their kiosk IDs
        $projects = $employee->kiosks
            ->filter(fn ($kiosk) => $kiosk->location)
            ->map(fn ($kiosk) => [
                'id' => $kiosk->location->id,
                'name' => $kiosk->location->name,
                'external_id' => $kiosk->location->external_id,
                'kiosk_id' => $kiosk->id,
            ])
            ->unique('id')
            ->values();

        // Current week ending (Friday)
        $weekEnding = now()->endOfWeek(\Carbon\Carbon::FRIDAY)->format('d-m-Y');

        // Journal entries (comments on employee)
        $journal = $employee->comments()
            ->with(['user', 'media'])
            ->whereNull('parent_id')
            ->latest()
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'body' => $c->body,
                'type' => $c->type,
                'user' => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
                'created_at' => $c->created_at->toISOString(),
                'attachments' => $c->getMedia('attachments')->map(fn ($m) => [
                    'id' => $m->id,
                    'name' => $m->file_name,
                    'url' => $this->mediaUrl($m),
                    'mime_type' => $m->mime_type,
                    'size' => $m->size,
                ]),
            ]);

        $canSendDocuments = Gate::check('sendDocuments', $employee);

        $documentTemplates = collect();
        $signingRequests = collect();
        $availablePlaceholders = [];
        if ($canSendDocuments) {
            $documentTemplates = \App\Models\DocumentTemplate::active()
                ->forEmployeeType($employee->isOfficeStaff())
                ->orderBy('name')
                ->get(['id', 'name', 'placeholders', 'body_html']);

            // Shape placeholders for the UI — key, label, preview value for this employee.
            $availablePlaceholders = collect($employee->signingPlaceholders())
                ->map(fn ($def, $key) => [
                    'key' => $key,
                    'label' => $def['label'],
                    'preview' => $def['value'],
                ])
                ->values()
                ->all();

            $viewerId = Auth::id();
            $signingRequests = $employee->signingRequests()
                ->whereNotIn('status', ['cancelled'])
                // Drafts are private to the author; non-drafts are visible to any authorised viewer.
                ->where(function ($q) use ($viewerId) {
                    $q->where('status', '!=', 'draft')
                        ->orWhere('sent_by', $viewerId);
                })
                ->with(['documentTemplate:id,name', 'sentBy:id,name'])
                ->latest()
                ->get()
                ->map(fn ($sr) => [
                    'id' => $sr->id,
                    'status' => $sr->status,
                    'delivery_method' => $sr->delivery_method,
                    'recipient_name' => $sr->recipient_name,
                    'recipient_email' => $sr->recipient_email,
                    'document_title' => $sr->document_title,
                    'document_html' => $sr->status === 'draft' ? $sr->document_html : null,
                    'created_at' => $sr->created_at?->toISOString(),
                    'updated_at' => $sr->updated_at?->toISOString(),
                    'signed_at' => $sr->signed_at?->toISOString(),
                    'opened_at' => $sr->opened_at?->toISOString(),
                    'viewed_at' => $sr->viewed_at?->toISOString(),
                    'expires_at' => $sr->expires_at?->toISOString(),
                    'signer_full_name' => $sr->signer_full_name,
                    'signing_url' => in_array($sr->status, ['pending', 'sent', 'viewed']) && $sr->requires_signature ? $sr->getSigningUrl() : null,
                    'document_template' => $sr->documentTemplate ? [
                        'id' => $sr->documentTemplate->id,
                        'name' => $sr->documentTemplate->name,
                    ] : null,
                    'sent_by' => $sr->sentBy ? [
                        'id' => $sr->sentBy->id,
                        'name' => $sr->sentBy->name,
                    ] : null,
                ])
                ->values();
        }

        return Inertia::render('employees/show', [
            'employee' => array_merge($employee->toArray(), [
                'is_office_staff' => $employee->isOfficeStaff(),
            ]),
            'projects' => $projects,
            'weekEnding' => $weekEnding,
            'journal' => $journal,
            'canSendDocuments' => $canSendDocuments,
            'documentTemplates' => $documentTemplates,
            'signingRequests' => $signingRequests,
            'availablePlaceholders' => $availablePlaceholders,
            'savedSenderSignatureUrl' => $canSendDocuments ? Auth::user()?->savedSignatureUrl() : null,
            'appUsers' => $canSendDocuments
                ? \App\Models\User::query()->whereNull('disabled_at')->orderBy('name')->get(['id', 'name', 'position'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'position' => $u->position])->values()
                : [],
        ]);
    }

    /**
     * Get current employee locations and all available EH locations.
     */
    public function getLocations(Employee $employee, EmploymentHeroService $ehService)
    {
        $data = $ehService->getEmployee($employee->eh_employee_id);

        // Use local DB locations with fully qualified names (populated during location sync)
        $allLocations = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])
            ->open()
            ->whereNotNull('fully_qualified_name')
            ->orderBy('name')
            ->get(['id', 'name', 'fully_qualified_name', 'external_id'])
            ->map(fn ($loc) => [
                'id' => $loc->id,
                'name' => $loc->fully_qualified_name,
                'externalId' => $loc->external_id,
            ]);

        return response()->json([
            'locations' => $data['locations'] ?? '',
            'allEhLocations' => $allLocations,
        ]);
    }

    /**
     * Update employee locations via Employment Hero API.
     */
    public function updateLocations(Employee $employee, Request $request, EmploymentHeroService $ehService)
    {
        $request->validate([
            'locations' => 'required|string',
        ]);

        $result = $ehService->updateEmployeeLocations(
            $employee->eh_employee_id,
            $request->input('locations')
        );

        // Sync local kiosk assignments from the selected location names
        $selectedNames = collect(explode('|', $request->input('locations')))->map(fn ($n) => trim($n))->filter();

        $locationIds = Location::whereIn('fully_qualified_name', $selectedNames)
            ->pluck('eh_location_id')
            ->toArray();

        $kioskIds = \App\Models\Kiosk::whereIn('eh_location_id', $locationIds)
            ->pluck('eh_kiosk_id')
            ->toArray();

        // Preserve existing pivot data for kiosks that remain
        $currentKiosks = $employee->kiosks()->withPivot(['zone', 'top_up'])->get()->keyBy('eh_kiosk_id');
        $syncData = [];
        foreach ($kioskIds as $kioskId) {
            if ($currentKiosks->has($kioskId)) {
                $pivot = $currentKiosks[$kioskId]->pivot;
                $syncData[$kioskId] = ['zone' => $pivot->zone, 'top_up' => $pivot->top_up];
            } else {
                $syncData[$kioskId] = ['zone' => 'default', 'top_up' => false];
            }
        }
        $employee->kiosks()->sync($syncData);

        return response()->json([
            'message' => 'Employee locations updated successfully.',
            'locations' => $result['locations'] ?? $request->input('locations'),
        ]);
    }

    public function sync()
    {
        $apiKey = config('services.employment_hero.api_key');
        $businessId = config('services.employment_hero.business_id');

        $allEmployees = [];
        $page = 1;
        $pageSize = 100;

        do {
            $response = Http::withHeaders([
                'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            ])->get("https://api.yourpayroll.com.au/api/v2/business/{$businessId}/employee/unstructured", [
                '$top' => $pageSize,
                '$skip' => ($page - 1) * $pageSize,
            ]);

            $pageData = $response->json();
            if (! is_array($pageData) || empty($pageData)) {
                break;
            }

            $allEmployees = array_merge($allEmployees, $pageData);
            $page++;
        } while (count($pageData) === $pageSize);

        // Filter only active employees (no endDate)
        $employeeData = array_filter($allEmployees, fn ($employee) => empty($employee['endDate']));

        // Build employing entity id → name lookup (used to stamp the legal entity on each employee)
        $entityResponse = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/{$businessId}/employingentity");
        $entityNameById = collect($entityResponse->json() ?? [])
            ->pluck('name', 'id')
            ->all();

        $apiEmployeeIds = [];

        foreach ($employeeData as $employeeInfo) {
            $apiEmployeeIds[] = $employeeInfo['id'];

            $entityId = $employeeInfo['employingEntityId'] ?? null;
            $entityId = $entityId !== null && $entityId !== '' ? (int) $entityId : null;

            // Find or create (does NOT include soft-deleted, so need withTrashed)
            $employee = Employee::withTrashed()->updateOrCreate(
                ['eh_employee_id' => $employeeInfo['id']],
                [
                    'name' => $employeeInfo['firstName'].' '.$employeeInfo['surname'],
                    'preferred_name' => $employeeInfo['preferredName'] ?? null,
                    'external_id' => $employeeInfo['externalId'] ?? Str::uuid(),
                    'email' => $employeeInfo['emailAddress'] ?? null,
                    'employment_type' => $employeeInfo['employmentType'] ?? null,
                    'employment_agreement' => $employeeInfo['employmentAgreement'] ?? null,
                    'employing_entity_id' => $entityId,
                    'employing_entity_name' => $entityId !== null ? ($entityNameById[$entityId] ?? null) : null,
                    'start_date' => isset($employeeInfo['startDate']) ? substr($employeeInfo['startDate'], 0, 10) : null,
                    'date_of_birth' => isset($employeeInfo['dateOfBirth']) ? substr($employeeInfo['dateOfBirth'], 0, 10) : null,
                    'residential_street_address' => $employeeInfo['residentialStreetAddress'] ?? null,
                    'residential_suburb' => $employeeInfo['residentialSuburb'] ?? null,
                    'residential_state' => $employeeInfo['residentialState'] ?? null,
                    'residential_postcode' => $employeeInfo['residentialPostCode'] ?? null,
                    'pin' => 1234,
                ]
            );

            // Restore if soft deleted
            if ($employee->trashed()) {
                $employee->restore();
            }

            // Sync worktypes if any
            if (! empty($employeeInfo['workTypes'])) {
                $workType = Worktype::where('name', $employeeInfo['workTypes'])->first();
                if ($workType) {
                    $employee->worktypes()->sync([$workType->id]);
                }
            }
        }

        // Soft delete employees not present in current API data
        Employee::whereNotIn('eh_employee_id', $apiEmployeeIds)
            ->whereNull('deleted_at') // only active employees
            ->delete();

        if (! Auth::check()) {
            return response()->json([
                'message' => 'Employees synced successfully from Employment Hero.',
            ], 200);
        }

        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
    }

    public function syncEmployeeWorktypes()
    {
        ini_set('max_execution_time', 300);
        $apiKey = config('services.employment_hero.api_key');

        $employees = Employee::all();
        $missingWorkTypes = []; // Array to track missing work types
        $allowedCodes = ['01-01', '03-01', '05-01', '07-01', '11-01'];

        foreach ($employees as $employee) {
            $employeeId = $employee->eh_employee_id;

            $response = Http::withHeaders([
                'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

            $employeeData = $response->json();

            $workTypeString = $employeeData['workTypes'] ?? ''; // May contain pipe-separated values

            // Skip if empty
            if ($workTypeString === '') {
                continue;
            }

            $workTypes = explode('|', $workTypeString);

            // Filter only work types that contain allowed codes
            $filteredWorkType = collect($workTypes)->first(function ($wt) use ($allowedCodes) {
                foreach ($allowedCodes as $code) {
                    if (Str::contains($wt, $code)) {
                        return true;
                    }
                }

                return false;
            });

            if (! $filteredWorkType) {
                // Store all unmatchable workTypes
                $missingWorkTypes[] = [
                    'employee_id' => $employeeId,
                    'searched_workTypes' => $workTypeString,
                    'reason' => 'No allowed code matched',
                ];

                continue;
            }

            // Lookup workType ID
            $workTypeId = WorkType::where('name', trim($filteredWorkType))->pluck('id')->first();

            if (! empty($workTypeId)) {
                $employee->worktypes()->sync($workTypeId);
                $employee->load('workTypes'); // Reload relationships
            } else {
                $missingWorkTypes[] = [
                    'employee_id' => $employeeId,
                    'searched_workType' => $filteredWorkType,
                    'reason' => 'WorkType not found in DB',
                ];
            }
        }

        if (! empty($missingWorkTypes)) {
            dd($missingWorkTypes);
        }

        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
    }

    public function syncSingleEmployeeWorktype($employeeId)
    {
        // dd($employeeId);
        $apiKey = config('services.employment_hero.api_key');
        $missingWorkTypes = []; // Array to track missing work types
        $allowedCodes = ['01-01', '03-01', '05-01', '07-01', '11-01'];
        $employee = Employee::findOrFail($employeeId);
        // dd($employee);
        $employeeId = $employee->eh_employee_id;
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

        $employeeData = $response->json();
        $workTypeString = $employeeData['workTypes'] ?? '';
        $workTypes = explode('|', $workTypeString);

        $filteredWorkType = collect($workTypes)->first(function ($wt) use ($allowedCodes) {
            foreach ($allowedCodes as $code) {
                if (Str::contains($wt, $code)) {
                    return true;
                }
            }

            return false;
        });

        $workTypeId = WorkType::where('name', trim($filteredWorkType))->pluck('id')->first();

        $employee->worktypes()->sync($workTypeId);
        $employee->load('workTypes'); // Reload relationships

    }

    public function retrieveEmployees()
    {
        $user = auth()->user();

        // Eager load employees to avoid N+1 queries
        $kiosks = $user->managedKiosks()->with('employees')->get();

        // Flatten, deduplicate, and sort employees by name
        $employees = $kiosks->flatMap(function ($kiosk) {
            return $kiosk->employees;
        })->unique('eh_employee_id')
            ->sortBy('name')
            ->values(); // Reindex the array

        // Format employee data
        $employeeData = $employees->map(function ($employee) {
            return [
                'id' => $employee->eh_employee_id,
                'name' => $employee->name,
            ];
        });

        return response()->json($employeeData);
    }

    public function updateKioskEmployees()
    {
        $user = Auth::user();
        if (! $user) {
            return redirect()->back()->with('error', 'You must be logged in to update kiosk employees.');
        }
        SyncKioskEmployees::dispatch($user->id);

        return redirect()->back()->with('success', 'Kiosk employees update job has been dispatched. You will be notified when it is complete.');
    }

    private function mediaUrl(\Spatie\MediaLibrary\MediaCollections\Models\Media $media): string
    {
        try {
            return $media->getTemporaryUrl(now()->addMinutes(30));
        } catch (\RuntimeException) {
            return $media->getUrl();
        }
    }
}
