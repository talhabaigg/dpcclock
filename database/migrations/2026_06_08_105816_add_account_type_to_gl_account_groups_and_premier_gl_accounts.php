<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gl_account_groups', function (Blueprint $table) {
            $table->string('account_type', 16)->default('expense')->after('name');
        });

        Schema::table('premier_gl_accounts', function (Blueprint $table) {
            $table->string('account_type', 32)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('gl_account_groups', function (Blueprint $table) {
            $table->dropColumn('account_type');
        });

        Schema::table('premier_gl_accounts', function (Blueprint $table) {
            $table->dropColumn('account_type');
        });
    }
};
