<?php

namespace App\Console\Commands;

use App\Models\Employee;
use App\Services\EmploymentHeroService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SyncEmployeeDob extends Command
{
    protected $signature = 'app:sync-employee-dob';

    protected $description = 'Backfill date_of_birth for employees from Employment Hero API';

    public function handle(): int
    {
        $apiKey = config('services.employment_hero.api_key');
        $baseUrl = config('services.employment_hero.base_url');
        $businessId = config('services.employment_hero.business_id');

        $employees = Employee::whereNull('date_of_birth')->get();
        $this->info("Found {$employees->count()} employees without DOB.");

        $updated = 0;
        $failed = 0;

        foreach ($employees as $employee) {
            try {
                $response = Http::withHeaders([
                    'Authorization' => 'Basic '.base64_encode($apiKey.':'),
                ])->get("{$baseUrl}/business/{$businessId}/employee/unstructured/{$employee->eh_employee_id}");

                if ($response->failed()) {
                    $failed++;
                    continue;
                }

                $data = $response->json();
                $dob = $data['dateOfBirth'] ?? null;

                if ($dob) {
                    $employee->update(['date_of_birth' => Carbon::parse($dob)->format('Y-m-d')]);
                    $updated++;
                }
            } catch (\Throwable $e) {
                $failed++;
                $this->warn("Failed for {$employee->eh_employee_id}: ".$e->getMessage());
            }
        }

        $this->info("Done. Updated: {$updated}, Failed: {$failed}");

        return self::SUCCESS;
    }
}
