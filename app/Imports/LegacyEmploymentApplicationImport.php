<?php

namespace App\Imports;

use App\Models\EmploymentApplication;
use App\Models\Skill;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithStartRow;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class LegacyEmploymentApplicationImport implements ToCollection, WithStartRow, WithChunkReading
{
    public int $importedCount = 0;
    public int $skippedCount = 0;
    public array $errors = [];

    private Collection $skillMap;

    public function __construct()
    {
        $this->skillMap = Skill::active()->pluck('id', 'name')->mapWithKeys(
            fn ($id, $name) => [strtolower(trim($name)) => $id]
        );
    }

    public function startRow(): int
    {
        return 2; // Row 1 = headers
    }

    public function chunkSize(): int
    {
        return 100;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            try {
                $surname = $this->trimValue($row[2]);
                $firstName = $this->trimValue($row[3]);

                if (! $firstName && ! $surname) {
                    continue;
                }

                $email = $this->trimValue($row[5]);
                if (! $email) {
                    $this->errors[] = "Row " . ($index + 2) . ": Email is required";
                    $this->skippedCount++;
                    continue;
                }

                // Parse occupation — may be comma-separated like "Carpenter, Labourer"
                $occupationRaw = $this->trimValue($row[11]) ?? '';
                $occupation = $this->parseOccupation($occupationRaw);

                // Parse EWP — single field like "Above 11m high risk", "Below 11m"
                $ewpRaw = strtolower($this->trimValue($row[18]) ?? '');
                $ewpBelow = str_contains($ewpRaw, 'below');
                $ewpAbove = str_contains($ewpRaw, 'above') || str_contains($ewpRaw, 'high risk');

                // Parse quantitative fit test
                $fitTestRaw = strtolower($this->trimValue($row[28]) ?? '');
                $quantitativeFitTest = (str_contains($fitTestRaw, 'no') || $fitTestRaw === '')
                    ? 'no_fit_test'
                    : 'quantitative';

                // Parse acceptance date (col 54 "Date") for created_at, fallback to col 1
                // Guard: only use dates after 2019 (no submissions are older)
                $submissionDate = $this->parseDate($row[54]) ?? $this->parseDate($row[1]);
                if ($submissionDate && $submissionDate < '2019-01-01') {
                    $submissionDate = null;
                }

                $application = EmploymentApplication::create([
                    'first_name' => $firstName ?? '',
                    'surname' => $surname ?? '',
                    'email' => $email,
                    'phone' => $this->trimValue($row[6]) ?? '',
                    'suburb' => $this->trimValue($row[4]) ?? '',
                    'date_of_birth' => $this->parseDate($row[7]) ?? '1900-01-01',
                    'occupation' => $occupation,
                    'occupation_other' => mb_substr(
                        $occupation === 'other'
                            ? ($this->trimValue($row[13]) ?: $occupationRaw)
                            : $this->trimValue($row[13]) ?? '', 0, 255
                    ) ?: null,
                    'trade_qualified' => $this->booleanValue($row[12]),
                    'preferred_project_site' => $this->trimValue($row[14]),
                    'why_should_we_employ_you' => $this->trimValue($row[8]) ?? '-',
                    'referred_by' => $this->parseReferredBy($row[9]),
                    'aboriginal_or_tsi' => $this->booleanValue($row[10]),
                    'safety_induction_number' => $this->trimValue($row[17]) ?? 'N/A',
                    'ewp_below_11m' => $ewpBelow,
                    'ewp_above_11m' => $ewpAbove,
                    'forklift_licence_number' => $this->trimValue($row[19]),
                    'work_safely_at_heights' => $this->booleanValue($row[20]),
                    'scaffold_licence_number' => $this->trimValue($row[21]),
                    'first_aid_completion_date' => $this->parseDate($row[22]),
                    'workplace_impairment_training' => $this->booleanValue($row[23]),
                    'wit_completion_date' => $this->parseDate($row[24]),
                    'asbestos_awareness_training' => $this->booleanValue($row[25]),
                    'crystalline_silica_course' => $this->booleanValue($row[26]),
                    'gender_equity_training' => $this->booleanValue($row[27]),
                    'quantitative_fit_test' => $quantitativeFitTest,
                    'workcover_claim' => $this->booleanValue($row[49]),
                    'medical_condition' => $this->parseMedicalCondition($row[50]),
                    'medical_condition_other' => mb_substr($this->trimValue($row[51]) ?? '', 0, 255) ?: null,
                    'acceptance_full_name' => $this->trimValue($row[52]) ?? (($firstName ?? '') . ' ' . ($surname ?? '')),
                    'acceptance_email' => $this->trimValue($row[53]) ?? $email,
                    'acceptance_date' => ($d = $this->parseDate($row[54])) && $d >= '2019-01-01' ? $d : now()->toDateString(),
                    'declaration_accepted' => true,
                    'status' => 'new',
                ]);

                // Backdate created_at to the original submission date
                if ($submissionDate) {
                    EmploymentApplication::withoutTimestamps(fn () =>
                        EmploymentApplication::where('id', $application->id)->update(['created_at' => $submissionDate . ' 00:00:00'])
                    );
                }

                // Skills from col 15 (master list, comma-separated)
                $this->createSkills($application, $this->trimValue($row[15]));

                // Custom skills from col 16
                $this->createSkills($application, $this->trimValue($row[16]));

                // References 1-4 (cols 29-33, 34-38, 39-43, 44-48)
                $this->createReference($application, $row, 29, 1);
                $this->createReference($application, $row, 34, 2);
                $this->createReference($application, $row, 39, 3);
                $this->createReference($application, $row, 44, 4);

                $this->importedCount++;
            } catch (\Exception $e) {
                $this->errors[] = "Row " . ($index + 2) . ": " . $e->getMessage();
                $this->skippedCount++;
            }
        }
    }

    private function parseOccupation(string $raw): string
    {
        $valid = ['plasterer', 'carpenter', 'labourer', 'other'];
        $parts = preg_split('/[,;]+/', $raw);

        foreach ($parts as $part) {
            $normalized = strtolower(trim($part));
            if (in_array($normalized, $valid)) {
                return $normalized;
            }
        }

        // Try partial matching
        $lower = strtolower($raw);
        foreach (['plasterer', 'carpenter', 'labourer'] as $occ) {
            if (str_contains($lower, $occ)) {
                return $occ;
            }
        }

        return $raw !== '' ? 'other' : 'labourer';
    }

    private function parseReferredBy($value): ?string
    {
        $text = $this->trimValue($value);
        if (! $text) {
            return null;
        }
        // Strip leading "Yes, " or "Yes - " prefixes
        return preg_replace('/^(yes[,\-\s]+)/i', '', $text) ?: $text;
    }

    private function parseMedicalCondition($value): ?string
    {
        $text = $this->trimValue($value);
        if (! $text || strtolower($text) === 'no') {
            return null;
        }
        return $text;
    }

    private function createSkills(EmploymentApplication $application, ?string $raw): void
    {
        if (! $raw) {
            return;
        }

        $skills = preg_split('/[,;]+/', $raw);
        foreach ($skills as $skillName) {
            $trimmed = trim($skillName);
            if ($trimmed === '') {
                continue;
            }
            $skillId = $this->skillMap[strtolower($trimmed)] ?? null;
            $application->skills()->create([
                'skill_id' => $skillId,
                'skill_name' => mb_substr($trimmed, 0, 255),
                'is_custom' => $skillId === null,
            ]);
        }
    }

    private function createReference(EmploymentApplication $application, Collection $row, int $startCol, int $sortOrder): void
    {
        $company = $this->trimValue($row[$startCol] ?? null);
        $contact = $this->trimValue($row[$startCol + 3] ?? null);

        if (! $company && ! $contact) {
            return;
        }

        $phone = $this->trimValue($row[$startCol + 4] ?? null);
        // Strip leading '+  from phone numbers
        if ($phone) {
            $phone = ltrim($phone, "'+");
        }

        $application->references()->create([
            'sort_order' => $sortOrder,
            'company_name' => $company ?? '',
            'position' => $this->trimValue($row[$startCol + 1] ?? null) ?? '',
            'employment_period' => $this->trimValue($row[$startCol + 2] ?? null) ?? '',
            'contact_person' => $contact ?? '',
            'phone_number' => $phone ?? '',
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

            $str = trim((string) $value);

            // DD/MM/YYYY Australian format
            if (preg_match('#^\d{1,2}/\d{1,2}/\d{4}$#', $str)) {
                return \Carbon\Carbon::createFromFormat('d/m/Y', $str)->format('Y-m-d');
            }

            return \Carbon\Carbon::parse($str)->format('Y-m-d');
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

    private function booleanValue($value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }
        $val = strtolower(trim((string) $value));
        return in_array($val, ['yes', 'y', 'true', '1', 'checked']);
    }
}
