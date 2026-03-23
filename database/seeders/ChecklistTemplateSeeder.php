<?php

namespace Database\Seeders;

use App\Models\ChecklistTemplate;
use App\Models\EmploymentApplication;
use Illuminate\Database\Seeder;

class ChecklistTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            [
                'name' => 'Screening Checklist',
                'model_type' => EmploymentApplication::class,
                'auto_attach' => true,
                'items' => [
                    ['label' => 'Review application form for completeness', 'is_required' => true],
                    ['label' => 'Verify safety induction number', 'is_required' => true],
                    ['label' => 'Check for duplicate applications', 'is_required' => false],
                    ['label' => 'Review skills and qualifications', 'is_required' => true],
                ],
            ],
            [
                'name' => 'Phone Interview Checklist',
                'model_type' => EmploymentApplication::class,
                'auto_attach' => true,
                'items' => [
                    ['label' => 'Confirm availability and start date', 'is_required' => true],
                    ['label' => 'Discuss salary expectations', 'is_required' => true],
                    ['label' => 'Assess communication and attitude', 'is_required' => true],
                    ['label' => 'Verify right to work in Australia', 'is_required' => true],
                    ['label' => 'Confirm preferred project site', 'is_required' => false],
                ],
            ],
            [
                'name' => 'Reference Check',
                'model_type' => EmploymentApplication::class,
                'auto_attach' => true,
                'items' => [
                    ['label' => 'Contact Reference #1', 'is_required' => true],
                    ['label' => 'Contact Reference #2', 'is_required' => true],
                    ['label' => 'Record reference feedback and outcomes', 'is_required' => true],
                ],
            ],
            [
                'name' => 'Face-to-Face Interview',
                'model_type' => EmploymentApplication::class,
                'auto_attach' => true,
                'items' => [
                    ['label' => 'Safety awareness questions completed', 'is_required' => true],
                    ['label' => 'Trade-specific competency assessment', 'is_required' => true],
                    ['label' => 'Scenario/behavioural questions', 'is_required' => true],
                    ['label' => 'PPE requirements discussed', 'is_required' => true],
                    ['label' => 'Right to work verification (sighted documents)', 'is_required' => true],
                    ['label' => 'Physical fitness assessment', 'is_required' => false],
                ],
            ],
        ];

        foreach ($templates as $templateData) {
            $items = $templateData['items'];
            unset($templateData['items']);

            $template = ChecklistTemplate::updateOrCreate(
                ['name' => $templateData['name'], 'model_type' => $templateData['model_type']],
                $templateData
            );

            // Only seed items if the template was just created (no existing items)
            if ($template->items()->count() === 0) {
                foreach ($items as $index => $item) {
                    $template->items()->create([
                        ...$item,
                        'sort_order' => $index + 1,
                    ]);
                }
            }
        }
    }
}
