<?php

namespace App\Imports;

use App\Models\EmploymentApplication;
use App\Models\Skill;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithStartRow;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class EmploymentApplicationImport implements ToCollection, WithStartRow, WithChunkReading
{
    public int $importedCount = 0;
    public int $skippedCount = 0;
    public array $errors = [];

    private Collection $skillMap;

    public function __construct()
    {
        $this->skillMap = Skill::active()->pluck('id', 'name')->mapWithKeys(
            fn ($id, $name) => [strtolower($name) => $id]
        );
    }

    public function startRow(): int
    {
        // Row 1 = headers, Row 2 = example (skip both)
        return 3;
    }

    public function chunkSize(): int
    {
        return 100;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            try {
                $firstName = $this->trimValue($row[0]);
                $surname = $this->trimValue($row[1]);

                // Skip empty rows
                if (! $firstName && ! $surname) {
                    $this->skippedCount++;
                    continue;
                }

                $email = $this->trimValue($row[2]);
                if (! $email) {
                    $this->errors[] = "Row " . ($index + 3) . ": Email is required";
                    $this->skippedCount++;
                    continue;
                }

                $occupation = strtolower($this->trimValue($row[6]) ?? 'labourer');
                if (! in_array($occupation, ['plasterer', 'carpenter', 'labourer', 'other'])) {
                    $occupation = 'other';
                }

                $quantitativeFitTest = strtolower($this->trimValue($row[26]) ?? 'no_fit_test');
                if (! in_array($quantitativeFitTest, ['quantitative', 'no_fit_test'])) {
                    $quantitativeFitTest = 'no_fit_test';
                }

                $status = strtolower($this->trimValue($row[31]) ?? 'new');
                if (! in_array($status, EmploymentApplication::STATUSES)) {
                    $status = 'new';
                }

                $application = EmploymentApplication::create([
                    'first_name' => $firstName,
                    'surname' => $surname,
                    'email' => $email,
                    'phone' => $this->trimValue($row[3]) ?? '',
                    'suburb' => $this->trimValue($row[4]) ?? '',
                    'date_of_birth' => $this->parseDate($row[5]),
                    'occupation' => $occupation,
                    'occupation_other' => $this->trimValue($row[7]),
                    'apprentice_year' => $this->numericValue($row[8]),
                    'trade_qualified' => $this->booleanValue($row[9]),
                    'preferred_project_site' => $this->trimValue($row[10]),
                    'why_should_we_employ_you' => $this->trimValue($row[11]) ?? 'Imported application',
                    'referred_by' => $this->trimValue($row[12]),
                    'aboriginal_or_tsi' => $this->booleanValue($row[13]),
                    'safety_induction_number' => $this->trimValue($row[14]) ?? 'N/A',
                    'ewp_below_11m' => $this->booleanValue($row[15]),
                    'ewp_above_11m' => $this->booleanValue($row[16]),
                    'forklift_licence_number' => $this->trimValue($row[17]),
                    'work_safely_at_heights' => $this->booleanValue($row[18]),
                    'scaffold_licence_number' => $this->trimValue($row[19]),
                    'first_aid_completion_date' => $this->parseDate($row[20]),
                    'workplace_impairment_training' => $this->booleanValue($row[21]),
                    'wit_completion_date' => $this->parseDate($row[22]),
                    'asbestos_awareness_training' => $this->booleanValue($row[23]),
                    'crystalline_silica_course' => $this->booleanValue($row[24]),
                    'gender_equity_training' => $this->booleanValue($row[25]),
                    'quantitative_fit_test' => $quantitativeFitTest,
                    'workcover_claim' => $this->booleanValue($row[27]),
                    'medical_condition' => $this->trimValue($row[28]),
                    'medical_condition_other' => $this->trimValue($row[29]),
                    'acceptance_full_name' => ($firstName ?? '') . ' ' . ($surname ?? ''),
                    'acceptance_email' => $email,
                    'acceptance_date' => now()->toDateString(),
                    'declaration_accepted' => true,
                    'status' => $status,
                ]);

                // Skills (comma-separated in column 30)
                $skillsRaw = $this->trimValue($row[30]);
                if ($skillsRaw) {
                    $skills = preg_split('/[,;]+/', $skillsRaw);
                    foreach ($skills as $skillName) {
                        $trimmed = trim($skillName);
                        if ($trimmed === '') {
                            continue;
                        }
                        $skillId = $this->skillMap[strtolower($trimmed)] ?? null;
                        $application->skills()->create([
                            'skill_id' => $skillId,
                            'skill_name' => $trimmed,
                            'is_custom' => $skillId === null,
                        ]);
                    }
                }

                // Reference 1 (columns 32-36)
                $this->createReference($application, $row, 32, 1);

                // Reference 2 (columns 37-41)
                $this->createReference($application, $row, 37, 2);

                // Reference 3 (columns 42-46)
                $this->createReference($application, $row, 42, 3);

                $this->importedCount++;
            } catch (\Exception $e) {
                $this->errors[] = "Row " . ($index + 3) . ": " . $e->getMessage();
                $this->skippedCount++;
            }
        }
    }

    private function createReference(EmploymentApplication $application, Collection $row, int $startCol, int $sortOrder): void
    {
        $company = $this->trimValue($row[$startCol] ?? null);
        $contact = $this->trimValue($row[$startCol + 3] ?? null);

        if (! $company && ! $contact) {
            return;
        }

        $application->references()->create([
            'sort_order' => $sortOrder,
            'company_name' => $company ?? '',
            'position' => $this->trimValue($row[$startCol + 1] ?? null) ?? '',
            'employment_period' => $this->trimValue($row[$startCol + 2] ?? null) ?? '',
            'contact_person' => $contact ?? '',
            'phone_number' => $this->trimValue($row[$startCol + 4] ?? null) ?? '',
        ]);
    }

    private function parseDate($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        try {
            if (is_numeric($value)) {
                return Date::excelToDateTimeObject((int) $value)->format('Y-m-d');
            }
            return \Carbon\Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception) {
            return null;
        }
    }

    private function trimValue($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $trimmed = trim((string) $value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function numericValue($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $num = filter_var($value, FILTER_VALIDATE_FLOAT);
        return $num !== false ? (int) $num : null;
    }

    private function booleanValue($value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }
        $val = strtoupper(trim((string) $value));
        return in_array($val, ['YES', 'Y', 'TRUE', '1']);
    }
}
