<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gl_account_groups', function (Blueprint $table) {
            // Income statement composition. Independent of account_type so the user can
            // place a "revenue" group under Other Income, or a credit-natured "revenue"
            // contra account under COGS, without affecting the budget vs actual sign flip.
            $table->string('section_type', 24)->default('operating_expense')->after('account_type');
        });

        // Seed section_type from existing account_type so the income statement isn't blank
        // immediately after the migration.
        DB::table('gl_account_groups')->where('account_type', 'revenue')->update(['section_type' => 'revenue']);
    }

    public function down(): void
    {
        Schema::table('gl_account_groups', function (Blueprint $table) {
            $table->dropColumn('section_type');
        });
    }
};
