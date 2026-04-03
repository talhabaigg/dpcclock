<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employment_applications', function (Blueprint $table) {
            $table->decimal('latitude', 10, 7)->nullable()->after('suburb');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->timestamp('geocoded_at')->nullable()->after('longitude');
        });
    }

    public function down(): void
    {
        Schema::table('employment_applications', function (Blueprint $table) {
            $table->dropColumn(['latitude', 'longitude', 'geocoded_at']);
        });
    }
};
