<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('form_requests', 'subject_type')) {
                $table->nullableMorphs('subject');
            }
        });
    }

    public function down(): void
    {
        Schema::table('form_requests', function (Blueprint $table) {
            if (Schema::hasColumn('form_requests', 'subject_type')) {
                $table->dropMorphs('subject');
            }
        });
    }
};
