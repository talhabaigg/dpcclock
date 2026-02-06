<?php

namespace Database\Factories;

use App\Models\MaterialItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MaterialItem>
 */
class MaterialItemFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = MaterialItem::class;

    public function definition(): array
    {
        return [
            'code' => strtoupper('MAT-'.$this->faker->unique()->bothify('###??')),
            'description' => $this->faker->words(3, true),
            'unit_cost' => $this->faker->randomFloat(2, 5, 500),

        ];
    }
}
