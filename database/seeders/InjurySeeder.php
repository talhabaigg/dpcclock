<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Injury;
use App\Models\Location;
use App\Models\User;
use Illuminate\Database\Seeder;

class InjurySeeder extends Seeder
{
    public function run(): void
    {
        $employeeIds = Employee::pluck('id')->toArray();
        $locationIds = Location::whereNull('eh_parent_id')->pluck('id')->take(20)->toArray();
        $userIds = User::pluck('id')->toArray();

        $incidents = array_keys(Injury::INCIDENT_OPTIONS);
        $reportTypes = array_keys(Injury::REPORT_TYPE_OPTIONS);
        $natures = array_keys(Injury::NATURE_OPTIONS);
        $mechanisms = array_keys(Injury::MECHANISM_OPTIONS);
        $agencies = array_keys(Injury::AGENCY_OPTIONS);
        $contributions = array_keys(Injury::CONTRIBUTION_OPTIONS);
        $correctiveActions = array_keys(Injury::CORRECTIVE_ACTION_OPTIONS);
        $treatmentExternal = array_keys(Injury::TREATMENT_EXTERNAL_OPTIONS);

        $descriptions = [
            'Worker slipped on wet surface near the loading dock and fell, injuring their left knee.',
            'Cut sustained while using angle grinder without proper guard in place.',
            'Worker reported lower back pain after lifting heavy materials without assistance.',
            'Near miss incident — unsecured load fell from scaffold, narrowly missing workers below.',
            'Worker experienced dizziness and nausea due to poor ventilation in confined space.',
            'Hand caught between conveyor rollers during maintenance operation.',
            'Worker struck by reversing forklift in the warehouse area.',
            'Chemical splash to face and eyes while decanting cleaning solution without PPE.',
            'Electrical shock received when drilling into live cable behind plasterboard wall.',
            'Worker tripped over loose cable on walkway and fractured wrist on impact.',
        ];

        $pick = fn(array $items, int $min = 1, int $max = 3) => collect($items)->shuffle()->take(rand($min, $max))->values()->all();

        $reporters = ['John Smith', 'Sarah Johnson', 'Mike Chen', 'Emma Wilson', 'David Brown'];
        $providers = ['Site First Aider', 'Paramedic', 'Dr. Thompson', 'Nurse Kelly', 'St John Ambulance'];

        for ($i = 0; $i < 10; $i++) {
            $hasTreatment = $i % 3 !== 0;
            $hasWitnesses = $i % 2 === 0;
            $occurredAt = now()->subDays(rand(1, 90))->subHours(rand(0, 8));

            Injury::create([
                'id_formal' => 'INJ-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT),
                'location_id' => $locationIds[array_rand($locationIds)],
                'employee_id' => $employeeIds[array_rand($employeeIds)],
                'employee_address' => fake()->address(),
                'incident' => $incidents[array_rand($incidents)],
                'incident_other' => null,
                'occurred_at' => $occurredAt,
                'reported_by' => $reporters[array_rand($reporters)],
                'reported_at' => $occurredAt->copy()->addMinutes(rand(10, 120)),
                'reported_to' => $reporters[array_rand($reporters)],
                'location_of_incident' => fake()->randomElement(['Level 2 scaffolding', 'Loading dock', 'Workshop area', 'Site office', 'Basement carpark', 'Rooftop plant room', 'Ground floor slab']),
                'description' => $descriptions[$i],
                'emergency_services' => $i === 8,
                'work_cover_claim' => in_array($i, [2, 4, 7]),
                'treatment' => $hasTreatment,
                'treatment_at' => $hasTreatment ? $occurredAt->copy()->addMinutes(rand(15, 60)) : null,
                'treatment_provider' => $hasTreatment ? $providers[array_rand($providers)] : null,
                'treatment_external' => $hasTreatment ? $treatmentExternal[array_rand($treatmentExternal)] : null,
                'treatment_external_location' => $hasTreatment ? fake()->randomElement(['Royal Melbourne Hospital', 'Bulk Billing Medical Centre', 'On-site first aid room']) : null,
                'no_treatment_reason' => !$hasTreatment ? 'Worker declined treatment, minor incident.' : null,
                'follow_up' => $i % 4 === 0,
                'follow_up_notes' => $i % 4 === 0 ? 'Review worker condition in 48 hours. Schedule return-to-work meeting.' : null,
                'work_days_missed' => fake()->randomElement([0, 0, 0, 1, 2, 3, 5]),
                'report_type' => $reportTypes[array_rand($reportTypes)],
                'witnesses' => $hasWitnesses,
                'witness_details' => $hasWitnesses ? fake()->name() . ' — was working nearby and saw the incident occur.' : null,
                'natures' => $pick($natures, 1, 3),
                'mechanisms' => $pick($mechanisms, 1, 2),
                'agencies' => $pick($agencies, 1, 2),
                'contributions' => $pick($contributions, 1, 2),
                'corrective_actions' => $pick($correctiveActions, 1, 2),
                'corrective_actions_comments' => fake()->randomElement([null, 'Toolbox talk conducted with all site workers.', 'SWMS updated and redistributed.']),
                'locked_at' => in_array($i, [0, 3, 7]) ? now()->subDays(rand(1, 30)) : null,
                'created_by' => $userIds[array_rand($userIds)],
                'updated_by' => $userIds[array_rand($userIds)],
            ]);
        }
    }
}
