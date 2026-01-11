<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class QueueStatusController extends Controller
{
    /**
     * Display the queue status page.
     */
    public function index(): Response
    {
        return Inertia::render('queue-status/index', [
            'initialJobs' => $this->getQueueStats(),
        ]);
    }

    /**
     * Get current queue statistics.
     */
    public function stats(): JsonResponse
    {
        return response()->json($this->getQueueStats());
    }

    /**
     * Get queue statistics from database.
     */
    protected function getQueueStats(): array
    {
        $queueConnection = config('queue.default');

        // For database queue driver
        if ($queueConnection === 'database') {
            $pendingJobs = DB::table('jobs')
                ->select('id', 'queue', 'payload', 'attempts', 'created_at', 'available_at')
                ->orderBy('created_at', 'desc')
                ->get()
                ->map(function ($job) {
                    $payload = json_decode($job->payload, true);
                    $displayName = $payload['displayName'] ?? 'Unknown Job';

                    // Extract class name if it's a full namespace
                    if (str_contains($displayName, '\\')) {
                        $displayName = class_basename($displayName);
                    }

                    return [
                        'id' => (string) $job->id,
                        'name' => $displayName,
                        'queue' => $job->queue,
                        'attempts' => $job->attempts,
                        'status' => 'pending',
                        'created_at' => $job->created_at,
                        'available_at' => $job->available_at,
                    ];
                })
                ->values()
                ->toArray();

            $failedJobs = DB::table('failed_jobs')
                ->select('id', 'uuid', 'queue', 'payload', 'exception', 'failed_at')
                ->orderBy('failed_at', 'desc')
                ->limit(50)
                ->get()
                ->map(function ($job) {
                    $payload = json_decode($job->payload, true);
                    $displayName = $payload['displayName'] ?? 'Unknown Job';

                    // Extract class name if it's a full namespace
                    if (str_contains($displayName, '\\')) {
                        $displayName = class_basename($displayName);
                    }

                    // Extract first line of exception for message
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
                ->values()
                ->toArray();

            return [
                'pending' => $pendingJobs,
                'failed' => $failedJobs,
                'stats' => [
                    'pending_count' => count($pendingJobs),
                    'failed_count' => count($failedJobs),
                ],
            ];
        }

        // For other queue drivers, return empty data
        return [
            'pending' => [],
            'failed' => [],
            'stats' => [
                'pending_count' => 0,
                'failed_count' => 0,
            ],
        ];
    }
}
