<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add completed_at to employee_files
        Schema::table('employee_files', function (Blueprint $table) {
            $table->date('completed_at')->nullable()->after('expires_at');
        });

        // Enhance employee_file_types
        Schema::table('employee_file_types', function (Blueprint $table) {
            // Change category from string to JSON for multi-select
            $table->json('category_tags')->nullable()->after('category');
            // Add expiry requirement config
            $table->string('expiry_requirement', 20)->default('optional')->after('has_back_side');
            // Add requires_completed_date flag
            $table->boolean('requires_completed_date')->default(false)->after('expiry_requirement');
        });

        // Migrate existing category data to category_tags JSON
        $types = \DB::table('employee_file_types')->whereNotNull('category')->get();
        foreach ($types as $type) {
            \DB::table('employee_file_types')
                ->where('id', $type->id)
                ->update(['category_tags' => json_encode([$type->category])]);
        }

        // Drop old category string column
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->dropColumn('category');
        });

        // Rename category_tags to category
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->renameColumn('category_tags', 'category');
        });
    }

    public function down(): void
    {
        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->renameColumn('category', 'category_tags');
        });

        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->string('category')->nullable()->after('name');
        });

        // Migrate JSON back to string (take first value)
        $types = \DB::table('employee_file_types')->whereNotNull('category_tags')->get();
        foreach ($types as $type) {
            $tags = json_decode($type->category_tags, true);
            \DB::table('employee_file_types')
                ->where('id', $type->id)
                ->update(['category' => $tags[0] ?? null]);
        }

        Schema::table('employee_file_types', function (Blueprint $table) {
            $table->dropColumn('category_tags');
            $table->dropColumn('expiry_requirement');
            $table->dropColumn('requires_completed_date');
        });

        Schema::table('employee_files', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });
    }
};
