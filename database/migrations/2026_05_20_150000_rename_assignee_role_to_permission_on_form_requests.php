<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'assignee_role') && ! Schema::hasColumn('form_requests', 'assignee_permission')) {
                $table->renameColumn('assignee_role', 'assignee_permission');
            }
        });
    }

    public function down(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'assignee_permission') && ! Schema::hasColumn('form_requests', 'assignee_role')) {
                $table->renameColumn('assignee_permission', 'assignee_role');
            }
        });
    }
};
