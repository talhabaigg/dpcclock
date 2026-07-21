<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Predefined task titles offered when creating a site task. Scoped to a
     * category (null = offered under every category) so the pickers can show
     * a short, relevant list after the category is chosen.
     */
    public function up(): void
    {
        Schema::create('site_task_title_presets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()
                ->constrained('site_task_categories')->cascadeOnDelete();
            $table->string('title', 200);
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['category_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_task_title_presets');
    }
};
