<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->string('emergency_services_details', 500)->nullable()->after('emergency_services');
            $table->string('treatment_type')->nullable()->after('emergency_services_details');
            $table->string('treatment_details', 500)->nullable()->after('treatment_type');
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dropColumn(['emergency_services_details', 'treatment_type', 'treatment_details']);
        });
    }
};
