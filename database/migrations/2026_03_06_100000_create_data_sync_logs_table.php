<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->string('job_name')->unique();
            $table->timestamp('last_successful_sync')->nullable();
            $table->string('last_filter_value')->nullable();
            $table->integer('records_synced')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_sync_logs');
    }
};
