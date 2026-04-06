<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('safety_data_sheets', function (Blueprint $table) {
            $table->id();
            $table->string('product_name');
            $table->string('manufacturer');
            $table->text('description')->nullable();
            $table->json('hazard_classifications')->nullable();
            $table->date('expires_at');
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('expires_at');
            $table->index('location_id');
            $table->index('manufacturer');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('safety_data_sheets');
    }
};
