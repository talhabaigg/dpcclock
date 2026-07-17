<?php

namespace App\Http\Controllers;

use App\Models\Drawing;
use App\Models\Location;
use App\Models\SiteTask;
use App\Services\DrawingProcessingService;
use App\Services\GetCompanyCodeService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Spatie\Browsershot\Browsershot;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Fieldwire-style PDF report for a selection of site tasks, grouped by
 * category: cover page, table of contents, one section per task (plan
 * snippet around the pin, checklist provenance, comment photos), and the
 * full marked-up sheet(s) at the end.
 */
class SiteTaskReportController extends Controller
{
    public function __construct(private DrawingProcessingService $drawings) {}

    public function generate(Request $request, Location $project): Response
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'task_ids' => ['required', 'array', 'min:1', 'max:200'],
            'task_ids.*' => ['integer'],
        ]);

        $tasks = SiteTask::whereIn('id', $validated['task_ids'])
            ->where('location_id', $project->id)
            ->with([
                'category:id,name,code,color,sort_order',
                'assignees.employee:id,name',
                'checklistItem.checklist:id,name,checkable_type',
                'parent:id,title,drawing_id,page_number,x,y',
                'comments' => fn ($q) => $q->whereNull('parent_id')->orderBy('created_at')->with('user:id,name', 'media'),
            ])
            ->get();

        abort_if($tasks->isEmpty(), 422, 'No matching tasks selected.');

        // Group by category, categories in their configured order, uncategorised last.
        $groups = $tasks
            ->sortBy([['category.sort_order', 'asc'], ['id', 'asc']])
            ->groupBy(fn ($t) => $t->category?->name ?? 'Uncategorised')
            ->map(fn ($items, $name) => [
                'name' => $name,
                'code' => $items->first()->category?->code,
                'color' => $items->first()->category?->color ?? '#6b7280',
                'tasks' => $items->map(fn ($t) => $this->presentTask($t))->values(),
            ])
            ->values();

        // Every distinct drawing pinned by the selection → final sheet pages.
        $sheets = $tasks
            ->map(fn ($t) => ['task' => $t, 'pin' => $t->effectivePin()])
            ->filter(fn ($row) => $row['pin'] !== null)
            ->groupBy(fn ($row) => $row['pin']['drawing_id'])
            ->map(function ($rows) {
                $drawing = Drawing::with('media')->find($rows->first()['pin']['drawing_id']);
                $imageUrl = $drawing ? $this->drawingImageUrl($drawing) : null;
                if (! $drawing || ! $imageUrl) {
                    return null;
                }

                // Children without their own pin inherit the parent's — merge
                // same-spot markers so they don't stack unreadably.
                $pins = $rows
                    ->groupBy(fn ($row) => round($row['pin']['x'], 4).'|'.round($row['pin']['y'], 4))
                    ->map(fn ($stack) => [
                        'label' => $stack->pluck('task.id')->implode(', '),
                        'x' => $stack->first()['pin']['x'],
                        'y' => $stack->first()['pin']['y'],
                        'color' => $stack->first()['task']->category?->color ?? '#ef4444',
                    ])
                    ->values();

                return [
                    'sheet_number' => $drawing->sheet_number,
                    'display_name' => $this->cleanLabel($drawing->display_name),
                    'image_url' => $imageUrl,
                    'pins' => $pins,
                ];
            })
            ->filter()
            ->values();

        $assigneeNames = $tasks
            ->flatMap(fn ($t) => $t->assignees->map(fn ($a) => $a->employee?->name))
            ->filter()
            ->unique()
            ->sort()
            ->values();

        $html = view('pdf.site-task-report', [
            'logoData' => $this->companyLogo($project),
            'title' => $validated['title'],
            'project' => $project,
            'creator' => $request->user()?->name,
            'createdAt' => now(),
            'dateFrom' => $tasks->min('created_at'),
            'dateTo' => $tasks->max('updated_at'),
            'statuses' => $tasks->pluck('status')->unique()->values(),
            'sheetList' => $sheets->map(fn ($s) => $s['sheet_number'] ?? $s['display_name'])->filter()->values(),
            'categoryList' => $groups->pluck('name'),
            'users' => $assigneeNames,
            'groups' => $groups,
            'sheets' => $sheets,
            'timezone' => config('app.timezone'),
        ])->render();

        $pdf = $this->renderPdf($html, $validated['title'], $project->name);

        $filename = Str::slug($validated['title'].' '.$project->name.' '.now()->format('Y-m-d'), '_').'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    private function presentTask(SiteTask $task): array
    {
        $pin = $task->effectivePin();
        $drawing = $pin ? Drawing::with('media')->find($pin['drawing_id']) : null;

        return [
            'id' => $task->id,
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'created_at' => $task->created_at,
            'category' => $task->category?->name,
            'assignees' => $task->assignees->map(fn ($a) => $a->employee?->name)->filter()->values(),
            'checklist' => $task->checklistItem?->checklist?->checkable_type === SiteTask::class
                ? ($task->checklistItem->checklist->name.': '.$task->checklistItem->label)
                : null,
            'plan_label' => $drawing ? $this->cleanLabel(trim(($drawing->sheet_number ?? '').' - '.($drawing->title ?? ''), ' -')) : null,
            'plan_image' => $drawing ? $this->drawingImageUrl($drawing) : null,
            'pin' => $pin ? ['x' => $pin['x'], 'y' => $pin['y']] : null,
            'pin_color' => $task->category?->color ?? '#ef4444',
            'messages' => $task->comments->map(fn ($c) => [
                'author' => $c->user?->name ?? 'Unknown',
                'at' => $c->created_at,
                'body' => $c->body,
                'images' => $c->getMedia('attachments')
                    ->filter(fn ($m) => str_starts_with((string) $m->mime_type, 'image/'))
                    ->map(fn ($m) => $this->mediaUrl($m))
                    ->filter()
                    ->values(),
            ])->values(),
        ];
    }

    /**
     * Full-resolution render for the report (lazily generated + cached).
     * The 1200px thumbnail is too soft for print.
     */
    private function drawingImageUrl(Drawing $drawing): ?string
    {
        try {
            $hires = $this->drawings->ensureHiResRender($drawing);
            if ($hires) {
                return $this->mediaUrl($hires);
            }
        } catch (\Throwable) {
            // fall through to thumbnail
        }

        return $drawing->thumbnail_url;
    }

    /** Company logo (by the location's parent company) as a data URI. */
    private function companyLogo(Location $project): ?string
    {
        $companyCode = (new GetCompanyCodeService)->getCompanyCode($project->eh_parent_id);
        $isGre = in_array($companyCode, ['GREEN', 'GRE'], true);

        $logoPath = public_path($isGre ? 'gre_logo.jpg' : 'logo.png');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
            $isGre = false;
        }
        if (! file_exists($logoPath)) {
            return null;
        }

        $mime = $isGre ? 'image/jpeg' : 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode(file_get_contents($logoPath));
    }

    /** Drop file-extension noise from drawing titles ("...LEVEL 11.pdf"). */
    private function cleanLabel(?string $label): ?string
    {
        return $label === null ? null : preg_replace('/\.pdf$/i', '', $label);
    }

    private function mediaUrl(Media $media): ?string
    {
        if ($media->disk === 's3') {
            try {
                return $media->getTemporaryUrl(now()->addMinutes(60));
            } catch (\Throwable) {
                return null;
            }
        }

        return $media->getUrl();
    }

    private function renderPdf(string $html, string $title, string $projectName): string
    {
        $safeTitle = e(Str::upper($title));
        $safeProject = e($projectName);
        $date = now()->format('d-m-Y');

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 15mm 4px;">
            <div style="display: flex; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #6b7280; padding-top: 6px; border-top: 1px solid #d1d5db;">
                <div style="flex: 1; text-transform: uppercase;">{$safeTitle}</div>
                <div style="text-align: center;">pg. <span class="pageNumber"></span></div>
                <div style="flex: 1; text-align: right;">Created with DPC on {$date} — {$safeProject}</div>
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
            ->margins(12, 15, 18, 15, 'mm')
            ->showBackground()
            ->waitUntilNetworkIdle()
            ->setDelay(400)
            ->showBrowserHeaderAndFooter()
            ->headerHtml('<div></div>')
            ->footerHtml($footerHtml)
            ->pdf();
    }
}
