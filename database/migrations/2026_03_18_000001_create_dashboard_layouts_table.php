<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dashboard_layouts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->json('grid_layout');
            $table->json('hidden_widgets');
            $table->boolean('is_active')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Migrate existing layout data from locations.dashboard_settings
        $migrated = false;
        $locations = DB::table('locations')->whereNotNull('dashboard_settings')->get();

        foreach ($locations as $location) {
            $settings = json_decode($location->dashboard_settings, true);
            if (!$migrated && !empty($settings['grid_layout'])) {
                DB::table('dashboard_layouts')->insert([
                    'name' => 'Default',
                    'grid_layout' => json_encode($settings['grid_layout']),
                    'hidden_widgets' => json_encode($settings['hidden_widgets'] ?? []),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $migrated = true;
            }

            // Clean layout keys from dashboard_settings
            unset($settings['grid_layout'], $settings['hidden_widgets']);
            DB::table('locations')->where('id', $location->id)->update([
                'dashboard_settings' => !empty($settings) ? json_encode($settings) : null,
            ]);
        }

        // If no existing layout was migrated, create a default
        if (!$migrated) {
            $defaultLayout = [
                ['i' => 'project-details', 'x' => 0, 'y' => 0, 'w' => 4, 'h' => 2],
                ['i' => 'variations', 'x' => 4, 'y' => 0, 'w' => 4, 'h' => 2],
                ['i' => 'budget-safety', 'x' => 8, 'y' => 0, 'w' => 2, 'h' => 3],
                ['i' => 'industrial-action', 'x' => 10, 'y' => 0, 'w' => 2, 'h' => 3],
                ['i' => 'budget-weather', 'x' => 12, 'y' => 0, 'w' => 2, 'h' => 3],
                ['i' => 'margin-health', 'x' => 4, 'y' => 2, 'w' => 1, 'h' => 1],
                ['i' => 'this-month', 'x' => 4, 'y' => 3, 'w' => 1, 'h' => 1],
                ['i' => 'other-items', 'x' => 5, 'y' => 2, 'w' => 1, 'h' => 2],
                ['i' => 'po-commitments', 'x' => 4, 'y' => 4, 'w' => 2, 'h' => 2],
                ['i' => 'sc-commitments', 'x' => 6, 'y' => 4, 'w' => 2, 'h' => 2],
                ['i' => 'employees-on-site', 'x' => 10, 'y' => 6, 'w' => 6, 'h' => 4],
                ['i' => 'claim-vs-production', 'x' => 6, 'y' => 2, 'w' => 2, 'h' => 2],
                ['i' => 'project-income', 'x' => 0, 'y' => 4, 'w' => 4, 'h' => 2],
                ['i' => 'labour-budget', 'x' => 0, 'y' => 6, 'w' => 8, 'h' => 4],
            ];

            DB::table('dashboard_layouts')->insert([
                'name' => 'Default',
                'grid_layout' => json_encode($defaultLayout),
                'hidden_widgets' => json_encode([]),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('dashboard_layouts');
    }
};
