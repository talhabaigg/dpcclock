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
        Schema::create('location_item_price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('location_id')->constrained()->onDelete('cascade');
            $table->foreignId('material_item_id')->constrained()->onDelete('cascade');
            $table->decimal('unit_cost_override', 10, 2);
            $table->boolean('is_locked')->default(false);
            $table->foreignId('changed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->enum('change_type', ['created', 'updated', 'deleted']);
            $table->timestamp('created_at')->useCurrent();

            // Indexes for common queries
            $table->index(['location_id', 'material_item_id', 'created_at'], 'lip_history_loc_mat_created_idx');
            $table->index(['location_id', 'created_at'], 'lip_history_loc_created_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('location_item_price_history');
    }
};
