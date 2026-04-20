<?php

namespace Database\Seeders;

use App\Models\EmployeeFileType;
use Illuminate\Database\Seeder;

class EmployeeFileTypeSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            [
                'name' => 'White Card',
                'category' => ['General License'],
                'slug' => 'white-card',
                'description' => 'General Construction Induction Card',
                'has_back_side' => true,
                'expiry_requirement' => 'none',
                'requires_completed_date' => false,
                'conditions' => ['match' => 'all', 'rules' => []],
                'sort_order' => 1,
            ],
            [
                'name' => 'Drivers License',
                'category' => ['General License'],
                'slug' => 'drivers-license',
                'description' => 'Current drivers license',
                'has_back_side' => true,
                'expiry_requirement' => 'required',
                'requires_completed_date' => false,
                'conditions' => ['match' => 'all', 'rules' => []],
                'sort_order' => 2,
            ],
            [
                'name' => 'Forklift License',
                'category' => ['High Risk Work License'],
                'slug' => 'forklift-license',
                'description' => 'High Risk Work Licence - Forklift',
                'has_back_side' => true,
                'expiry_requirement' => 'optional',
                'requires_completed_date' => false,
                'conditions' => null,
                'sort_order' => 3,
            ],
            [
                'name' => 'EWP License',
                'category' => ['High Risk Work License'],
                'slug' => 'ewp-license',
                'description' => 'Elevated Work Platform licence',
                'has_back_side' => true,
                'expiry_requirement' => 'optional',
                'requires_completed_date' => false,
                'conditions' => null,
                'sort_order' => 4,
            ],
            [
                'name' => 'First Aid Certificate',
                'category' => ['Training Certificate', 'Short Courses'],
                'slug' => 'first-aid-certificate',
                'description' => 'Current first aid training certificate',
                'has_back_side' => false,
                'expiry_requirement' => 'required',
                'requires_completed_date' => true,
                'conditions' => ['match' => 'all', 'rules' => []],
                'sort_order' => 5,
            ],
            [
                'name' => 'Working at Heights',
                'category' => ['Training Certificate', 'Tickets & Licences'],
                'slug' => 'working-at-heights',
                'description' => 'Working at Heights training certificate',
                'has_back_side' => false,
                'expiry_requirement' => 'optional',
                'requires_completed_date' => true,
                'conditions' => null,
                'sort_order' => 6,
            ],
            [
                'name' => 'Medical Clearance',
                'category' => ['Medical'],
                'slug' => 'medical-clearance',
                'description' => 'Pre-employment or periodic medical clearance',
                'has_back_side' => false,
                'expiry_requirement' => 'optional',
                'requires_completed_date' => false,
                'conditions' => null,
                'sort_order' => 7,
            ],
        ];

        foreach ($types as $type) {
            EmployeeFileType::updateOrCreate(
                ['slug' => $type['slug']],
                $type,
            );
        }
    }
}
