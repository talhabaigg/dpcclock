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
        Schema::create('job_cost_details', function (Blueprint $table) {
            $table->id();
            $table->string('job_number')->nullable();
            $table->string('job_name')->nullable();
            $table->string('cost_item')->nullable();
            $table->string('cost_type')->nullable();
            $table->date('transaction_date')->nullable();
            $table->text('description')->nullable();
            $table->string('transaction_type')->nullable();
            $table->string('ref_number')->nullable();
            $table->decimal('amount', 15, 4)->nullable();
            $table->string('company_code')->nullable();
            $table->string('cost_item_description')->nullable();
            $table->string('cost_type_description')->nullable();
            $table->string('project_manager')->nullable();
            $table->decimal('quantity', 15, 4)->nullable();
            $table->decimal('unit_cost', 15, 4)->nullable();
            $table->string('vendor')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('job_cost_details');
    }
};
