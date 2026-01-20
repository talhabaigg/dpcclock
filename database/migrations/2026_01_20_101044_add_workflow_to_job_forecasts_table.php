<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('job_forecasts', function (Blueprint $table) {
            // Status workflow: pending -> draft -> submitted -> finalized
            $table->enum('status', ['pending', 'draft', 'submitted', 'finalized'])
                ->default('draft')
                ->after('is_locked');

            // User tracking
            $table->foreignId('created_by')->nullable()->after('status')
                ->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->after('created_by')
                ->constrained('users')->nullOnDelete();

            // Submission tracking
            $table->foreignId('submitted_by')->nullable()->after('updated_by')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable()->after('submitted_by');

            // Finalization tracking
            $table->foreignId('finalized_by')->nullable()->after('submitted_at')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('finalized_at')->nullable()->after('finalized_by');

            // Optional rejection note (for future use)
            $table->text('rejection_note')->nullable()->after('finalized_at');

            // Index for common queries
            $table->index('status');
            $table->index(['job_number', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('job_forecasts', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['job_number', 'status']);

            $table->dropForeign(['created_by']);
            $table->dropForeign(['updated_by']);
            $table->dropForeign(['submitted_by']);
            $table->dropForeign(['finalized_by']);

            $table->dropColumn([
                'status',
                'created_by',
                'updated_by',
                'submitted_by',
                'submitted_at',
                'finalized_by',
                'finalized_at',
                'rejection_note',
            ]);
        });
    }
};
