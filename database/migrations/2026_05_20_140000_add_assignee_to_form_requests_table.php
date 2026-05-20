<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('form_requests', 'assignee_strategy')) {
                $table->string('assignee_strategy')->nullable()->after('recipient_email');
            }
            if (! Schema::hasColumn('form_requests', 'assignee_role')) {
                $table->string('assignee_role')->nullable()->after('assignee_strategy');
            }
        });
    }

    public function down(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'assignee_role')) {
                $table->dropColumn('assignee_role');
            }
            if (Schema::hasColumn('form_requests', 'assignee_strategy')) {
                $table->dropColumn('assignee_strategy');
            }
        });
    }
};
