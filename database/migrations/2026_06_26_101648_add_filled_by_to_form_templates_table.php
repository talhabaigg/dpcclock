<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_templates', function (Blueprint $table) {
            // 'subject' = filled by the entity the form is about (default — matches
            // every existing template: reference checks, applications, etc.).
            // 'user' = filled by an internal user (e.g., supervisor doing an exit
            // interview about an employee).
            $table->string('filled_by')->default('subject')->after('model_type');

            // When filled_by='user', this names the permission that gates filling.
            // When filled_by='subject', this column is unused.
            $table->string('assignee_permission')->nullable()->after('filled_by');
        });
    }

    public function down(): void
    {
        Schema::table('form_templates', function (Blueprint $table) {
            $table->dropColumn(['filled_by', 'assignee_permission']);
        });
    }
};
