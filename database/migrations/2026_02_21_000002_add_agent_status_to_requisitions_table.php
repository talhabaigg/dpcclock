<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('requisitions', 'agent_status')) {
            Schema::table('requisitions', function (Blueprint $table) {
                $table->string('agent_status')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('requisitions', 'agent_status')) {
            Schema::table('requisitions', function (Blueprint $table) {
                $table->dropColumn('agent_status');
            });
        }
    }
};
