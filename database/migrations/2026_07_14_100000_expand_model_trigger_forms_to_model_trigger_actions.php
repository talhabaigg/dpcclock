<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Trigger forms grow up into trigger actions: each row now carries an
     * action_type ('assign_form' keeps the old behavior, 'send_notification'
     * notifies recipients instead of creating a FormRequest). Form-specific
     * columns become nullable; notification config lives in its own columns.
     */
    public function up(): void
    {
        if (Schema::hasTable('model_trigger_forms') && ! Schema::hasTable('model_trigger_actions')) {
            Schema::rename('model_trigger_forms', 'model_trigger_actions');
        }

        Schema::table('model_trigger_actions', function (Blueprint $table) {
            $table->string('action_type')->default('assign_form')->after('trigger_key');
            $table->foreignId('form_template_id')->nullable()->change();

            // send_notification config
            $table->json('notification_channels')->nullable()->after('assignee_value');
            $table->string('notification_title')->nullable()->after('notification_channels');
            $table->text('notification_body')->nullable()->after('notification_title');
            $table->string('notification_url')->nullable()->after('notification_body');
        });

        Schema::table('model_trigger_actions', function (Blueprint $table) {
            $table->renameIndex('model_trigger_forms_lookup_idx', 'model_trigger_actions_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::table('model_trigger_actions', function (Blueprint $table) {
            $table->renameIndex('model_trigger_actions_lookup_idx', 'model_trigger_forms_lookup_idx');
        });

        Schema::table('model_trigger_actions', function (Blueprint $table) {
            $table->dropColumn(['action_type', 'notification_channels', 'notification_title', 'notification_body', 'notification_url']);
            $table->foreignId('form_template_id')->nullable(false)->change();
        });

        if (Schema::hasTable('model_trigger_actions') && ! Schema::hasTable('model_trigger_forms')) {
            Schema::rename('model_trigger_actions', 'model_trigger_forms');
        }
    }
};
