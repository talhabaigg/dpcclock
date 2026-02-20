<?php

namespace App\Jobs;

use App\Events\AgentTaskUpdated;
use App\Models\AgentTask;
use App\Models\Requisition;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class SendToSupplierViaAgentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 360;

    private array $eventLog = [];

    public function __construct(
        public int $agentTaskId,
        public int $requisitionId
    ) {}

    public function backoff(): array
    {
        return [60];
    }

    public function handle(): void
    {
        $task = AgentTask::findOrFail($this->agentTaskId);
        $requisition = Requisition::with(['supplier', 'location'])->findOrFail($this->requisitionId);

        $task->update([
            'status' => 'processing',
            'started_at' => now(),
        ]);
        $requisition->update(['agent_status' => 'sending']);
        event(new AgentTaskUpdated($task));

        $poNumber = 'PO'.$requisition->po_number;
        $screenshotDir = storage_path('app/agent-screenshots/'.$requisition->id);

        // Ensure screenshot directory exists
        if (! is_dir($screenshotDir)) {
            mkdir($screenshotDir, 0755, true);
        }

        $scriptPath = base_path('scripts/playwright/send-po-to-supplier.mjs');

        Log::info("Agent: Running Playwright for PO {$poNumber}", [
            'task_id' => $task->id,
            'requisition_id' => $requisition->id,
        ]);

        $totalCost = $requisition->lineItems()->sum('total_cost');
        $isDryRun = config('premier.web.dry_run');

        // Write config to temp JSON file (avoids Windows env var issues with Process::env())
        $configFile = storage_path('app/agent-config-'.$task->id.'.json');
        file_put_contents($configFile, json_encode([
            'PREMIER_WEB_URL' => config('premier.web.url'),
            'PREMIER_WEB_CLIENT_ID' => config('premier.web.client_id'),
            'PREMIER_WEB_USERNAME' => config('premier.web.username'),
            'PREMIER_WEB_PASSWORD' => config('premier.web.password'),
            'PO_NUMBER' => $poNumber,
            'TOTAL_COST' => (string) $totalCost,
            'SUPPLIER_MESSAGE' => $task->context['supplier_message'] ?? '',
            'SCREENSHOT_DIR' => $screenshotDir,
            'SESSION_DIR' => storage_path('app/playwright-session'),
            'DRY_RUN' => $isDryRun ? '1' : '0',
            'ANTHROPIC_API_KEY' => config('services.anthropic.api_key'),
        ]));

        // Start process asynchronously so we can poll progress.json for real-time updates
        $process = Process::timeout(300)
            ->start(['node', $scriptPath, '--config', $configFile]);

        // Poll progress.json every 1.5s to broadcast step updates in real-time
        $progressFile = $screenshotDir.'/progress.json';
        $lastEventCount = 0;

        while ($process->running()) {
            $this->pollProgress($progressFile, $lastEventCount, $task, $requisition, $screenshotDir);
            usleep(1500000);
        }

        // Final poll to catch any remaining events
        $this->pollProgress($progressFile, $lastEventCount, $task, $requisition, $screenshotDir);

        $result = $process->wait();

        // Clean up config file (contains credentials)
        @unlink($configFile);
        // Clean up progress file
        @unlink($progressFile);

        if ($result->successful()) {
            // Upload any remaining screenshots not yet uploaded during polling
            $s3Paths = $this->uploadScreenshots($screenshotDir, $requisition->id);

            $task->update([
                'status' => 'completed',
                'completed_at' => now(),
                'screenshots' => $s3Paths,
                'context' => array_merge($task->context ?? [], [
                    'event_log' => $this->eventLog,
                ]),
            ]);

            if ($isDryRun) {
                $requisition->update(['agent_status' => 'completed']);

                activity()
                    ->performedOn($requisition)
                    ->event('agent_dry_run_completed')
                    ->log("Agent dry run for {$poNumber} completed (email dialog opened, not sent). Screenshots: ".count($s3Paths));

                Log::info("Agent: Dry run completed for PO {$poNumber}", [
                    'task_id' => $task->id,
                    'screenshots' => count($s3Paths),
                ]);
            } else {
                $requisition->update([
                    'status' => 'sent',
                    'agent_status' => 'completed',
                ]);

                activity()
                    ->performedOn($requisition)
                    ->event('agent_sent_to_supplier')
                    ->log("Agent sent {$poNumber} to supplier via Premier web UI. Screenshots: ".count($s3Paths));

                Log::info("Agent: Successfully sent PO {$poNumber} to supplier", [
                    'task_id' => $task->id,
                    'screenshots' => count($s3Paths),
                ]);
            }

            event(new AgentTaskUpdated($task));
        } else {
            $this->handleFailure($task, $requisition, $result);
        }

        // Clean up local screenshots
        $this->cleanupLocalScreenshots($screenshotDir);
    }

    protected function pollProgress(string $progressFile, int &$lastEventCount, AgentTask $task, Requisition $requisition, string $screenshotDir): void
    {
        if (! file_exists($progressFile)) {
            return;
        }

        $progress = json_decode(@file_get_contents($progressFile), true);
        if (! $progress || empty($progress['events'])) {
            return;
        }

        $events = $progress['events'];
        if (count($events) <= $lastEventCount) {
            return;
        }

        // Broadcast all new events since last poll
        $newEvents = array_slice($events, $lastEventCount);
        $lastEventCount = count($events);

        foreach ($newEvents as $event) {
            // Thinking events (Claude's reasoning) — broadcast as-is, no screenshot
            // Collapse consecutive thinking: replace last thinking entry instead of appending
            if (($event['type'] ?? '') === 'thinking') {
                $thinkingEntry = [
                    'type' => 'thinking',
                    'text' => $event['text'] ?? '',
                    'timestamp' => $event['timestamp'] ?? now()->toISOString(),
                ];

                $lastIdx = count($this->eventLog) - 1;
                if ($lastIdx >= 0 && ($this->eventLog[$lastIdx]['type'] ?? '') === 'thinking') {
                    $this->eventLog[$lastIdx] = $thinkingEntry;
                } else {
                    $this->eventLog[] = $thinkingEntry;
                }

                event(new AgentTaskUpdated(
                    $task,
                    thinking: $event['text'] ?? '',
                ));

                continue;
            }

            // Intermediate screenshot events — upload and broadcast for live streaming
            if (($event['type'] ?? '') === 'screenshot') {
                $screenshotFile = $screenshotDir.'/'.$event['screenshot'];
                if (! empty($event['screenshot']) && file_exists($screenshotFile)) {
                    $s3Path = "agent-screenshots/{$requisition->id}/{$event['screenshot']}";
                    Storage::disk('s3')->put($s3Path, file_get_contents($screenshotFile));
                    $url = Storage::disk('s3')->temporaryUrl($s3Path, now()->addHour());

                    event(new AgentTaskUpdated(
                        $task,
                        screenshotUrl: $url,
                    ));
                }

                continue;
            }

            $screenshotUrl = null;
            if (($event['phase'] ?? 'completed') === 'completed' && ! empty($event['screenshot'])) {
                $screenshotFile = $screenshotDir.'/'.$event['screenshot'];
                if (file_exists($screenshotFile)) {
                    $s3Path = "agent-screenshots/{$requisition->id}/{$event['screenshot']}";
                    Storage::disk('s3')->put($s3Path, file_get_contents($screenshotFile));
                    $screenshotUrl = Storage::disk('s3')->temporaryUrl($s3Path, now()->addHour());
                }
            }

            // Accumulate inline thinking (attached to a step) before the step entry
            if (! empty($event['thinking'])) {
                $this->eventLog[] = [
                    'type' => 'thinking',
                    'text' => $event['thinking'],
                    'timestamp' => $event['timestamp'] ?? now()->toISOString(),
                ];
            }

            $stepEntry = [
                'type' => 'step',
                'step' => $event['step'],
                'phase' => $event['phase'] ?? 'completed',
                'totalSteps' => $progress['total_steps'] ?? 6,
                'label' => $event['label'] ?? "Step {$event['step']}",
                'timestamp' => $event['timestamp'] ?? now()->toISOString(),
            ];

            // Store S3 path so we can resolve screenshot URLs on page refresh
            if (! empty($event['screenshot'])) {
                $stepEntry['s3_path'] = "agent-screenshots/{$requisition->id}/{$event['screenshot']}";
            }

            $this->eventLog[] = $stepEntry;

            event(new AgentTaskUpdated(
                $task,
                step: $event['step'],
                totalSteps: $progress['total_steps'] ?? 6,
                stepMessage: $event['label'] ?? null,
                screenshotUrl: $screenshotUrl,
                stepPhase: $event['phase'] ?? 'completed',
                thinking: $event['thinking'] ?? null,
            ));
        }
    }

    protected function uploadScreenshots(string $dir, int $requisitionId): array
    {
        $s3Paths = [];
        $files = glob($dir.'/*.png');

        foreach ($files as $file) {
            $filename = basename($file);
            $s3Path = "agent-screenshots/{$requisitionId}/{$filename}";
            Storage::disk('s3')->put($s3Path, file_get_contents($file));
            $s3Paths[] = $s3Path;
        }

        sort($s3Paths);

        return $s3Paths;
    }

    protected function cleanupLocalScreenshots(string $dir): void
    {
        $files = glob($dir.'/*.png');
        foreach ($files as $file) {
            @unlink($file);
        }
        @rmdir($dir);
    }

    protected function handleFailure(AgentTask $task, Requisition $requisition, $result): void
    {
        $task->update([
            'retry_count' => $task->retry_count + 1,
            'context' => array_merge($task->context ?? [], [
                'last_error' => substr($result->errorOutput(), -2000),
                'last_attempt' => now()->toISOString(),
                'exit_code' => $result->exitCode(),
                'event_log' => $this->eventLog,
            ]),
        ]);

        Log::error("Agent: Playwright failed for requisition #{$requisition->id}", [
            'task_id' => $task->id,
            'stderr' => substr($result->errorOutput(), 0, 1000),
            'exit_code' => $result->exitCode(),
            'attempt' => $this->attempts(),
        ]);

        // Try to extract a clean error message from stderr (Playwright JSON output)
        $errorMessage = 'Script failed with exit code '.$result->exitCode();
        $stderr = $result->errorOutput();
        $jsonMatch = json_decode($stderr, true);
        if ($jsonMatch && isset($jsonMatch['error'])) {
            $errorMessage = $jsonMatch['error'];
        } else {
            // Try to find JSON in the last line of stderr
            $lines = array_filter(explode("\n", trim($stderr)));
            $lastLine = end($lines);
            $lastJson = json_decode($lastLine ?: '', true);
            if ($lastJson && isset($lastJson['error'])) {
                $errorMessage = $lastJson['error'];
            }
        }

        // Upload any screenshots captured before the error
        $screenshotDir = storage_path('app/agent-screenshots/'.$requisition->id);
        $this->uploadScreenshots($screenshotDir, $requisition->id);

        $task->update(['status' => 'failed']);
        $requisition->update(['agent_status' => 'failed']);

        activity()
            ->performedOn($requisition)
            ->event('agent_send_failed')
            ->log("Agent failed to send PO to supplier.");

        event(new AgentTaskUpdated($task, errorMessage: $errorMessage));

        throw new \RuntimeException('Playwright script failed: '.substr($result->errorOutput(), 0, 500));
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("Agent: SendToSupplierViaAgentJob permanently failed", [
            'task_id' => $this->agentTaskId,
            'requisition_id' => $this->requisitionId,
            'error' => $exception->getMessage(),
        ]);
    }
}
