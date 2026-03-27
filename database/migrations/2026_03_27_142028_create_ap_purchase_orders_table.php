<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ap_purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->integer('client_id')->nullable();
            $table->string('company', 50)->nullable();
            $table->string('job_number', 50)->nullable()->index();
            $table->string('po_number', 50)->nullable()->index();
            $table->date('po_date')->nullable();
            $table->date('po_required_date')->nullable();
            $table->integer('line')->nullable();
            $table->string('item_code', 100)->nullable();
            $table->string('cost_item', 50)->nullable();
            $table->string('cost_type', 50)->nullable();
            $table->string('department', 100)->nullable();
            $table->string('location', 100)->nullable();
            $table->string('vendor_code', 50)->nullable();
            $table->string('vendor_name', 255)->nullable();
            $table->text('description')->nullable();
            $table->decimal('qty', 14, 6)->default(0);
            $table->string('uofm', 50)->nullable();
            $table->decimal('unit_cost', 14, 6)->default(0);
            $table->decimal('amount', 14, 4)->default(0);
            $table->string('created_by', 100)->nullable();
            $table->string('ship_to_type', 50)->nullable();
            $table->string('status', 50)->nullable()->index();
            $table->string('approval_status', 50)->nullable();
            $table->string('key', 255)->nullable();
            $table->timestamps();

            $table->index(['job_number', 'po_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ap_purchase_orders');
    }
};
