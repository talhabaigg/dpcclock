<?php

namespace App\Http\Controllers;

use App\Exports\InjuryExport;
use App\Http\Requests\StoreInjuryRequest;
use App\Http\Requests\UpdateInjuryRequest;
use App\Imports\InjuryImport;
use App\Models\Employee;
use App\Models\Injury;
use App\Models\Location;
use App\Models\User;
use App\Notifications\InjuryCreatedNotification;
use App\Services\GetCompanyCodeService;
use App\Services\ModelTriggerFormService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Maatwebsite\Excel\Facades\Excel;
use Spatie\Browsershot\Browsershot;
use Inertia\Inertia;

class InjuryController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'per_page' => 'nullable|integer|in:10,25,50,100',
        ]);
        $perPage = (int) $request->input('per_page', 25);

        $query = Injury::with(['employee', 'location', 'representative', 'creator']);

        if (! $request->user()->can('injury-register.view-all')) {
            $query->whereIn('location_id', $request->user()->managedLocationIds());
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('id_formal', 'like', "%{$search}%")
                  ->orWhereHas('employee', function ($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%")
                        ->orWhere('preferred_name', 'like', "%{$search}%");
                  })
                  ->orWhereHas('location', function ($q) use ($search) {
                      $q->where('name', 'like', "%{$search}%");
                  })
                  ->orWhere('incident', 'like', "%{$search}%");
            });
        }
        if ($request->filled('location_id')) {
            $query->where('location_id', $request->location_id);
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->employee_id);
        }
        if ($request->filled('incident')) {
            $query->where('incident', $request->incident);
        }
        if ($request->filled('report_type')) {
            $query->where('report_type', $request->report_type);
        }
        if ($request->filled('work_cover_claim')) {
            $query->where('work_cover_claim', $request->boolean('work_cover_claim'));
        }
        if ($request->filled('claim_type')) {
            $query->where('claim_type', $request->claim_type);
        }
        if ($request->filled('claim_status')) {
            $query->where('claim_status', $request->claim_status);
        }
        if ($request->filled('month') && $request->filled('year')) {
            $query->whereYear('occurred_at', (int) $request->year)
                  ->whereMonth('occurred_at', (int) $request->month);
        }
        if ($request->filled('project')) {
            $projectName = $request->project;
            $query->whereHas('location', function ($q) use ($projectName) {
                $q->where('name', $projectName)
                  ->orWhereHas('projectGroup', function ($q2) use ($projectName) {
                      $q2->where('name', $projectName);
                  });
            });
        }
        if ($request->filled('fy')) {
            $fyStartYear = (int) $request->fy;
            $fyStart = "{$fyStartYear}-07-01";
            if ($request->filled('fy_month') && $request->filled('fy_year')) {
                $m = (int) $request->fy_month;
                $y = (int) $request->fy_year;
                $fyEnd = date('Y-m-t', mktime(0, 0, 0, $m, 1, $y));
            } else {
                $fyEnd = ($fyStartYear + 1) . '-06-30';
            }
            $query->whereBetween('occurred_at', [$fyStart, $fyEnd]);
        }
        if ($request->filled('entity')) {
            $entity = $request->entity;
            $query->whereHas('location', function ($q) use ($entity) {
                $q->where('name', $entity)
                  ->orWhereHas('parentLocation', function ($q2) use ($entity) {
                      $q2->where('name', $entity)
                        ->orWhereHas('parentLocation', function ($q3) use ($entity) {
                            $q3->where('name', $entity);
                        });
                  });
            });
        }
        if ($request->filled('status')) {
            if ($request->status === 'locked') {
                $query->whereNotNull('locked_at');
            } elseif ($request->status === 'active') {
                $query->whereNull('locked_at');
            }
        }
        if ($request->filled('date_from')) {
            $query->whereDate('occurred_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('occurred_at', '<=', $request->date_to);
        }

        $injuries = $query->latest('occurred_at')->paginate($perPage)->withQueryString();

        return Inertia::render('injury-register/index', [
            'injuries' => $injuries,
            'filters' => $request->only(['search', 'location_id', 'employee_id', 'incident', 'report_type', 'work_cover_claim', 'claim_type', 'claim_status', 'fy', 'fy_month', 'fy_year', 'entity', 'project', 'month', 'year', 'status', 'date_from', 'date_to']),
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'employees' => Employee::orderBy('name')->get(['id', 'name', 'preferred_name']),
            'incidentOptions' => Injury::INCIDENT_OPTIONS,
            'reportTypeOptions' => Injury::REPORT_TYPE_OPTIONS,
            'isLocal' => app()->environment('local'),
        ]);
    }

    public function create()
    {
        return Inertia::render('injury-register/form', [
            'injury' => null,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'employees' => Employee::orderBy('name')->get(['id', 'name', 'preferred_name', 'employment_type']),
            'options' => $this->getFormOptions(),
        ]);
    }

    public function store(StoreInjuryRequest $request, ModelTriggerFormService $triggerFormService)
    {
        $data = $request->validated();
        $data['id_formal'] = Injury::generateFormalId();
        $data['created_by'] = auth()->id();

        unset($data['files'], $data['witness_files']);

        // Stamp signature timestamps when signatures are present on initial create
        if (!empty($data['worker_signature'] ?? null)) {
            $data['worker_signed_at'] = now();
        }
        if (!empty($data['representative_signature'] ?? null)) {
            $data['representative_signed_at'] = now();
        }

        $injury = Injury::create($data);

        if ($request->hasFile('files')) {
            foreach ($request->file('files') as $file) {
                $injury->addMedia($file)->toMediaCollection('files');
            }
        }

        if ($request->hasFile('witness_files')) {
            foreach ($request->file('witness_files') as $file) {
                $injury->addMedia($file)->toMediaCollection('files');
            }
        }

        $injury->load(['employee', 'location.kiosk.managers', 'creator']);

        // 1. Kiosk managers for the injury's location
        $kioskManagerIds = $injury->location?->kiosk?->managers?->pluck('id') ?? collect();

        // 2. Global injury alert subscribers (construction/safety/general managers)
        $globalSubscriberIds = User::where('receive_injury_alerts', true)->pluck('id');

        $recipientIds = $kioskManagerIds->merge($globalSubscriberIds)
            ->unique()
            ->reject(fn ($id) => $id === auth()->id());

        $recipients = User::whereIn('id', $recipientIds)->get();

        foreach ($recipients as $recipient) {
            $recipient->notify(new InjuryCreatedNotification($injury));
        }

        $triggerFormService->dispatchFormsFor($injury, 'created', $request->user());

        return redirect()->route('injury-register.index')
            ->with('success', 'Injury report created successfully.');
    }

    public function show(Injury $injury)
    {
        $injury->load(['employee', 'location', 'representative', 'creator', 'media', 'formRequests.formTemplate.fields', 'formRequests.media']);

        $formRequests = $injury->formRequests->map(fn ($fr) => [
            'id' => $fr->id,
            'token' => $fr->token,
            'status' => $fr->status,
            'delivery_method' => $fr->delivery_method,
            'recipient_name' => $fr->recipient_name,
            'recipient_email' => $fr->recipient_email,
            'assignee_strategy' => $fr->assignee_strategy,
            'assignee_permission' => $fr->assignee_permission,
            'assignee_user_id' => $fr->assignee_user_id,
            'submitted_at' => $fr->submitted_at?->toISOString(),
            'opened_at' => $fr->opened_at?->toISOString(),
            'expires_at' => $fr->expires_at?->toISOString(),
            'response_snapshot' => $this->resolveSnapshotSignatureUrls($fr),
            'created_at' => $fr->created_at->toISOString(),
            'form_template' => [
                'id' => $fr->formTemplate->id,
                'name' => $fr->formTemplate->name,
                'is_sendable' => $fr->formTemplate->is_sendable,
                'fields' => $fr->formTemplate->fields->map(fn ($f) => [
                    'id' => $f->id,
                    'label' => $f->label,
                    'type' => $f->type,
                    'is_required' => $f->is_required,
                    'options' => $f->options,
                    'options_source' => $f->options_source,
                    'placeholder' => $f->placeholder,
                    'help_text' => $f->help_text,
                    'default_value' => $f->default_value,
                    'visible_if' => $f->visible_if,
                ])->values(),
            ],
        ]);

        $comments = $injury->comments()
            ->with(['user', 'media', 'replies.user', 'replies.media'])
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
                ]),
                'replies' => $c->replies->map(fn ($r) => [
                    'id' => $r->id,
                    'body' => $r->body,
                    'user' => $r->user ? ['id' => $r->user->id, 'name' => $r->user->name] : null,
                    'metadata' => $r->metadata,
                    'created_at' => $r->created_at->toISOString(),
                    'attachments' => $r->getMedia('attachments')->map(fn ($m) => [
                        'id' => $m->id,
                        'file_name' => $m->file_name,
                        'url' => route('comments.attachment', ['comment' => $r->id, 'media' => $m->id]),
                        'mime_type' => $m->mime_type,
                    ]),
                ]),
            ]);

        $notifyUsers = User::orderBy('name')
            ->get(['id', 'name', 'email', 'phone'])
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'has_sms' => User::normaliseAuMobile($u->phone) !== null,
            ])
            ->values();

        return Inertia::render('injury-register/show', [
            'injury' => $injury,
            'comments' => $comments,
            'options' => $this->getFormOptions(),
            'notifyUsers' => $notifyUsers,
            'formRequests' => $formRequests,
        ]);
    }

    public function edit(Injury $injury)
    {
        if ($injury->isLocked()) {
            return redirect()->route('injury-register.show', $injury)
                ->with('error', 'This record is locked and cannot be edited.');
        }

        $injury->load('media');

        return Inertia::render('injury-register/form', [
            'injury' => $injury,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'employees' => Employee::orderBy('name')->get(['id', 'name', 'preferred_name', 'employment_type']),
            'options' => $this->getFormOptions(),
        ]);
    }

    public function update(UpdateInjuryRequest $request, Injury $injury)
    {
        $data = $request->validated();
        $data['updated_by'] = auth()->id();

        unset($data['files'], $data['witness_files']);

        // The frontend only includes signature keys when the user explicitly drew or
        // cleared. Presence of the key is the source of truth for "this is a change."
        if (array_key_exists('worker_signature', $data)) {
            $data['worker_signed_at'] = !empty($data['worker_signature']) ? now() : null;
        }
        if (array_key_exists('representative_signature', $data)) {
            $data['representative_signed_at'] = !empty($data['representative_signature']) ? now() : null;
        }

        $injury->update($data);

        if ($request->hasFile('files')) {
            foreach ($request->file('files') as $file) {
                $injury->addMedia($file)->toMediaCollection('files');
            }
        }

        if ($request->hasFile('witness_files')) {
            foreach ($request->file('witness_files') as $file) {
                $injury->addMedia($file)->toMediaCollection('files');
            }
        }

        return redirect()->route('injury-register.show', $injury)
            ->with('success', 'Injury report updated successfully.');
    }

    public function destroy(Injury $injury)
    {
        if ($injury->isLocked()) {
            return back()->with('error', 'This record is locked and cannot be deleted.');
        }

        $injury->delete();

        return redirect()->route('injury-register.index')
            ->with('success', 'Injury report deleted.');
    }

    public function updateClassification(Request $request, Injury $injury)
    {
        $validated = $request->validate([
            'work_cover_claim' => ['required', 'boolean'],
            'work_days_missed' => ['nullable', 'integer', 'min:0'],
            'report_type' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(Injury::REPORT_TYPE_OPTIONS))],
            'claim_active' => ['nullable', 'boolean'],
            'claim_type' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(Injury::CLAIM_TYPE_OPTIONS))],
            'claim_status' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(Injury::CLAIM_STATUS_OPTIONS))],
            'capacity' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(Injury::CAPACITY_OPTIONS))],
            'employment_status' => ['nullable', 'string', \Illuminate\Validation\Rule::in(array_keys(Injury::EMPLOYMENT_STATUS_OPTIONS))],
            'claim_cost' => ['nullable', 'numeric', 'min:0'],
            'days_suitable_duties' => ['nullable', 'integer', 'min:0'],
            'suitable_duties_from' => ['nullable', 'date'],
            'suitable_duties_to' => ['nullable', 'date'],
            'medical_expenses' => ['nullable', 'numeric', 'min:0'],
        ]);

        $injury->update($validated);

        return back()->with('success', 'Classification updated.');
    }

    public function lock(Injury $injury)
    {
        $injury->update(['locked_at' => now()]);

        return back()->with('success', 'Record locked.');
    }

    public function unlock(Injury $injury)
    {
        $injury->update(['locked_at' => null]);

        return back()->with('success', 'Record unlocked.');
    }

    public function testNotification(Request $request, Injury $injury)
    {
        $request->validate([
            'phone' => 'nullable|string|max:30',
        ]);

        $injury->load(['employee', 'location', 'creator']);

        $notification = new InjuryCreatedNotification($injury);
        $notification->afterCommit = false;

        if ($request->filled('phone')) {
            $phone = User::normaliseAuMobile($request->input('phone'));
            if (! $phone) {
                return back()->withErrors(['phone' => 'Enter a valid Australian mobile number (e.g. 0412 345 678).']);
            }
            Notification::route('clicksend', $phone)->notifyNow($notification);

            return back()->with('success', 'Test SMS sent to ' . $phone);
        }

        auth()->user()->notifyNow($notification);

        return back()->with('success', 'Test notification sent to ' . auth()->user()->email);
    }

    public function sendNotification(Request $request, Injury $injury)
    {
        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
            'channels' => 'required|array|min:1',
            'channels.*' => 'string|in:mail,sms',
        ]);

        $injury->load(['employee', 'location', 'creator']);
        $users = User::whereIn('id', $request->input('user_ids'))->get();

        $sent = 0;
        $skipped = [];

        foreach ($users as $user) {
            $notification = (new InjuryCreatedNotification($injury))->only($request->input('channels'));
            $resolvedChannels = $notification->via($user);

            if (empty($resolvedChannels)) {
                $skipped[] = $user->name;
                continue;
            }

            $user->notify($notification);
            $sent++;
        }

        $message = "Notification sent to {$sent} user" . ($sent === 1 ? '' : 's') . '.';
        if (! empty($skipped)) {
            $message .= ' Skipped (no matching channel): ' . implode(', ', $skipped) . '.';
        }

        return back()->with('success', $message);
    }

    public function downloadPdf(Injury $injury)
    {
        $injury->load(['employee', 'location', 'representative', 'creator']);

        $pdfContent = self::generatePdf($injury);
        $filename = $injury->id_formal . '.pdf';

        return response($pdfContent, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    public static function generatePdf(Injury $injury): string
    {
        $injury->loadMissing(['employee', 'location', 'representative', 'creator']);

        $bodyLocationPaths = null;
        if ($injury->body_location_image) {
            $decoded = json_decode($injury->body_location_image, true);
            if (is_array($decoded) && count($decoded) > 0) {
                $bodyLocationPaths = $decoded;
            }
        }

        $bodyOutlineBase64 = null;
        $bodyImageDims = null;
        if ($bodyLocationPaths) {
            $outlinePath = public_path('images/body-outline.png');
            if (file_exists($outlinePath)) {
                $bodyOutlineBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($outlinePath));
                $size = getimagesize($outlinePath);
                if ($size) {
                    $bodyImageDims = ['w' => $size[0], 'h' => $size[1]];
                }
            }
        }

        $html = view('injury-register.pdf', [
            'injury' => $injury,
            'bodyLocationPaths' => $bodyLocationPaths,
            'bodyOutlineBase64' => $bodyOutlineBase64,
            'bodyImageDims' => $bodyImageDims,
        ])->render();

        $companyCode = $injury->location ? (new GetCompanyCodeService)->getCompanyCode($injury->location->eh_parent_id) : null;
        $isGre = in_array($companyCode, ['GREEN', 'GRE']);
        $logoPath = public_path($isGre ? 'gre_logo.jpg' : 'logo.png');
        if (!file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
            $isGre = false;
        }
        $logoMime = $isGre ? 'image/jpeg' : 'image/png';
        $logoBase64 = 'data:' . $logoMime . ';base64,' . base64_encode(file_get_contents($logoPath));
        $headerHtml = <<<HEADER
        <div style="width: 100%; padding: 8px 15mm 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 2px solid #334155;">
                <div>
                    <img src="{$logoBase64}" style="max-height: 44px;" />
                </div>
                <div style="text-align: right; font-family: Arial, Helvetica, sans-serif;">
                    <div style="font-size: 18px; color: #334155; font-weight: 700;">Incident / Injury Report</div>
                    <div style="font-size: 16px; color: #334155; font-weight: 600;">{$injury->id_formal}</div>
                </div>
            </div>
        </div>
        HEADER;

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 15mm 6px;">
            <div style="display: flex; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #6b7280; padding-top: 6px; border-top: 2px solid #334155;">
                <div style="flex: 1; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #334155;">Private &amp; Confidential</div>
                <div style="flex: 1; text-align: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
        </div>
        FOOTER;

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
            ->margins(22, 15, 20, 15, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();
    }

    public function downloadFile(Injury $injury, int $media)
    {
        $mediaItem = $injury->media()->where('id', $media)->where('collection_name', 'files')->first();
        abort_unless($mediaItem, 404);

        return redirect($this->mediaUrl($mediaItem));
    }

    public function deleteAttachment(Injury $injury, int $media)
    {
        $mediaItem = $injury->media()->where('id', $media)->where('collection_name', 'files')->first();
        abort_unless($mediaItem, 404);

        $mediaItem->collection_name = 'files_removed';
        $mediaItem->save();

        return back()->with('success', 'Attachment removed.');
    }

    public function dropAll()
    {
        abort_unless(app()->environment('local'), 403);

        $count = Injury::count();

        // Delete orphan comments, activity log, and media before truncating
        \App\Models\Comment::where('commentable_type', Injury::class)->delete();
        \Spatie\Activitylog\Models\Activity::where('subject_type', Injury::class)->delete();
        Injury::each(fn ($injury) => $injury->clearMediaCollection('files'));
        Injury::truncate();

        return back()->with('success', "Dropped all {$count} injury records.");
    }

    public function export(Request $request)
    {
        $filters = $request->only(['location_id', 'employee_id', 'incident', 'report_type']);
        $filename = 'injury-register-export-' . now()->format('Y-m-d-H-i-s') . '.xlsx';

        return Excel::download(new InjuryExport($filters), $filename);
    }

    public function import(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:xlsx,xls|max:10240']);

        $import = new InjuryImport(auth()->id());

        try {
            Excel::import($import, $request->file('file'));
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'imported' => $import->importedCount,
            'updated' => $import->updatedCount,
            'skipped' => $import->skippedCount,
            'errors' => $import->errors,
        ]);
    }

    protected function getFormOptions(): array
    {
        return [
            'incidents' => Injury::INCIDENT_OPTIONS,
            'reportTypes' => Injury::REPORT_TYPE_OPTIONS,
            'treatmentTypes' => Injury::TREATMENT_TYPE_OPTIONS,
            'natures' => Injury::NATURE_OPTIONS,
            'mechanisms' => Injury::MECHANISM_OPTIONS,
            'agencies' => Injury::AGENCY_OPTIONS,
            'contributions' => Injury::CONTRIBUTION_OPTIONS,
            'correctiveActions' => Injury::CORRECTIVE_ACTION_OPTIONS,
            'claimTypes' => Injury::CLAIM_TYPE_OPTIONS,
            'claimStatuses' => Injury::CLAIM_STATUS_OPTIONS,
            'capacities' => Injury::CAPACITY_OPTIONS,
            'employmentStatuses' => Injury::EMPLOYMENT_STATUS_OPTIONS,
        ];
    }

    private function mediaUrl(\Spatie\MediaLibrary\MediaCollections\Models\Media $media): string
    {
        try {
            return $media->getTemporaryUrl(now()->addMinutes(30));
        } catch (\RuntimeException) {
            return $media->getUrl();
        }
    }

    /**
     * API endpoint for bulk import: lookup injury by occurred_at date + employee email,
     * attach a PDF as a comment, and set the external_id.
     */
    public function apiImportComment(Request $request)
    {
        $request->validate([
            'occurred_at' => 'required|date',
            'employee_email' => 'nullable|email',
            'employee_name' => 'nullable|string|max:255',
            'external_id' => 'required|string|max:50',
            'pdf' => 'required|file|max:20480',
        ]);

        $occurredDate = \Carbon\Carbon::parse($request->occurred_at)->startOfDay();
        $injury = null;
        $matchMethod = null;

        // Try 1: match by email + date
        if ($request->employee_email) {
            $employee = Employee::where('email', $request->employee_email)->first();

            if ($employee) {
                $injury = Injury::where('employee_id', $employee->id)
                    ->whereDate('occurred_at', $occurredDate)
                    ->first();
                if ($injury) {
                    $matchMethod = 'email';
                }
            }
        }

        // Try 2: fallback to employee_name + date
        if (!$injury && $request->employee_name) {
            $injury = Injury::where('employee_name', 'like', $request->employee_name)
                ->whereDate('occurred_at', $occurredDate)
                ->first();
            if ($injury) {
                $matchMethod = 'name';
            }
        }

        if (!$injury) {
            return response()->json([
                'status' => 'not_found',
                'reason' => 'no_match',
                'message' => "No injury found for " . ($request->employee_name ?? $request->employee_email) . " on {$occurredDate->toDateString()}",
            ], 404);
        }

        // Set external_id
        $injury->update(['external_id' => $request->external_id]);

        // Add PDF as a system comment with migration metadata
        $displayName = $request->employee_name ?? $injury->employee_name;
        $displayEmail = $request->employee_email ?? 'N/A';

        $metadata = [
            'source' => 'legacy_import',
            'external_id' => $request->external_id,
            'employee_name' => $displayName,
            'employee_email' => $displayEmail,
            'occurred_at' => $occurredDate->toDateString(),
            'matched_by' => $matchMethod,
            'imported_at' => now()->toDateTimeString(),
        ];

        $body = "**[System Migration]** Injury report imported from legacy system.\n\n"
            . "**Legacy ID:** {$request->external_id}\n"
            . "**Employee:** {$displayName}" . ($displayEmail !== 'N/A' ? " ({$displayEmail})" : '') . "\n"
            . "**Date of Injury:** {$occurredDate->format('d/m/Y')}\n"
            . "**Matched by:** {$matchMethod}\n\n"
            . "_This comment was automatically generated as part of a data migration and does not represent a manual entry._";

        $comment = $injury->addSystemComment($body, $metadata);

        $comment->addMedia($request->file('pdf'))->toMediaCollection('attachments');

        return response()->json([
            'status' => 'ok',
            'injury_id' => $injury->id,
            'id_formal' => $injury->id_formal,
            'matched_by' => $matchMethod,
            'comment_id' => $comment->id,
        ], 200);
    }

    /**
     * Walk a FormRequest's response_snapshot and swap each signature row's
     * value (the stored media id) for a usable URL. Mirrors the application
     * controller's pattern — temporary URL on S3, public URL on local disk.
     *
     * @return array<int, array<string,mixed>>|null
     */
    private function resolveSnapshotSignatureUrls(\App\Models\FormRequest $fr): ?array
    {
        $snapshot = $fr->response_snapshot;
        if (! is_array($snapshot)) {
            return $snapshot;
        }
        $mediaById = $fr->getMedia('signatures')->keyBy('id');
        foreach ($snapshot as $i => $row) {
            if (! is_array($row) || ($row['type'] ?? null) !== 'signature') {
                continue;
            }
            $value = $row['value'] ?? null;
            if (! is_numeric($value)) {
                continue;
            }
            $media = $mediaById->get((int) $value);
            if ($media) {
                $snapshot[$i]['value'] = $this->mediaUrl($media);
            }
        }
        return $snapshot;
    }
}