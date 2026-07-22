<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('annotations')) {
            return;
        }

        Schema::create('annotations', function (Blueprint $table) {
            $table->id();
            // Reserved for WatermelonDB sync (schema_version >= 11); not wired yet.
            $table->string('watermelon_id', 36)->nullable()->unique();
            // Polymorphic owner. Drawings today; photos/documents can attach later
            // without schema changes (same pattern as comments/checklists).
            $table->morphs('annotatable');
            $table->unsignedSmallInteger('page_number')->nullable(); // null = page 1
            // freehand | line | arrow | double_arrow | polyline | cloud | rect | ellipse | text
            $table->string('kind', 20);
            $table->string('color', 20); // #RRGGBB
            $table->boolean('filled')->default(false); // cloud/rect/ellipse filled variants
            // Normalized 0-1 coordinates; shape varies by kind (see App\Support\Annotations).
            $table->json('geometry');
            $table->text('text')->nullable(); // text kind only
            $table->unsignedSmallInteger('font_size')->nullable();
            $table->unsignedSmallInteger('stroke_width')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('annotations');
    }
};
