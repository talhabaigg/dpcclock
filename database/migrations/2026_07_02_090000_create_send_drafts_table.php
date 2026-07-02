<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Drafts for the new dedicated "send documents" page. Isolated from
     * signing_requests (which stores single-doc legacy drafts) so the new
     * builder can persist its full multi-item state without disrupting the
     * existing modal flow. `payload` holds the whole builder JSON; autosave
     * (a fast-follow) reuses the same column.
     */
    public function up(): void
    {
        Schema::create('send_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('signable_type');
            $table->unsignedBigInteger('signable_id');
            $table->string('recipient_name')->nullable();
            $table->string('recipient_email')->nullable();
            $table->string('delivery_method')->default('email');
            $table->json('payload');
            $table->timestamps();

            $table->index(['signable_type', 'signable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('send_drafts');
    }
};
