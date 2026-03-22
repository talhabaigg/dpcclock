<?php

namespace Database\Seeders;

use App\Models\Skill;
use Illuminate\Database\Seeder;

class SkillsSeeder extends Seeder
{
    public function run(): void
    {
        $skills = [
            'Erecting Framework',
            'Concealed Grid',
            'Setting',
            'Decorative Cornice',
            'Set Out',
            'Fix Plasterboard',
            'Exposed Grid',
            'Cornice',
        ];

        foreach ($skills as $skill) {
            Skill::firstOrCreate(['name' => $skill]);
        }
    }
}
