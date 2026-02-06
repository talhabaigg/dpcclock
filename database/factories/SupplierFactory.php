<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Supplier>
 */
class SupplierFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    protected $model = \App\Models\Supplier::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->company,
            'code' => strtoupper('SUP-'.$this->faker->unique()->bothify('###??')),
        ];
    }
}
