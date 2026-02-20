<?php

namespace App\Http\Controllers;

use App\Events\AgentTaskUpdated;
use App\Jobs\SendToSupplierViaAgentJob;
use App\Models\AgentTask;
use App\Models\Requisition;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AgentTaskController extends Controller
{
    /**
     * Confirm sending PO to supplier. Dispatches the Playwright job.
     */
    public function confirm(Request $request, int $taskId)
    {
        $request->validate([
            'supplier_message' => 'nullable|string|max:1000',
        ]);

        $task = AgentTask::findOrFail($taskId);

        if ($task->status !== 'awaiting_confirmation') {
            return back()->with('error', 'This task is no longer awaiting confirmation.');
        }

        $task->update([
            'status' => 'pending',
            'confirmed_by' => auth()->id(),
            'confirmed_at' => now(),
            'context' => array_merge($task->context ?? [], [
                'supplier_message' => $request->input('supplier_message', ''),
            ]),
        ]);

        $requisition = $task->requisition;
        $requisition->update(['agent_status' => 'sending']);

        activity()
            ->performedOn($requisition)
            ->event('agent_send_confirmed')
            ->causedBy(auth()->user())
            ->log("Agent send to supplier confirmed by ".auth()->user()->name);

        event(new AgentTaskUpdated($task));

        SendToSupplierViaAgentJob::dispatch($task->id, $requisition->id);

        return back()->with('success', 'Agent is sending the PO to the supplier.');
    }

    /**
     * Cancel the agent task. User wants to send manually.
     */
    public function cancel(int $taskId)
    {
        $task = AgentTask::findOrFail($taskId);

        if (in_array($task->status, ['completed', 'cancelled'])) {
            return back()->with('error', 'This task is already finished.');
        }

        $task->update(['status' => 'cancelled']);
        $task->requisition->update(['agent_status' => null]);

        activity()
            ->performedOn($task->requisition)
            ->event('agent_task_cancelled')
            ->causedBy(auth()->user())
            ->log("Agent task #{$task->id} cancelled by ".auth()->user()->name);

        event(new AgentTaskUpdated($task));

        return back()->with('success', 'Agent task cancelled. You can send the PO manually.');
    }

    /**
     * Retry a failed agent task. Creates a new task in awaiting_confirmation state.
     */
    public function retry(int $taskId)
    {
        $task = AgentTask::findOrFail($taskId);

        if ($task->status !== 'failed') {
            return back()->with('error', 'Only failed tasks can be retried.');
        }

        $requisition = $task->requisition;

        // Cancel the old task
        $task->update(['status' => 'cancelled']);

        // Create a new task in awaiting_confirmation
        $newTask = AgentTask::create([
            'requisition_id' => $requisition->id,
            'type' => 'send_to_supplier',
            'status' => 'awaiting_confirmation',
            'context' => $task->context,
        ]);

        $requisition->update(['agent_status' => 'awaiting_confirmation']);

        activity()
            ->performedOn($requisition)
            ->event('agent_task_retried')
            ->causedBy(auth()->user())
            ->log("Agent task retried by ".auth()->user()->name);

        event(new AgentTaskUpdated($newTask));

        return back()->with('success', 'Agent task reset. Please confirm to retry.');
    }

    /**
     * Get signed S3 URLs for the task screenshots.
     */
    public function screenshots(int $taskId)
    {
        $task = AgentTask::findOrFail($taskId);

        if (! $task->screenshots || empty($task->screenshots)) {
            return response()->json(['screenshots' => []]);
        }

        $screenshots = collect($task->screenshots)->map(function ($path) {
            return [
                'path' => $path,
                'url' => Storage::disk('s3')->temporaryUrl($path, now()->addMinutes(30)),
                'label' => $this->getScreenshotLabel($path),
            ];
        });

        return response()->json(['screenshots' => $screenshots]);
    }

    /**
     * Get current step progress for a running or completed task.
     * Used as fallback when user loads page mid-run (missed WebSocket events).
     */
    public function progress(int $taskId)
    {
        $task = AgentTask::findOrFail($taskId);
        $requisition = $task->requisition;

        $steps = [];

        if (in_array($task->status, ['completed', 'failed']) && $task->screenshots) {
            // Task is done/failed — return ALL screenshots with labels
            $labelMap = [
                '00-page-loaded' => 'Page loaded',
                '00b-form-filled' => 'Login form filled',
                '01-dashboard' => 'Logged in',
                '01b-menu-opened' => 'Menu opened',
                '01c-po-submenu' => 'PO submenu',
                '02-po-navigation' => 'Navigating to POs',
                '02-po-list' => 'Reached Purchase Orders',
                '03a-filter-opened' => 'Filter opened',
                '03b-po-filtered' => 'Found PO',
                '04-po-selected' => 'PO selected',
                '05-more-actions' => 'More Actions dropdown',
                '05b-after-click' => 'After EMAIL click',
                '06-email-dialog' => 'Email dialog ready',
                '05b-approval' => 'Approval dialog ready',
                '07-completed' => 'PO sent to supplier',
            ];

            $allSteps = [];
            $stepNum = 1;
            foreach ($task->screenshots as $s3Path) {
                $filename = pathinfo(basename($s3Path), PATHINFO_FILENAME);
                $label = $labelMap[$filename] ?? str_replace('-', ' ', $filename);
                $allSteps[] = [
                    'step' => $stepNum,
                    'phase' => 'completed',
                    'total_steps' => count($task->screenshots),
                    'label' => $label,
                    'screenshot_url' => Storage::disk('s3')->temporaryUrl($s3Path, now()->addMinutes(30)),
                    'timestamp' => $task->completed_at?->toISOString(),
                ];
                $stepNum++;
            }

            $steps = $allSteps;
        } elseif ($task->status === 'processing') {
            // Task is running — read progress.json events array
            $screenshotDir = storage_path('app/agent-screenshots/'.$requisition->id);
            $progressFile = $screenshotDir.'/progress.json';

            if (file_exists($progressFile)) {
                $progress = json_decode(file_get_contents($progressFile), true);
                if ($progress && ! empty($progress['events'])) {
                    foreach ($progress['events'] as $event) {
                        // Skip thinking-only events (no step field)
                        if (($event['type'] ?? '') === 'thinking' || ! isset($event['step'])) {
                            continue;
                        }

                        $screenshotUrl = null;
                        if (($event['phase'] ?? 'completed') === 'completed' && ! empty($event['screenshot'])) {
                            $s3Path = "agent-screenshots/{$requisition->id}/{$event['screenshot']}";
                            if (Storage::disk('s3')->exists($s3Path)) {
                                $screenshotUrl = Storage::disk('s3')->temporaryUrl($s3Path, now()->addMinutes(30));
                            }
                        }

                        $steps[] = [
                            'step' => $event['step'],
                            'phase' => $event['phase'] ?? 'completed',
                            'total_steps' => $progress['total_steps'] ?? 6,
                            'label' => $event['label'],
                            'screenshot_url' => $screenshotUrl,
                            'timestamp' => $event['timestamp'] ?? now()->toISOString(),
                        ];
                    }
                }
            }
        }

        // Resolve S3 paths in event_log to temporary URLs
        $eventLog = $task->context['event_log'] ?? null;
        if ($eventLog) {
            $eventLog = array_map(function ($entry) {
                if (! empty($entry['s3_path']) && Storage::disk('s3')->exists($entry['s3_path'])) {
                    $entry['screenshot_url'] = Storage::disk('s3')->temporaryUrl($entry['s3_path'], now()->addMinutes(30));
                }

                return $entry;
            }, $eventLog);
        }

        return response()->json([
            'steps' => $steps,
            'current_step' => count($steps),
            'total_steps' => ! empty($steps) ? $steps[0]['total_steps'] : 6,
            'status' => $task->status,
            'event_log' => $eventLog,
        ]);
    }

    protected function findScreenshotForStep(string $dir, int $step): ?string
    {
        $stepMap = [
            1 => '01-dashboard.png',
            2 => '02-po-list.png',
            3 => '03b-po-filtered.png',
            4 => '04-po-selected.png',
            5 => '06-email-dialog.png',
            6 => '07-completed.png',
        ];

        $filename = $stepMap[$step] ?? null;

        return $filename && file_exists($dir.'/'.$filename) ? $filename : null;
    }

    protected function getStepLabel(int $step): string
    {
        $labels = [
            1 => 'Logged in',
            2 => 'Reached Purchase Orders',
            3 => 'Found PO',
            4 => 'PO selected',
            5 => 'Email dialog ready',
            6 => 'PO sent to supplier',
        ];

        return $labels[$step] ?? "Step {$step}";
    }

    protected function getScreenshotLabel(string $path): string
    {
        $filename = basename($path);

        return match (true) {
            str_contains($filename, '00-page') => 'Logging into Premier',
            str_contains($filename, '01-dashboard') => 'Login successful',
            str_contains($filename, '02-po') => 'Navigating to Purchase Orders',
            str_contains($filename, '03') => 'Filtering for PO',
            str_contains($filename, '04-po-selected') => 'PO selected',
            str_contains($filename, '05-more-actions') => 'Clicking send action',
            str_contains($filename, '06-email') => 'Email dialog',
            str_contains($filename, '07-completed') => 'PO sent to supplier',
            default => $filename,
        };
    }
}
