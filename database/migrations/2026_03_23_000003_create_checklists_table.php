<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('checklists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_template_id')->nullable()->constrained()->nullOnDelete();
            $table->string('checkable_type');
            $table->unsignedBigInteger('checkable_id');
            $table->string('name');
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['checkable_type', 'checkable_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checklists');
    }
};
