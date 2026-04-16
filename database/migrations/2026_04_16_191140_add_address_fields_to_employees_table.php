<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('residential_street_address')->nullable()->after('date_of_birth');
            $table->string('residential_suburb')->nullable()->after('residential_street_address');
            $table->string('residential_state')->nullable()->after('residential_suburb');
            $table->string('residential_postcode')->nullable()->after('residential_state');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['residential_street_address', 'residential_suburb', 'residential_state', 'residential_postcode']);
        });
    }
};
