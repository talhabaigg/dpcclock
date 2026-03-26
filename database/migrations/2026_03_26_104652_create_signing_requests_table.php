<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('signing_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_template_id')->nullable()->constrained('document_templates')->nullOnDelete();
            $table->nullableMorphs('signable');
            $table->string('delivery_method');
            $table->string('token', 64)->unique();
            $table->string('status')->default('pending')->index();
            $table->foreignId('sent_by')->constrained('users');
            $table->longText('document_html');
            $table->string('document_hash')->nullable();
            $table->string('recipient_name');
            $table->string('recipient_email')->nullable();
            $table->json('custom_fields')->nullable();
            $table->string('signer_full_name')->nullable();
            $table->string('signer_ip_address')->nullable();
            $table->text('signer_user_agent')->nullable();
            $table->timestamp('signed_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('signing_requests');
    }
};
