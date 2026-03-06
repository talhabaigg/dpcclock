<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('queue_job_logs', function (Blueprint $table) {
            $table->id();
            $table->string('job_id')->index();
            $table->string('job_name');
            $table->string('queue')->nullable();
            $table->string('connection')->nullable();
            $table->string('status')->index(); // pending, processing, completed, failed
            $table->text('message')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->text('exception_class')->nullable();
            $table->timestamp('logged_at')->useCurrent()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('queue_job_logs');
    }
};
