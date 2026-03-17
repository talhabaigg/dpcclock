<?php

namespace App\Imports;

use App\Models\Employee;
use App\Models\IncidentReport;
use App\Models\Location;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithStartRow;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class IncidentReportImport implements ToCollection, WithStartRow, WithChunkReading
{
    public int $importedCount = 0;
    public int $skippedCount = 0;
    public array $errors = [];

    private ?int $uploadedBy;
    private Collection $locationMap;
    private Collection $employeeMap;

    const INJURY_CLASSIFICATIONS = [
        1 => 'Abrasion',
        2 => 'Concussion',
        3 => 'Allergy',
        4 => 'Cut or open wound',
        5 => 'Psychological Disorder',
        6 => 'Hearing Loss',
        7 => 'Internal Injury',
        8 => 'Fracture/Break',
        9 => 'Heart/Circulatory',
        10 => 'Poisoning',
        11 => 'Amputation',
        12 => 'Dislocation',
        13 => 'Infectious Disease',
        14 => 'Puncture',
        15 => 'Foreign Body',
        16 => 'Needle Stick',
        17 => 'Asphyxiation',
        18 => 'Electric Shock',
        19 => 'Inhalation',
        20 => 'Respiratory',
        21 => 'Bite',
        22 => 'Exposure',
        23 => 'Traumatic Shock',
        24 => 'Nervous System Injury',
        25 => 'Skin Disorder',
        26 => 'Bruise/Swelling',
        27 => 'Burn/Scald',
        28 => 'Sprain/Strain',
        29 => 'Crush',
        30 => 'Trauma to muscle/tendon',
        31 => 'Heat Cold or Fire',
    ];

    private Collection $projectLocations;

    public function __construct(?int $uploadedBy = null)
    {
        $this->uploadedBy = $uploadedBy;
        $this->employeeMap = Employee::pluck('id', 'name')->mapWithKeys(fn ($id, $name) => [strtolower($name) => $id]);

        // Build project-level location map: children of "Jobs" nodes, excluding SWC company
        $swcEhId = Location::where('name', 'SWC')->value('eh_location_id');
        $jobsEhIds = Location::where('name', 'Jobs')
            ->when($swcEhId, fn ($q) => $q->where('eh_parent_id', '!=', $swcEhId))
            ->pluck('eh_location_id');
        $this->projectLocations = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_location_id', 'external_id']);

        // Build the location map for quick exact matching
        $this->locationMap = $this->projectLocations->mapWithKeys(fn ($loc) => [strtolower($loc->name) => $loc->id]);
    }

    public function startRow(): int
    {
        return 4;
    }

    public function chunkSize(): int
    {
        return 100;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            try {
                // Skip empty rows (no report number and no employee name)
                $reportNumber = $this->numericValue($row[0]);
                $employeeName = $this->trimValue($row[3]);

                if (! $reportNumber && ! $employeeName) {
                    $this->skippedCount++;
                    continue;
                }

                // Parse date from Excel serial
                $incidentDate = $this->parseDate($row[1]);
                if (! $incidentDate) {
                    $this->errors[] = "Row " . ($index + 4) . ": Invalid date";
                    $this->skippedCount++;
                    continue;
                }

                $projectName = $this->trimValue($row[5]) ?? '';
                $natureCode = $this->numericValue($row[7]);

                $data = [
                    'incident_date' => $incidentDate,
                    'day_of_week' => $this->trimValue($row[2]),
                    'employee_name' => $employeeName ?? 'Unknown',
                    'employee_id' => $this->resolveEmployeeId($employeeName),
                    'company' => $this->trimValue($row[4]),
                    'project_name' => $projectName,
                    'location_id' => $this->resolveLocationId($projectName),
                    'position' => $this->trimValue($row[6]),
                    'nature_of_injury_code' => $natureCode,
                    'nature_of_injury' => $natureCode ? (self::INJURY_CLASSIFICATIONS[$natureCode] ?? null) : $this->trimValue($row[7]),
                    'body_location' => $this->trimValue($row[8]),
                    'mechanism_of_incident' => $this->trimValue($row[9]),
                    'agency_of_injury' => $this->trimValue($row[10]),
                    'incident_type' => $this->trimValue($row[11]) ?? 'Report Only',
                    'workcover_claim' => $this->booleanValue($row[12] ?? null),
                    'days_lost' => $this->numericValue($row[13]) ?? 0,
                    'days_suitable_duties' => $this->numericValue($row[14]) ?? 0,
                    'status' => $this->trimValue($row[15]) ?? 'Open',
                    'comments' => $this->trimValue($row[16]),
                    // Claims columns (R-W, indices 17-22) — optional
                    'claim_active' => $this->booleanValue($row[17] ?? null),
                    'claim_type' => $this->trimValue($row[18] ?? null),
                    'claim_status' => $this->trimValue($row[19] ?? null),
                    'capacity' => $this->trimValue($row[20] ?? null),
                    'employment_status' => $this->trimValue($row[21] ?? null),
                    'claim_cost' => $this->numericValue($row[22] ?? null) ?? 0,
                    'uploaded_by' => $this->uploadedBy,
                ];

                if ($reportNumber) {
                    IncidentReport::updateOrCreate(
                        ['report_number' => $reportNumber],
                        $data
                    );
                } else {
                    IncidentReport::create(array_merge($data, ['report_number' => null]));
                }

                $this->importedCount++;
            } catch (\Exception $e) {
                $this->errors[] = "Row " . ($index + 4) . ": " . $e->getMessage();
                $this->skippedCount++;
            }
        }
    }

    private function parseDate($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        try {
            if (is_numeric($value)) {
                $dateTime = Date::excelToDateTimeObject((int) $value);
                return $dateTime->format('Y-m-d');
            }
            return \Carbon\Carbon::parse($value)->format('Y-m-d');
        } catch (\Exception $e) {
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
        return strtoupper(trim((string) $value)) === 'YES';
    }

    private function resolveLocationId(?string $projectName): ?int
    {
        if (! $projectName) {
            return null;
        }

        $key = strtolower($projectName);

        // Strategy 1: Exact match on location name
        if (isset($this->locationMap[$key])) {
            return $this->locationMap[$key];
        }

        // Strategy 2: Location name contains the project name (e.g., "DGC" matches "DGC00 - Contract Works")
        $candidates = $this->projectLocations->filter(
            fn ($loc) => stripos($loc->name, $projectName) !== false
        );

        if ($candidates->isNotEmpty()) {
            // Prefer non-old, take the first match (shortest external_id usually = main project)
            return $candidates->sortBy(fn ($loc) => strlen($loc->external_id ?? ''))->first()->id;
        }

        // Strategy 3: Project name contains the location's display name after the code prefix
        // e.g., "The Terraces" matches "TER00 - The Terraces Hotel"
        $candidates = $this->projectLocations->filter(function ($loc) use ($key) {
            $parts = explode(' - ', $loc->name, 2);
            $displayName = $parts[1] ?? $parts[0];

            return stripos($displayName, $projectName) !== false
                || stripos($projectName, $displayName) !== false;
        });

        if ($candidates->isNotEmpty()) {
            return $candidates->first()->id;
        }

        return null;
    }

    private function resolveEmployeeId(?string $employeeName): ?int
    {
        if (! $employeeName) {
            return null;
        }
        return $this->employeeMap[strtolower($employeeName)] ?? null;
    }
}
