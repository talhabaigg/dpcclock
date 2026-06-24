<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('production_uploads', function (Blueprint $table) {
            $table->boolean('is_bid')->default(false)->after('status');
            $table->index(['location_id', 'is_bid']);
        });
    }

    public function down(): void
    {
        Schema::table('production_uploads', function (Blueprint $table) {
            $table->dropIndex(['location_id', 'is_bid']);
            $table->dropColumn('is_bid');
        });
    }
};
