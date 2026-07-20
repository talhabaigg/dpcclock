<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('form_requests', 'submitted_by')) {
                // Null for public token submissions (guest recipient). Set for
                // authenticated in-app submissions so the record credits the
                // actual submitter, not the creation-time recipient/assignee.
                $table->foreignId('submitted_by')
                    ->nullable()
                    ->after('submitted_at')
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'submitted_by')) {
                $table->dropConstrainedForeignId('submitted_by');
            }
        });
    }
};
