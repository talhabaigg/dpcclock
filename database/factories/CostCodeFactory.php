<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\CostCode>
 */
class CostCodeFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\CostCode::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper('CC'.$this->faker->unique()->numerify('###')),
            'description' => $this->faker->sentence(3),
        ];
    }
}
