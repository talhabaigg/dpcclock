<?php

namespace App\Jobs;

use App\Models\Clock;
use App\Models\User;
use App\Notifications\TimesheetReconciliationCompleted;
use App\Services\EhTimesheetReconciliationService;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Automated reconciliation of local clocks against Employment Hero.
 *
 * EH is the source of truth — this job NEVER mutates EH data.
 *
 * Rules applied per week:
 *   - mismatched + eh_only:  resolved by re-pulling (LoadTimesheetsFromEH overwrites/creates local)
 *   - unsynced (no eh_timesheet_id): soft-delete IFF clock_in is before today (Brisbane) AND status != 'synced'
 *     The status guard protects rows the every-15-min push job has sent but EH hasn't returned an id for yet.
 *   - ghosts (had eh_timesheet_id, no longer in EH): soft-delete unconditionally
 *
 * Safety: aborts without deleting if proposed delete count exceeds MAX_DELETES — likely indicates
 * an upstream issue (EH API empty / wrong filter) and humans should review on /timesheets-reconcile.
 */
class ReconcileTimesheetsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    public int $tries = 1;

    private const TZ = 'Australia/Brisbane';

    private const MAX_DELETES = 100;

    private const LOCK_KEY = 'reconcile-timesheets';

    private const LOCK_TTL = 600;

    public function __construct(
        public string $weekEnding,
        public int $weeks = 2,
        public ?int $triggeredByUserId = null,
    ) {
        $this->weeks = max(1, min(13, $weeks));
    }

    public function handle(EhTimesheetReconciliationService $service): void
    {
        $lock = Cache::lock(self::LOCK_KEY, self::LOCK_TTL);
        if (! $lock->get()) {
            Log::info('ReconcileTimesheetsJob: another instance is already running, skipping.');

            return;
        }

        $startedAt = Carbon::now(self::TZ);
        $summary = [
            'started_at' => $startedAt->toDateTimeString(),
            'finished_at' => null,
            'week_ending' => $this->weekEnding,
            'weeks' => $this->weeks,
            'triggered_by' => $this->triggeredByUserId ? 'user' : 'schedule',
            'per_week' => [],
            'totals' => [
                'pulled_eh_rows' => 0,
                'mismatched_resolved' => 0,
                'eh_only_pulled' => 0,
                'unsynced_deleted' => 0,
                'ghosts_deleted' => 0,
                'zombies_deleted' => 0,
                'unsynced_skipped_today' => 0,
                'unsynced_skipped_pending_eh_id' => 0,
            ],
            'aborted' => false,
            'errors' => [],
        ];

        try {
            $latest = Carbon::createFromFormat('d-m-Y', $this->weekEnding, self::TZ);
            $todayStart = Carbon::now(self::TZ)->startOfDay();

            for ($i = 0; $i < $this->weeks; $i++) {
                $we = $latest->copy()->subWeeks($i)->format('d-m-Y');
                $summary['per_week'][$we] = $this->reconcileWeek($service, $we, $todayStart, $summary);
                if ($summary['aborted']) {
                    break;
                }
            }
        } catch (Throwable $e) {
            Log::error('ReconcileTimesheetsJob failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            $summary['errors'][] = $e->getMessage();
        } finally {
            $summary['finished_at'] = Carbon::now(self::TZ)->toDateTimeString();
            optional($lock)->release();
        }

        $summary['narrative'] = $this->generateNarrative($summary);

        $this->notify($summary);
    }

    /**
     * Generate a plain-English summary of the run.
     * Returns ['headline' => string, 'details' => string] or null on failure.
     * Tries Anthropic Haiku first, then OpenAI as fallback.
     */
    private function generateNarrative(array $summary): ?array
    {
        $systemPrompt = 'You summarize payroll timesheet reconciliation runs for an admin. '
            .'Return STRICT JSON only — no markdown fences, no commentary — with two fields: '
            .'"headline" and "details". '

            ."\n\nHeadline rules: a single sentence under 90 chars suitable for a phone notification. "
            .'It MUST describe the actions taken (mismatched_resolved, eh_only_pulled, unsynced_deleted, ghosts_deleted, zombies_deleted) — not the dataset size. '
            .'Do NOT mention pulled_eh_rows or total rows scanned — that is just how much was inspected, not an action. '
            .'If every action count is zero, say "Clean run — no changes needed." Never include the date.'

            ."\n\nDetails rules: 2–3 sentences for the email body, plain English, no jargon, no bullets, no markdown. "
            .'Lead with the outcome. Name every non-zero action count. Skip every zero. '
            ."\n\nIf the run was aborted or had errors, say so first and clearly in both fields. "
            .'Never editorialize beyond the data given.';
        $userPrompt = "Reconciliation summary JSON:\n".json_encode($summary, JSON_PRETTY_PRINT);

        $raw = $this->callAnthropic($systemPrompt, $userPrompt)
            ?? $this->callOpenAi($systemPrompt, $userPrompt);

        if (! $raw) {
            return null;
        }

        $parsed = json_decode($raw, true);
        if (! is_array($parsed) || empty($parsed['headline']) || empty($parsed['details'])) {
            Log::warning('ReconcileTimesheetsJob: narrative JSON parse failed', ['raw' => $raw]);

            return null;
        }

        return [
            'headline' => trim((string) $parsed['headline']),
            'details' => trim((string) $parsed['details']),
        ];
    }

    private function callAnthropic(string $system, string $user): ?string
    {
        $apiKey = config('services.anthropic.api_key');
        if (! $apiKey) {
            return null;
        }

        try {
            $response = Http::withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])->timeout(20)->post('https://api.anthropic.com/v1/messages', [
                'model' => 'claude-haiku-4-5-20251001',
                'max_tokens' => 300,
                'system' => $system,
                'messages' => [['role' => 'user', 'content' => $user]],
            ]);

            if (! $response->successful()) {
                Log::warning('ReconcileTimesheetsJob: anthropic call failed', [
                    'status' => $response->status(), 'body' => $response->body(),
                ]);

                return null;
            }

            $text = $response->json('content.0.text');

            return is_string($text) ? trim($text) : null;
        } catch (Throwable $e) {
            Log::warning('ReconcileTimesheetsJob: anthropic threw', ['error' => $e->getMessage()]);

            return null;
        }
    }

    private function callOpenAi(string $system, string $user): ?string
    {
        $apiKey = config('services.openai.api_key');
        if (! $apiKey) {
            return null;
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$apiKey,
                'content-type' => 'application/json',
            ])->timeout(20)->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4.1-mini',
                'max_tokens' => 400,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    ['role' => 'system', 'content' => $system],
                    ['role' => 'user', 'content' => $user],
                ],
            ]);

            if (! $response->successful()) {
                Log::warning('ReconcileTimesheetsJob: openai call failed', [
                    'status' => $response->status(), 'body' => $response->body(),
                ]);

                return null;
            }

            $text = $response->json('choices.0.message.content');

            return is_string($text) ? trim($text) : null;
        } catch (Throwable $e) {
            Log::warning('ReconcileTimesheetsJob: openai threw', ['error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Reconcile a single week. Mutates $summary by reference for running totals.
     */
    private function reconcileWeek(
        EhTimesheetReconciliationService $service,
        string $weekEnding,
        Carbon $todayStart,
        array &$summary,
    ): array {
        $weekResult = [
            'pulled_eh_rows' => 0,
            'mismatched_resolved' => 0,
            'eh_only_pulled' => 0,
            'unsynced_deleted' => 0,
            'ghosts_deleted' => 0,
            'zombies_deleted' => 0,
            'unsynced_skipped_today' => 0,
            'unsynced_skipped_pending_eh_id' => 0,
            'error' => null,
        ];

        try {
            // 1. Pre-diff to know what was mismatched / eh_only BEFORE we pull.
            $preDiff = $service->diffWeek($weekEnding);
            $preMismatched = (int) ($preDiff['counts']['mismatched'] ?? 0);
            $preEhOnly = (int) ($preDiff['counts']['eh_only'] ?? 0);

            // 2. Pull from EH — overwrites mismatched local rows and creates eh-only locally.
            (new LoadTimesheetsFromEH($weekEnding))->handle();

            // 3. Post-diff for the cleanup phase (unsynced + ghosts).
            $postDiff = $service->diffWeek($weekEnding);
            $weekResult['pulled_eh_rows'] = (int) ($postDiff['counts']['eh'] ?? 0);
            $weekResult['mismatched_resolved'] = $preMismatched;
            $weekResult['eh_only_pulled'] = $preEhOnly;

            // 4. Identify unsynced rows safe to delete.
            //    Special case: a "zombie" unsynced row is one where another local clock
            //    exists for the same (employee, clock_in) that DOES have eh_timesheet_id.
            //    The linked sibling is the canonical record; the orphan was a failed push
            //    or a duplicate. Safe to delete regardless of status.
            $unsyncedToDelete = [];
            $zombiesToDelete = [];
            foreach ($postDiff['unsynced'] as $row) {
                $clockIn = $row['clock_in'] ? Carbon::parse($row['clock_in'], self::TZ) : null;
                $status = strtolower((string) ($row['status'] ?? ''));

                $hasLinkedSibling = $clockIn && Clock::where('eh_employee_id', $row['eh_employee_id'])
                    ->where('clock_in', $clockIn->toDateTimeString())
                    ->whereNotNull('eh_timesheet_id')
                    ->where('id', '!=', (int) $row['id'])
                    ->exists();

                if ($hasLinkedSibling) {
                    $zombiesToDelete[] = (int) $row['id'];

                    continue;
                }

                if (! $clockIn || $clockIn->gte($todayStart)) {
                    $weekResult['unsynced_skipped_today']++;

                    continue;
                }
                if ($status === 'synced') {
                    // Push job sent it; EH hasn't returned an id yet — never auto-delete these.
                    $weekResult['unsynced_skipped_pending_eh_id']++;

                    continue;
                }

                $unsyncedToDelete[] = (int) $row['id'];
            }

            // 5. Ghost rows — always safe to delete (EH had them, EH no longer does).
            $ghostsToDelete = array_map(fn ($r) => (int) $r['id'], $postDiff['orphaned']);

            // 6. Safety: refuse to delete an implausibly large batch.
            $proposed = count($unsyncedToDelete) + count($ghostsToDelete) + count($zombiesToDelete);
            if ($proposed > self::MAX_DELETES) {
                $summary['aborted'] = true;
                $summary['errors'][] = sprintf(
                    'Aborted week %s — proposed deletes (%d) exceed safety cap (%d). Review /timesheets-reconcile manually.',
                    $weekEnding, $proposed, self::MAX_DELETES,
                );
                $weekResult['error'] = 'aborted by safety cap';

                return $weekResult;
            }

            // 7. Apply soft-deletes in a transaction.
            DB::transaction(function () use ($unsyncedToDelete, $ghostsToDelete, $zombiesToDelete, &$weekResult) {
                if ($unsyncedToDelete) {
                    $weekResult['unsynced_deleted'] = Clock::whereIn('id', $unsyncedToDelete)->delete();
                }
                if ($ghostsToDelete) {
                    $weekResult['ghosts_deleted'] = Clock::whereIn('id', $ghostsToDelete)->delete();
                }
                if ($zombiesToDelete) {
                    $weekResult['zombies_deleted'] = Clock::whereIn('id', $zombiesToDelete)->delete();
                }
            });

            // 8. Roll into running totals.
            foreach (['pulled_eh_rows', 'mismatched_resolved', 'eh_only_pulled', 'unsynced_deleted', 'ghosts_deleted', 'zombies_deleted', 'unsynced_skipped_today', 'unsynced_skipped_pending_eh_id'] as $k) {
                $summary['totals'][$k] += $weekResult[$k];
            }
        } catch (Throwable $e) {
            Log::error("ReconcileTimesheetsJob: week {$weekEnding} failed", ['error' => $e->getMessage()]);
            $weekResult['error'] = $e->getMessage();
            $summary['errors'][] = "week {$weekEnding}: ".$e->getMessage();
        }

        return $weekResult;
    }

    private function notify(array $summary): void
    {
        $recipients = $this->triggeredByUserId
            ? User::where('id', $this->triggeredByUserId)->get()
            : User::role('admin')->get();

        if ($recipients->isEmpty()) {
            Log::warning('ReconcileTimesheetsJob: no notification recipients found.', ['summary' => $summary]);

            return;
        }

        foreach ($recipients as $user) {
            $user->notify(new TimesheetReconciliationCompleted($summary));
        }
    }
}
