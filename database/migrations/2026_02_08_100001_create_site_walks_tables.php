<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('site_walks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('locations')->onDelete('cascade');
            $table->string('name');
            $table->text('description')->nullable();
            $table->date('walk_date');
            $table->string('status')->default('in_progress'); // in_progress, completed, archived
            $table->unsignedInteger('photo_count')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index('project_id');
            $table->index('status');
        });

        Schema::create('site_walk_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('site_walk_id')->constrained('site_walks')->onDelete('cascade');
            $table->foreignId('drawing_sheet_id')->constrained('drawing_sheets')->onDelete('cascade');
            $table->unsignedInteger('page_number')->default(1);
            $table->decimal('x', 8, 6);
            $table->decimal('y', 8, 6);
            $table->decimal('heading', 8, 2)->nullable();
            $table->unsignedInteger('sequence_order');
            $table->string('caption')->nullable();
            $table->string('photo_path');
            $table->string('photo_name')->nullable();
            $table->string('photo_type')->nullable();
            $table->bigInteger('photo_size')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();
            $table->softDeletes();

            $table->index('site_walk_id');
            $table->index('drawing_sheet_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('site_walk_photos');
        Schema::dropIfExists('site_walks');
    }
};
