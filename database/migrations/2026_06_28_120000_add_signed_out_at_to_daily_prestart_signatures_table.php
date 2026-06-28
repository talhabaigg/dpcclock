<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('daily_prestart_signatures', 'signed_out_at')) {
            Schema::table('daily_prestart_signatures', function (Blueprint $table) {
                // Physical "left the site" timestamp, captured at the kiosk for both
                // guests (tap to sign out) and employees (auto-stamped on clock-out).
                // Immutable record kept beside the amendable Clock timesheet.
                $table->timestamp('signed_out_at')->nullable()->after('signed_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('daily_prestart_signatures', 'signed_out_at')) {
            Schema::table('daily_prestart_signatures', function (Blueprint $table) {
                $table->dropColumn('signed_out_at');
            });
        }
    }
};
