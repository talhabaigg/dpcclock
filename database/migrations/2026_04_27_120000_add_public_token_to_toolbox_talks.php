<?php

use App\Models\ToolboxTalk;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('toolbox_talks', function (Blueprint $table) {
            $table->uuid('public_token')->nullable()->unique()->after('id');
        });

        ToolboxTalk::query()->whereNull('public_token')->get()->each(function (ToolboxTalk $talk) {
            $talk->forceFill(['public_token' => (string) Str::uuid()])->saveQuietly();
        });
    }

    public function down(): void
    {
        Schema::table('toolbox_talks', function (Blueprint $table) {
            $table->dropUnique(['public_token']);
            $table->dropColumn('public_token');
        });
    }
};
