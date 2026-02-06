<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('po_num_sequence', function (Blueprint $table) {
            $table->id();
            $table->string('company_code')->unique();
            $table->unsignedBigInteger('next_po_number')->nullable();
            $table->timestamps();
        });

        DB::table('po_num_sequence')->insert([
            ['company_code' => 'SWC', 'next_po_number' => 500000],
            ['company_code' => 'GREEN', 'next_po_number' => 600000],
        ]);

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('po_num_sequence');
    }
};
