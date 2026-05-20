<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('form_requests', 'response_snapshot')) {
                $table->json('response_snapshot')->nullable()->after('responses');
            }
        });
    }

    public function down(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'response_snapshot')) {
                $table->dropColumn('response_snapshot');
            }
        });
    }
};
