<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('form_requests', 'assignee_user_id')) {
                $table->foreignId('assignee_user_id')
                    ->nullable()
                    ->after('assignee_permission')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'assignee_user_id')) {
                $table->dropConstrainedForeignId('assignee_user_id');
            }
        });
    }
};
