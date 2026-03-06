<?php

namespace App\Http\Controllers;

use App\Models\QueueJobLog;
use Illuminate\Http\JsonResponse;
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

    public function clearFailed(): JsonResponse
    {
        $count = DB::table('failed_jobs')->count();
        DB::table('failed_jobs')->truncate();

        QueueJobLog::where('status', 'failed')->delete();

        return response()->json(['message' => "Cleared {$count} failed jobs."]);
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

        // Get the latest status per job_id from logs (last 24h)
        $cutoff = now()->subHours(24);

        $latestLogIds = QueueJobLog::select(DB::raw('MAX(id) as id'))
            ->where('logged_at', '>=', $cutoff)
            ->groupBy('job_id')
            ->pluck('id');

        $loggedJobs = QueueJobLog::whereIn('id', $latestLogIds)
            ->orderBy('logged_at', 'desc')
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
