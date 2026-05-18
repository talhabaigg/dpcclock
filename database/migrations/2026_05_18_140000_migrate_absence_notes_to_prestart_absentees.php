<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('daily_prestart_absence_notes')
            ->whereNotNull('note')
            ->where('note', '!=', '')
            ->orderBy('id')
            ->chunkById(500, function ($rows) {
                foreach ($rows as $row) {
                    $existing = DB::table('prestart_absentees')
                        ->where('daily_prestart_id', $row->daily_prestart_id)
                        ->where('employee_id', $row->employee_id)
                        ->first();

                    if (! $existing) {
                        DB::table('prestart_absentees')->insert([
                            'daily_prestart_id' => $row->daily_prestart_id,
                            'employee_id' => $row->employee_id,
                            'reason' => null,
                            'notes' => $row->note,
                            'updated_by' => $row->updated_by,
                            'created_at' => $row->created_at,
                            'updated_at' => $row->updated_at,
                        ]);
                        continue;
                    }

                    // Preserve existing prestart_absentees.notes; only fill when empty
                    if (empty($existing->notes)) {
                        DB::table('prestart_absentees')
                            ->where('id', $existing->id)
                            ->update([
                                'notes' => $row->note,
                                'updated_at' => $row->updated_at,
                            ]);
                    }
                }
            });
    }

    public function down(): void
    {
        // No-op: data is now canonical in prestart_absentees. Reversing risks
        // losing edits made after the migration ran.
    }
};
