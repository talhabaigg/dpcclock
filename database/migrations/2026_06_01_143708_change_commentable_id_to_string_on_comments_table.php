<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex('comments_commentable_type_commentable_id_index');
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->string('commentable_id', 36)->change();
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->index(['commentable_type', 'commentable_id']);
        });
    }

    public function down(): void
    {
        Schema::table('comments', function (Blueprint $table) {
            $table->dropIndex(['commentable_type', 'commentable_id']);
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->unsignedBigInteger('commentable_id')->change();
        });

        Schema::table('comments', function (Blueprint $table) {
            $table->index(['commentable_type', 'commentable_id']);
        });
    }
};
