<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('location_template_allowances')) {
            return;
        }

        Schema::create('location_template_allowances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_pay_rate_template_id')
                ->constrained('location_pay_rate_templates')
                ->cascadeOnDelete();
            $table->foreignId('allowance_type_id')
                ->constrained('allowance_types')
                ->cascadeOnDelete();
            $table->decimal('rate', 10, 2);
            $table->enum('rate_type', ['hourly', 'daily', 'weekly'])->default('hourly');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // One allowance type per template configuration
            $table->unique(
                ['location_pay_rate_template_id', 'allowance_type_id'],
                'loc_tpl_allow_unique'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('location_template_allowances');
    }
};
