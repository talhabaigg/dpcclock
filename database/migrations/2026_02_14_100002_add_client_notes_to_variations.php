<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('variations', function (Blueprint $table) {
            if (! Schema::hasColumn('variations', 'client_notes')) {
                $table->text('client_notes')->nullable()->after('markup_percentage');
            }
        });
    }

    public function down(): void
    {
        Schema::table('variations', function (Blueprint $table) {
            if (Schema::hasColumn('variations', 'client_notes')) {
                $table->dropColumn('client_notes');
            }
        });
    }
};
