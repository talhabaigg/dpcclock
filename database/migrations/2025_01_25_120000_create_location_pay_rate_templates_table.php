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
        Schema::create('location_pay_rate_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->foreignId('pay_rate_template_id')->constrained()->onDelete('cascade');
            $table->string('custom_label')->nullable(); // e.g., "Foreman" for template "CW8"
            $table->decimal('hourly_rate', 10, 2)->nullable(); // Cached hourly rate from "Permanent Ordinary Hours"
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['location_id', 'pay_rate_template_id'], 'loc_pay_rate_tpl_unique');
            $table->index(['location_id', 'is_active', 'sort_order'], 'loc_pay_rate_tpl_active_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('location_pay_rate_templates');
    }
};
