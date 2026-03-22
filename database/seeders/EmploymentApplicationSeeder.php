<?php

namespace Database\Seeders;

use App\Models\EmploymentApplication;
use App\Models\Skill;
use Faker\Factory as Faker;
use Illuminate\Database\Seeder;

class EmploymentApplicationSeeder extends Seeder
{
    public function run(): void
    {
        $faker = Faker::create('en_AU');
        $skillIds = Skill::pluck('id')->toArray();
        $occupations = ['plasterer', 'carpenter', 'labourer', 'other'];
        $statuses = ['new', 'reviewing', 'phone_interview', 'reference_check', 'face_to_face', 'approved'];
        $medicalConditions = ['none', 'back', 'knee', 'shoulder', 'other'];

        for ($i = 0; $i < 10; $i++) {
            $occupation = $faker->randomElement($occupations);
            $isApprentice = $faker->boolean(30);
            $hasWit = $faker->boolean(70);

            $application = EmploymentApplication::create([
                'surname' => $faker->lastName(),
                'first_name' => $faker->firstName(),
                'suburb' => $faker->city(),
                'email' => $faker->unique()->safeEmail(),
                'phone' => $faker->phoneNumber(),
                'date_of_birth' => $faker->dateTimeBetween('-55 years', '-18 years')->format('Y-m-d'),
                'why_should_we_employ_you' => $faker->paragraph(3),
                'referred_by' => $faker->boolean(40) ? $faker->name() : null,
                'aboriginal_or_tsi' => $faker->boolean(10),
                'occupation' => $occupation,
                'apprentice_year' => $isApprentice ? $faker->numberBetween(1, 4) : null,
                'trade_qualified' => ! $isApprentice && $faker->boolean(80),
                'occupation_other' => $occupation === 'other' ? $faker->randomElement(['Painter', 'Electrician', 'Tiler']) : null,
                'preferred_project_site' => $faker->boolean(60) ? $faker->city() : null,
                'safety_induction_number' => strtoupper($faker->bothify('SI-####-??')),
                'ewp_below_11m' => $faker->boolean(40),
                'ewp_above_11m' => $faker->boolean(20),
                'forklift_licence_number' => $faker->boolean(30) ? strtoupper($faker->bothify('FL-####')) : null,
                'work_safely_at_heights' => $faker->boolean(75),
                'scaffold_licence_number' => $faker->boolean(25) ? strtoupper($faker->bothify('SC-####')) : null,
                'first_aid_completion_date' => $faker->boolean(60) ? $faker->dateTimeBetween('-3 years', 'now')->format('Y-m-d') : null,
                'workplace_impairment_training' => $hasWit,
                'wit_completion_date' => $hasWit ? $faker->dateTimeBetween('-2 years', 'now')->format('Y-m-d') : null,
                'asbestos_awareness_training' => $faker->boolean(65),
                'crystalline_silica_course' => $faker->boolean(55),
                'gender_equity_training' => $faker->boolean(60),
                'quantitative_fit_test' => $faker->randomElement(['quantitative', 'no_fit_test']),
                'workcover_claim' => $faker->boolean(15),
                'medical_condition' => $faker->randomElement($medicalConditions),
                'medical_condition_other' => null,
                'acceptance_full_name' => $faker->name(),
                'acceptance_email' => $faker->safeEmail(),
                'acceptance_date' => $faker->dateTimeBetween('-30 days', 'now')->format('Y-m-d'),
                'declaration_accepted' => true,
                'status' => $faker->randomElement($statuses),
            ]);

            // Add 2-4 references
            $refCount = $faker->numberBetween(2, 4);
            for ($r = 0; $r < $refCount; $r++) {
                $application->references()->create([
                    'sort_order' => $r + 1,
                    'company_name' => $faker->company(),
                    'position' => $faker->jobTitle(),
                    'employment_period' => $faker->numberBetween(1, 8) . ' years',
                    'contact_person' => $faker->name(),
                    'phone_number' => $faker->phoneNumber(),
                ]);
            }

            // Add 2-5 skills from master list
            $selectedSkills = $faker->randomElements($skillIds, min(count($skillIds), $faker->numberBetween(2, 5)));
            foreach ($selectedSkills as $skillId) {
                $skill = Skill::find($skillId);
                $application->skills()->create([
                    'skill_id' => $skillId,
                    'skill_name' => $skill->name,
                    'is_custom' => false,
                ]);
            }

            // Occasionally add custom skills
            if ($faker->boolean(40)) {
                $customSkills = $faker->randomElements(['Demolition', 'Waterproofing', 'Rendering', 'Tiling', 'Insulation'], $faker->numberBetween(1, 2));
                foreach ($customSkills as $customSkill) {
                    $application->skills()->create([
                        'skill_id' => null,
                        'skill_name' => $customSkill,
                        'is_custom' => true,
                    ]);
                }
            }
        }
    }
}
