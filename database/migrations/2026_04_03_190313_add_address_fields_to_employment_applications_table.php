<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employment_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('employment_applications', 'address')) {
                $table->string('address')->nullable()->after('suburb');
            }
            if (! Schema::hasColumn('employment_applications', 'state')) {
                $table->string('state', 10)->nullable()->after('address');
            }
            if (! Schema::hasColumn('employment_applications', 'postcode')) {
                $table->string('postcode', 10)->nullable()->after('state');
            }
        });
    }

    public function down(): void
    {
        Schema::table('employment_applications', function (Blueprint $table) {
            $table->dropColumn(['address', 'state', 'postcode']);
        });
    }
};
