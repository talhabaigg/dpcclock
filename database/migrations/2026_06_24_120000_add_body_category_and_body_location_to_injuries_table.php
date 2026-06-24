<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->string('body_category')->nullable()->after('description');
            $table->string('body_location')->nullable()->after('body_category');
        });
    }

    public function down(): void
    {
        Schema::table('injuries', function (Blueprint $table) {
            $table->dropColumn(['body_category', 'body_location']);
        });
    }
};
