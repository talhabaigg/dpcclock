<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('swms_signing_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('token', 64)->unique();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->string('delivery_method'); // ipad | qr | sms
            $table->string('recipient_phone')->nullable();
            $table->string('status')->default('pending'); // pending | opened | completed | cancelled | expired
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['location_id', 'status']);
        });

        Schema::create('swms_signing_request_versions', function (Blueprint $table) {
            $table->id();
            $table->uuid('swms_signing_request_id');
            $table->uuid('swms_version_id');
            $table->timestamps();

            $table->foreign('swms_signing_request_id', 'ssrv_request_fk')
                ->references('id')->on('swms_signing_requests')->cascadeOnDelete();
            $table->foreign('swms_version_id', 'ssrv_version_fk')
                ->references('id')->on('swms_versions')->cascadeOnDelete();

            $table->unique(['swms_signing_request_id', 'swms_version_id'], 'ssrv_unique');
        });

        Schema::create('swms_signing_request_employees', function (Blueprint $table) {
            $table->id();
            $table->uuid('swms_signing_request_id');
            $table->unsignedBigInteger('employee_id');
            $table->timestamp('signed_at')->nullable();
            $table->timestamps();

            $table->foreign('swms_signing_request_id', 'ssre_request_fk')
                ->references('id')->on('swms_signing_requests')->cascadeOnDelete();
            $table->foreign('employee_id', 'ssre_employee_fk')
                ->references('id')->on('employees')->cascadeOnDelete();

            $table->unique(['swms_signing_request_id', 'employee_id'], 'ssre_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('swms_signing_request_employees');
        Schema::dropIfExists('swms_signing_request_versions');
        Schema::dropIfExists('swms_signing_requests');
    }
};
