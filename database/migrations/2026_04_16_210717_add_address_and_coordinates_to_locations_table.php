<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (! Schema::hasColumn('locations', 'address_line1')) {
                $table->string('address_line1')->nullable()->after('state');
            }
            if (! Schema::hasColumn('locations', 'city')) {
                $table->string('city')->nullable()->after('address_line1');
            }
            if (! Schema::hasColumn('locations', 'state_code')) {
                $table->string('state_code', 10)->nullable()->after('city');
            }
            if (! Schema::hasColumn('locations', 'country_code')) {
                $table->string('country_code', 10)->nullable()->after('state_code');
            }
            if (! Schema::hasColumn('locations', 'zip_code')) {
                $table->string('zip_code', 20)->nullable()->after('country_code');
            }
            if (! Schema::hasColumn('locations', 'latitude')) {
                $table->decimal('latitude', 10, 7)->nullable()->after('zip_code');
            }
            if (! Schema::hasColumn('locations', 'longitude')) {
                $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn([
                'address_line1', 'city', 'state_code', 'country_code',
                'zip_code', 'latitude', 'longitude',
            ]);
        });
    }
};
