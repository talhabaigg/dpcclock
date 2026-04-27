<?php

namespace App\Http\Controllers;

use App\Models\Kiosk;
use App\Models\Location;
use App\Models\ToolboxTalk;
use App\Models\ToolboxTalkAttendee;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use setasign\Fpdi\Tcpdf\Fpdi;
use Spatie\Browsershot\Browsershot;

class ToolboxTalkController extends Controller
{
    public function index(Request $request)
    {
        $query = ToolboxTalk::with(['location', 'calledBy', 'attendees.employee']);

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->location_id);
        }
        if ($request->filled('meeting_date')) {
            $query->whereDate('meeting_date', $request->meeting_date);
        }

        $talks = $query->latest('meeting_date')->paginate(25)->withQueryString();

        $talks->getCollection()->transform(function (ToolboxTalk $talk) {
            $location = $talk->location;
            $kioskEmployees = collect();

            if ($location) {
                $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
                if ($kiosk) {
                    $kioskEmployees = $kiosk->employees()->get(['employees.id', 'name', 'preferred_name']);
                }
            }

            $signedAttendees = $talk->attendees->filter(fn ($a) => $a->signed_at !== null || $a->signed);
            $signedIds = $signedAttendees->pluck('employee_id')->toArray();

            $talk->signed_employees = $signedAttendees->map(fn ($a) => [
                'id' => $a->employee?->id,
                'name' => $a->employee?->preferred_name ?? $a->employee?->name,
            ])->filter(fn ($e) => $e['id'] !== null)->values();

            $talk->not_signed_employees = $kioskEmployees
                ->filter(fn ($emp) => ! in_array($emp->id, $signedIds))
                ->map(fn ($emp) => [
                    'id' => $emp->id,
                    'name' => $emp->preferred_name ?? $emp->name,
                ])->values();

            return $talk;
        });

        $meetingDates = ToolboxTalk::select('meeting_date')
            ->distinct()
            ->orderByDesc('meeting_date')
            ->limit(200)
            ->pluck('meeting_date')
            ->map(fn ($d) => [
                'value' => $d,
                'label' => \Carbon\Carbon::parse($d)->format('D d/m/Y'),
            ]);

        return Inertia::render('toolbox-talks/index', [
            'talks' => $talks,
            'filters' => $request->only(['location_id', 'meeting_date']),
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'meetingDates' => $meetingDates,
            'subjectOptions' => ToolboxTalk::SUBJECT_OPTIONS,
        ]);
    }

    public function create()
    {
        return Inertia::render('toolbox-talks/form', [
            'talk' => null,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'users' => User::orderBy('name')->get(['id', 'name']),
            'subjectOptions' => ToolboxTalk::SUBJECT_OPTIONS,
            'generalItems' => ToolboxTalk::GENERAL_ITEMS,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'meeting_date' => 'required|date',
            'called_by' => 'nullable|exists:users,id',
            'meeting_subject' => 'required|string',
            'key_topics' => 'nullable|array',
            'key_topics.*.description' => 'required|string',
            'action_points' => 'nullable|array',
            'action_points.*.description' => 'required|string',
            'near_misses' => 'nullable|array',
            'near_misses.*.description' => 'required|string',
            'floor_comments' => 'nullable|array',
            'floor_comments.*.description' => 'required|string',
            'injuries' => 'nullable|array',
            'injuries.*.description' => 'required|string',
        ]);

        $data['created_by'] = auth()->id();

        $talk = ToolboxTalk::create($data);

        return redirect()->route('toolbox-talks.index')
            ->with('success', 'Toolbox talk created successfully.');
    }

    public function show(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->load(['location', 'calledBy', 'createdBy', 'media']);

        return Inertia::render('toolbox-talks/show', [
            'talk' => $toolboxTalk,
            'subjectOptions' => ToolboxTalk::SUBJECT_OPTIONS,
            'generalItems' => ToolboxTalk::GENERAL_ITEMS,
            'signInUrl' => url('/t/'.$toolboxTalk->public_token),
            'ipadUrl' => url('/t/'.$toolboxTalk->public_token.'/ipad'),
        ]);
    }

    public function qrSheet(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->load('location');

        $url = url('/t/'.$toolboxTalk->public_token);

        $html = view('pdf.toolbox-talk-qr-sheet', [
            'talk' => $toolboxTalk,
            'signInUrl' => $url,
        ])->render();

        $pdf = $this->renderPdf($html);

        $filename = 'toolbox-talk-qr-'.$toolboxTalk->meeting_date.'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function edit(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->load('media');

        return Inertia::render('toolbox-talks/form', [
            'talk' => $toolboxTalk,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'users' => User::orderBy('name')->get(['id', 'name']),
            'subjectOptions' => ToolboxTalk::SUBJECT_OPTIONS,
            'generalItems' => ToolboxTalk::GENERAL_ITEMS,
        ]);
    }

    public function update(Request $request, ToolboxTalk $toolboxTalk)
    {
        if ($toolboxTalk->is_locked) {
            return redirect()->back()->with('error', 'This toolbox talk is locked and cannot be edited.');
        }

        $data = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'meeting_date' => 'required|date',
            'called_by' => 'nullable|exists:users,id',
            'meeting_subject' => 'required|string',
            'key_topics' => 'nullable|array',
            'key_topics.*.description' => 'required|string',
            'action_points' => 'nullable|array',
            'action_points.*.description' => 'required|string',
            'near_misses' => 'nullable|array',
            'near_misses.*.description' => 'required|string',
            'floor_comments' => 'nullable|array',
            'floor_comments.*.description' => 'required|string',
            'topic_files' => 'nullable|array',
            'topic_files.*' => 'file|max:10240',
            'action_point_files' => 'nullable|array',
            'action_point_files.*' => 'file|max:10240',
            'injuries' => 'nullable|array',
            'injuries.*.description' => 'required|string',
            'injury_files' => 'nullable|array',
            'injury_files.*' => 'file|max:10240',
            'near_miss_files' => 'nullable|array',
            'near_miss_files.*' => 'file|max:10240',
            'floor_comment_files' => 'nullable|array',
            'floor_comment_files.*' => 'file|max:10240',
            'removed_media_ids' => 'nullable|array',
            'removed_media_ids.*' => 'integer',
        ]);

        unset($data['topic_files'], $data['action_point_files'], $data['near_miss_files'], $data['floor_comment_files'], $data['removed_media_ids']);

        $data['key_topics'] = $data['key_topics'] ?? [];
        $data['action_points'] = $data['action_points'] ?? [];
        $data['injuries'] = $data['injuries'] ?? [];
        $data['near_misses'] = $data['near_misses'] ?? [];
        $data['floor_comments'] = $data['floor_comments'] ?? [];

        $toolboxTalk->update($data);

        if ($request->filled('removed_media_ids')) {
            $toolboxTalk->media()->whereIn('id', $request->removed_media_ids)->delete();
        }

        $this->handleMediaUploads($request, $toolboxTalk);

        return redirect()->route('toolbox-talks.index')
            ->with('success', 'Toolbox talk updated successfully.');
    }

    public function destroy(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->delete();

        return redirect()->route('toolbox-talks.index')
            ->with('success', 'Toolbox talk deleted successfully.');
    }

    public function duplicate(ToolboxTalk $toolboxTalk)
    {
        $newTalk = ToolboxTalk::create([
            'location_id' => $toolboxTalk->location_id,
            'meeting_date' => now()->toDateString(),
            'called_by' => auth()->id(),
            'meeting_subject' => $toolboxTalk->meeting_subject,
            'key_topics' => $toolboxTalk->key_topics,
            'action_points' => $toolboxTalk->action_points,
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('toolbox-talks.edit', $newTalk)
            ->with('success', 'Toolbox talk duplicated. You can now edit it.');
    }

    public function lock(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->update(['locked_at' => now()]);

        return redirect()->back()->with('success', 'Toolbox talk locked.');
    }

    public function unlock(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->update(['locked_at' => null]);

        return redirect()->back()->with('success', 'Toolbox talk unlocked.');
    }

    public function downloadPdf(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->load('location', 'calledBy');

        $digitalAttendees = ToolboxTalkAttendee::with('employee')
            ->where('toolbox_talk_id', $toolboxTalk->id)
            ->whereNotNull('signed_at')
            ->whereNotNull('signature_path')
            ->orderBy('signed_at')
            ->get()
            ->map(function (ToolboxTalkAttendee $a) {
                $name = $a->employee?->preferred_name ?? $a->employee?->name ?? 'Unknown';
                $signatureDataUri = null;
                if ($a->signature_path && Storage::disk('public')->exists($a->signature_path)) {
                    $signatureDataUri = 'data:image/png;base64,'
                        .base64_encode(Storage::disk('public')->get($a->signature_path));
                }

                return [
                    'name' => $name,
                    'signed_at' => $a->signed_at,
                    'source' => $a->source,
                    'signature_data_uri' => $signatureDataUri,
                ];
            })
            ->values();

        // Generate the toolbox talk content PDF
        $contentHtml = view('pdf.toolbox-talk-sign-sheet', [
            'talk' => $toolboxTalk,
            'subjectOptions' => ToolboxTalk::SUBJECT_OPTIONS,
            'generalItems' => ToolboxTalk::GENERAL_ITEMS,
            'digitalAttendees' => $digitalAttendees,
        ])->render();

        $contentPdf = $this->renderPdf($contentHtml);

        // If there's an uploaded signed PDF, merge them
        $signedMedia = $toolboxTalk->getFirstMedia('signed_pdf');
        if ($signedMedia) {
            $contentTmp = tempnam(sys_get_temp_dir(), 'tbt_content_') . '.pdf';
            file_put_contents($contentTmp, $contentPdf);

            $fpdi = new Fpdi();

            // Add content pages
            $contentPageCount = $fpdi->setSourceFile($contentTmp);
            for ($i = 1; $i <= $contentPageCount; $i++) {
                $tpl = $fpdi->importPage($i);
                $size = $fpdi->getTemplateSize($tpl);
                $fpdi->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $fpdi->useTemplate($tpl);
            }

            // Add signed PDF pages
            $signedPath = $signedMedia->getPath();
            $signedPageCount = $fpdi->setSourceFile($signedPath);
            for ($i = 1; $i <= $signedPageCount; $i++) {
                $tpl = $fpdi->importPage($i);
                $size = $fpdi->getTemplateSize($tpl);
                $fpdi->AddPage($size['orientation'], [$size['width'], $size['height']]);
                $fpdi->useTemplate($tpl);
            }

            $mergedPdf = $fpdi->Output('', 'S');
            unlink($contentTmp);

            $filename = 'toolbox-talk-' . $toolboxTalk->meeting_date . '.pdf';

            return response($mergedPdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"{$filename}\"",
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
            ]);
        }

        $filename = 'toolbox-talk-' . $toolboxTalk->meeting_date . '.pdf';

        return response($contentPdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function downloadSignSheet(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->load('location', 'calledBy');

        $employees = collect();
        $location = $toolboxTalk->location;
        if ($location) {
            $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
            if ($kiosk) {
                $employees = $kiosk->employees()->orderBy('name')->get(['employees.id', 'name', 'preferred_name']);
            }
        }

        $html = view('pdf.toolbox-talk-sign-only', [
            'talk' => $toolboxTalk,
            'employees' => $employees,
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

        $filename = 'toolbox-talk-sign-sheet-' . $toolboxTalk->meeting_date . '.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
        ]);
    }

    public function uploadSignatures(ToolboxTalk $toolboxTalk)
    {
        $toolboxTalk->load(['location', 'attendees.employee']);

        // Get kiosk employees for this location
        $employees = collect();
        $location = $toolboxTalk->location;
        if ($location) {
            $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
            if ($kiosk) {
                $employees = $kiosk->employees()->orderBy('name')->get(['employees.id', 'name', 'preferred_name']);
            }
        }

        // Build attendee list with signed status
        $existingAttendees = $toolboxTalk->attendees->keyBy('employee_id');
        $attendeeList = $employees->map(fn ($emp) => [
            'employee_id' => $emp->id,
            'employee_name' => $emp->preferred_name ?? $emp->name,
            'signed' => $existingAttendees->get($emp->id)?->signed ?? false,
        ])->values();

        $signedPdf = $toolboxTalk->getFirstMedia('signed_pdf');

        return Inertia::render('toolbox-talks/upload-signatures', [
            'talk' => $toolboxTalk,
            'attendees' => $attendeeList,
            'signedPdf' => $signedPdf ? [
                'id' => $signedPdf->id,
                'file_name' => $signedPdf->file_name,
                'url' => $signedPdf->getUrl(),
            ] : null,
        ]);
    }

    public function storeSignatures(Request $request, ToolboxTalk $toolboxTalk)
    {
        $data = $request->validate([
            'attendees' => 'required|array',
            'attendees.*.employee_id' => 'required|exists:employees,id',
            'attendees.*.signed' => 'required|boolean',
            'signed_pdf' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        foreach ($data['attendees'] as $row) {
            ToolboxTalkAttendee::updateOrCreate(
                [
                    'toolbox_talk_id' => $toolboxTalk->id,
                    'employee_id' => $row['employee_id'],
                ],
                ['signed' => $row['signed']],
            );
        }

        if ($request->hasFile('signed_pdf')) {
            $toolboxTalk->clearMediaCollection('signed_pdf');
            $toolboxTalk->addMedia($request->file('signed_pdf'))->toMediaCollection('signed_pdf');
        }

        return redirect()->route('toolbox-talks.show', $toolboxTalk)
            ->with('success', 'Signatures updated successfully.');
    }

    private function renderPdf(string $html): string
    {
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
            ->margins(15, 19, 20, 19, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml('<div></div>')
            ->footerHtml('<div style="width:100%;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding:6px 0;"><span class="pageNumber"></span> of <span class="totalPages"></span></div>')
            ->pdf();
    }

    private function handleMediaUploads(Request $request, ToolboxTalk $talk): void
    {
        foreach (['topic_files', 'action_point_files', 'injury_files', 'near_miss_files', 'floor_comment_files'] as $collection) {
            if ($request->hasFile($collection)) {
                foreach ($request->file($collection) as $file) {
                    $talk->addMedia($file)->toMediaCollection($collection);
                }
            }
        }
    }
}
