<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->unsignedBigInteger('employing_entity_id')->nullable()->after('employment_agreement');
            $table->string('employing_entity_name')->nullable()->after('employing_entity_id');
            $table->index('employing_entity_id');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropIndex(['employing_entity_id']);
            $table->dropColumn(['employing_entity_id', 'employing_entity_name']);
        });
    }
};
