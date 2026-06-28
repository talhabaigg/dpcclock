<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('whs_deliverables')) {
            Schema::create('whs_deliverables', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->foreignId('location_id')->constrained()->cascadeOnDelete();
                $table->string('type'); // plant | electrical | asset | lifting
                $table->string('name');
                $table->json('details')->nullable();   // type-specific fields
                $table->json('checklist')->nullable();  // inspection checklist (asset type)
                $table->date('last_date')->nullable();
                $table->date('next_date')->nullable();
                $table->boolean('notify')->default(true);
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->softDeletes();

                $table->index('location_id');
                $table->index('type');
                $table->index('next_date');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('whs_deliverables');
    }
};
