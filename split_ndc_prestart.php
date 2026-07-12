<?php

/**
 * Split NEXTDC prestart 019f461a-23ba-713f-a5e5-8c0e8a3c5ce0 into two records.
 *
 * Background: created 2026-07-09 for work_date 2026-07-10; 24 workers signed
 * on the 10th; at 08:55 on the 10th the record was edited in place to become
 * the 13 July prestart (work_date + activities changed, weather nulled);
 * 5 more workers then signed it on the 13th.
 *
 * This script:
 *   1. Reverts the original record to its end-of-Friday (10 July) state,
 *      taken from the "old" side of the 08:55 activity-log entry (which
 *      matches the last Friday signer's content_snapshot).
 *   2. Creates a new 13 July prestart carrying the current (Monday) content.
 *   3. Moves the 5 signatures signed on 2026-07-13 onto the new record.
 *
 * Absentees (7 rows, all recorded Friday morning) stay on the original via
 * daily_prestart_id. Trainings are keyed by location+date (none either day).
 * No comments/media/absence-notes exist on this record.
 *
 * Run: php artisan tinker --execute="require 'split_ndc_prestart.php';"
 */

use App\Models\DailyPrestart;
use App\Models\DailyPrestartSignature;
use Spatie\Activitylog\Models\Activity;

$PRESTART_ID = '019f461a-23ba-713f-a5e5-8c0e8a3c5ce0';

DB::transaction(function () use ($PRESTART_ID) {
    $original = DailyPrestart::withTrashed()->lockForUpdate()->findOrFail($PRESTART_ID);

    // --- Sanity checks: bail out loudly if prod doesn't look like we expect ---
    $workDate = $original->work_date instanceof \Carbon\Carbon
        ? $original->work_date->format('Y-m-d') : (string) $original->work_date;
    if ($workDate !== '2026-07-13') {
        throw new RuntimeException("Expected work_date 2026-07-13, got {$workDate} — already fixed?");
    }

    $edit = Activity::where('log_name', 'daily_prestart')
        ->where('subject_type', DailyPrestart::class)
        ->where('subject_id', $original->id)
        ->where('event', 'updated')
        ->where('created_at', '2026-07-10 08:55:48')
        ->firstOrFail();

    $old = $edit->properties['old'];
    if (($old['work_date'] ?? null) !== '2026-07-10') {
        throw new RuntimeException('08:55 log entry does not contain the expected old work_date.');
    }

    $mondaySignatures = DailyPrestartSignature::where('daily_prestart_id', $original->id)
        ->whereDate('signed_at', '2026-07-13')->get();
    $fridayCount = DailyPrestartSignature::where('daily_prestart_id', $original->id)
        ->whereDate('signed_at', '2026-07-10')->count();
    // More workers may sign on the 13th before this runs — move all of them.
    if ($mondaySignatures->count() < 5 || $fridayCount !== 24) {
        throw new RuntimeException("Expected 24 Friday + >=5 Monday signatures, got {$fridayCount} + {$mondaySignatures->count()}.");
    }

    // --- Capture current (Monday) content before reverting ---
    $mondayContent = [
        'location_id' => $original->location_id,
        'work_date' => '2026-07-13',
        'foreman_id' => $original->foreman_id,
        'created_by' => $original->created_by,
        'is_active' => $original->is_active,
        'weather' => $original->weather,               // fetched 2026-07-13 06:08:53
        'weather_impact' => $original->weather_impact,
        'activities' => $original->activities,
        'safety_concerns' => $original->safety_concerns,
    ];

    // --- 1. Revert original to end-of-Friday state (from the 08:55 log "old" side) ---
    // Must happen before the insert: unique index on (location_id, work_date).
    $original->update([
        'work_date' => '2026-07-10',
        'activities' => $old['activities'],
        'weather' => $old['weather'],                  // fetched 2026-07-10 06:10:09
        'safety_concerns' => $old['safety_concerns'],  // null
    ]);

    // --- 2. Create the 13 July prestart with Monday's content ---
    $monday = DailyPrestart::create($mondayContent);

    // --- 3. Move Monday's signatures across ---
    DailyPrestartSignature::whereIn('id', $mondaySignatures->pluck('id'))
        ->update(['daily_prestart_id' => $monday->id]);

    echo "Original {$original->id}: work_date={$original->fresh()->work_date}, "
        .'signatures='.$original->signatures()->count()
        .', absentees='.DB::table('prestart_absentees')->where('daily_prestart_id', $original->id)->count()."\n";
    echo "New {$monday->id}: work_date={$monday->work_date}, "
        .'signatures='.$monday->signatures()->count()."\n";
});
