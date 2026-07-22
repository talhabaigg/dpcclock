<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('annotations', 'link_drawing_id')) {
            return;
        }

        Schema::table('annotations', function (Blueprint $table) {
            // Target of a kind='link' annotation — a plan hyperlink. nullOnDelete
            // so deleting the target plan leaves a visibly-broken link rather
            // than silently removing someone's markup.
            $table->foreignId('link_drawing_id')->nullable()->after('geometry')->constrained('drawings')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('annotations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('link_drawing_id');
        });
    }
};
