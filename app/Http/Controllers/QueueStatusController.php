<?php

namespace App\Http\Controllers;

use App\Models\QueueJobLog;
use App\Services\JobFailureAiSummarizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QueueStatusController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('queue-status/index', [
            'initialJobs' => $this->getQueueStats(),
        ]);
    }

    public function stats(): JsonResponse
    {
        return response()->json($this->getQueueStats());
    }

    public function clearQueue(): JsonResponse
    {
        $count = DB::table('jobs')->count();
        DB::table('jobs')->truncate();

        return response()->json(['message' => "Cleared {$count} pending jobs."]);
    }

    public function restartQueue(): JsonResponse
    {
        Artisan::call('queue:restart');

        $stuckCount = QueueJobLog::where('status', 'processing')->count();
        QueueJobLog::where('status', 'processing')->delete();

        $reservedReleased = DB::table('jobs')
            ->whereNotNull('reserved_at')
            ->update(['reserved_at' => null, 'attempts' => DB::raw('attempts + 1')]);

        return response()->json([
            'message' => "Workers signalled to restart. Cleared {$stuckCount} stuck processing entries and released {$reservedReleased} reserved jobs.",
        ]);
    }

    public function clearFailed(): JsonResponse
    {
        $count = DB::table('failed_jobs')->count();
        DB::table('failed_jobs')->truncate();

        QueueJobLog::where('status', 'failed')->delete();

        return response()->json(['message' => "Cleared {$count} failed jobs."]);
    }

    public function clearCompleted(): JsonResponse
    {
        $count = QueueJobLog::where('status', 'completed')->count();
        QueueJobLog::where('status', 'completed')->delete();

        return response()->json(['message' => "Cleared {$count} completed job logs."]);
    }

    public function clearJobLogs(): JsonResponse
    {
        $count = DB::table('queue_job_logs')->count();
        DB::table('queue_job_logs')->truncate();

        return response()->json(['message' => "Cleared {$count} job log entries."]);
    }

    public function clearLogs(): JsonResponse
    {
        $logFile = storage_path('logs/laravel.log');
        if (file_exists($logFile)) {
            file_put_contents($logFile, '');
        }

        return response()->json(['message' => 'Logs cleared.']);
    }

    public function viewLogs(): JsonResponse
    {
        $logFile = storage_path('logs/laravel.log');

        if (!file_exists($logFile)) {
            return response()->json(['content' => '', 'size' => 0]);
        }

        $size = filesize($logFile);
        $maxBytes = 500 * 1024; // 500KB tail

        if ($size > $maxBytes) {
            $handle = fopen($logFile, 'r');
            fseek($handle, -$maxBytes, SEEK_END);
            fgets($handle); // skip partial line
            $content = fread($handle, $maxBytes);
            fclose($handle);
        } else {
            $content = file_get_contents($logFile);
        }

        return response()->json([
            'content' => $content,
            'size' => $size,
            'truncated' => $size > $maxBytes,
        ]);
    }

    public function downloadLogs()
    {
        $logFile = storage_path('logs/laravel.log');

        if (!file_exists($logFile)) {
            return response()->json(['message' => 'No log file found.'], 404);
        }

        return response()->download($logFile, 'laravel-' . now()->format('Y-m-d-His') . '.log');
    }

    /**
     * Fetch the full exception text (stack trace) for a failed job stored in failed_jobs.
     * Lookups by uuid; returns null fields when the row only exists in queue_job_logs
     * (which doesn't capture the full trace).
     */
    public function failedJobDetails(string $uuid): JsonResponse
    {
        $row = DB::table('failed_jobs')
            ->where('uuid', $uuid)
            ->select('uuid', 'queue', 'payload', 'exception', 'failed_at')
            ->first();

        if (! $row) {
            return response()->json([
                'uuid' => $uuid,
                'available' => false,
                'exception' => null,
                'payload' => null,
            ]);
        }

        return response()->json([
            'uuid' => $row->uuid,
            'available' => true,
            'queue' => $row->queue,
            'failed_at' => $row->failed_at,
            'exception' => $row->exception,
            'payload' => $row->payload,
        ]);
    }

    /**
     * Re-queue a failed job by its uuid (equivalent to `php artisan queue:retry {uuid}`).
     */
    public function retryFailedJob(string $uuid): JsonResponse
    {
        $exists = DB::table('failed_jobs')->where('uuid', $uuid)->exists();
        if (! $exists) {
            return response()->json([
                'message' => 'Failed job not found (it may have already been retried or cleared).',
            ], 404);
        }

        Artisan::call('queue:retry', ['id' => [$uuid]]);

        return response()->json([
            'message' => 'Job re-queued. It will run again as soon as a worker picks it up.',
        ]);
    }

    /**
     * Ask OpenAI for a likely root cause + next step given the failed job details.
     * Cached per (job + exception) for the configured throttle window so re-opening
     * the dialog (or multiple admins opening it) doesn't burn tokens.
     */
    public function analyzeFailedJob(Request $request, JobFailureAiSummarizer $summarizer): JsonResponse
    {
        $validated = $request->validate([
            'job_name' => 'required|string|max:255',
            'exception_class' => 'nullable|string|max:255',
            'message' => 'nullable|string|max:8000',
            'stack_snippet' => 'nullable|string|max:4000',
        ]);

        $jobName = $validated['job_name'];
        $exceptionClass = $validated['exception_class'] ?? 'Unknown';
        $message = $validated['message'] ?? '';
        $stackSnippet = $validated['stack_snippet'] ?? null;

        $cacheTtl = max(5, (int) config('queue-failure-alerts.throttle_minutes', 30));
        $cacheKey = 'queue-failure-ai-summary:' . md5($jobName . '|' . $exceptionClass . '|' . $message);

        $cached = Cache::get($cacheKey);
        if ($cached) {
            return response()->json([
                'summary' => $cached,
                'cached' => true,
            ]);
        }

        $summary = $summarizer->summarize($jobName, $exceptionClass, $message, $stackSnippet);

        if (! $summary) {
            return response()->json([
                'summary' => null,
                'cached' => false,
                'error' => 'AI summary unavailable. Check OPENAI_API_KEY and queue-failure-alerts.ai_summary config.',
            ], 200);
        }

        Cache::put($cacheKey, $summary, now()->addMinutes($cacheTtl));

        return response()->json([
            'summary' => $summary,
            'cached' => false,
        ]);
    }

    protected function getQueueStats(): array
    {
        // Pending jobs from the actual jobs table (source of truth)
        $pendingJobs = [];
        if (config('queue.default') === 'database') {
            $pendingJobs = DB::table('jobs')
                ->select('id', 'queue', 'payload', 'attempts', 'created_at', 'available_at')
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($job) {
                    $payload = json_decode($job->payload, true);
                    $displayName = $payload['displayName'] ?? 'Unknown Job';

                    if (str_contains($displayName, '\\')) {
                        $displayName = class_basename($displayName);
                    }

                    return [
                        'id' => (string) $job->id,
                        'name' => $displayName,
                        'queue' => $job->queue,
                        'attempts' => $job->attempts,
                        'status' => 'pending',
                        'created_at' => date('Y-m-d\TH:i:s', $job->created_at),
                        'available_at' => date('Y-m-d\TH:i:s', $job->available_at),
                    ];
                })
                ->values()
                ->toArray();
        }

        // Get the latest status per job_id from logs (last 2h, capped at 100)
        $cutoff = now()->subHours(2);

        $latestLogIds = QueueJobLog::select(DB::raw('MAX(id) as id'))
            ->where('logged_at', '>=', $cutoff)
            ->groupBy('job_id')
            ->pluck('id');

        $loggedJobs = QueueJobLog::whereIn('id', $latestLogIds)
            ->orderBy('logged_at', 'desc')
            ->limit(200)
            ->get();

        $processing = [];
        $completed = [];
        $failed = [];

        foreach ($loggedJobs as $log) {
            $item = [
                'id' => $log->job_id,
                'name' => $log->job_name,
                'queue' => $log->queue,
                'status' => $log->status,
                'message' => $log->message,
                'attempts' => $log->attempts,
                'timestamp' => $log->logged_at->toISOString(),
                'metadata' => [
                    'queue' => $log->queue,
                    'connection' => $log->connection,
                    'attempts' => $log->attempts,
                    'exception' => $log->exception_class,
                ],
            ];

            match ($log->status) {
                'processing' => $processing[] = $item,
                'completed' => $completed[] = $item,
                'failed' => $failed[] = $item,
                default => null,
            };
        }

        // Remove jobs from pending that are already processing (still in jobs table until done)
        $processingIds = collect($processing)->pluck('id')->toArray();
        $pendingJobs = array_values(array_filter($pendingJobs, fn ($job) => !in_array($job['id'], $processingIds)));

        // Merge failed_jobs table for pre-existing failures not yet in logs
        $loggedFailedIds = collect($failed)->pluck('id')->toArray();
        $dbFailed = DB::table('failed_jobs')
            ->select('id', 'uuid', 'queue', 'payload', 'exception', 'failed_at')
            ->orderBy('failed_at', 'desc')
            ->limit(50)
            ->get()
            ->map(function ($job) {
                $payload = json_decode($job->payload, true);
                $displayName = $payload['displayName'] ?? 'Unknown Job';

                if (str_contains($displayName, '\\')) {
                    $displayName = class_basename($displayName);
                }

                $exceptionLines = explode("\n", $job->exception);
                $exceptionMessage = $exceptionLines[0] ?? 'Unknown error';

                return [
                    'id' => (string) $job->uuid,
                    'name' => $displayName,
                    'queue' => $job->queue,
                    'status' => 'failed',
                    'message' => $exceptionMessage,
                    'failed_at' => $job->failed_at,
                ];
            })
            ->filter(fn ($job) => !in_array($job['id'], $loggedFailedIds))
            ->values()
            ->toArray();

        $allFailed = array_merge($failed, $dbFailed);

        return [
            'pending' => $pendingJobs,
            'processing' => $processing,
            'completed' => $completed,
            'failed' => $allFailed,
            'stats' => [
                'pending_count' => count($pendingJobs),
                'processing_count' => count($processing),
                'completed_count' => count($completed),
                'failed_count' => count($allFailed),
            ],
        ];
    }
}
