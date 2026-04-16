<?php

namespace Database\Seeders;

use App\Enums\SilicaOptionType;
use App\Models\SilicaOption;
use Illuminate\Database\Seeder;

class SilicaOptionsSeeder extends Seeder
{
    public function run(): void
    {
        $options = [
            // Tasks
            ['type' => SilicaOptionType::Task, 'label' => 'Cutting Speedpanel', 'sort_order' => 1],
            ['type' => SilicaOptionType::Task, 'label' => 'Drilling into concrete/speedpanel etc.', 'sort_order' => 2],
            ['type' => SilicaOptionType::Task, 'label' => 'Cutting fibre cement', 'sort_order' => 3],
            ['type' => SilicaOptionType::Task, 'label' => 'Sanding/machining fibre cement products', 'sort_order' => 4],
            ['type' => SilicaOptionType::Task, 'label' => 'Housekeeping and cleaning activities', 'sort_order' => 5],

            // Control Measures
            ['type' => SilicaOptionType::ControlMeasure, 'label' => 'M Class Vac', 'sort_order' => 1],
            ['type' => SilicaOptionType::ControlMeasure, 'label' => 'H Class Vac', 'sort_order' => 2],
            ['type' => SilicaOptionType::ControlMeasure, 'label' => 'Saw equipped with commercially available dust collection system that provides air flow recommended by the tool manufacturer, or greater, and be minimum M-Class', 'sort_order' => 3],
            ['type' => SilicaOptionType::ControlMeasure, 'label' => 'Use drill equipped with commercially available shroud or cowling with dust collection system. Dust collector must provide the air flow recommended by the tool manufacturer, or greater and have either: a tool-mounted HEPA-filtered dust collector, or an on-tool capture hood connected to a dust extractor/vacuum rated to minimum M-Class', 'sort_order' => 4],
            ['type' => SilicaOptionType::ControlMeasure, 'label' => 'Work undertaken in outdoor environment', 'sort_order' => 5],

            // Respirator Types
            ['type' => SilicaOptionType::Respirator, 'label' => 'P2 Half Face Respirator', 'sort_order' => 1],
        ];

        foreach ($options as $option) {
            SilicaOption::firstOrCreate(
                ['type' => $option['type'], 'label' => $option['label']],
                ['sort_order' => $option['sort_order'], 'active' => true],
            );
        }
    }
}
