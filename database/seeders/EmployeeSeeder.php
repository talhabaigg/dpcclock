<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Faker\Factory as Faker;

class EmployeeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faker = Faker::create();

        // Insert 10 employees with fake data
        for ($i = 0; $i < 10; $i++) {
            DB::table('employees')->insert([
                'name' => $faker->name,
                'email' => $faker->unique()->safeEmail,
                'eh_employee_id' => $faker->unique()->uuid,
                'external_id' => $faker->unique()->uuid,
                'pin' => $faker->numerify('####'), // Pin can be a 4-digit number
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
