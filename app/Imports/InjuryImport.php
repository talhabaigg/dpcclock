<?php

namespace App\Imports;

use App\Models\Employee;
use App\Models\Injury;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class InjuryImport implements ToCollection, WithHeadingRow, WithChunkReading
{
    public int $importedCount = 0;
    public int $updatedCount = 0;
    public int $skippedCount = 0;
    public array $errors = [];

    private ?int $uploadedBy;
    private Collection $employeeMap;
    private Collection $locationMap;
    private Collection $locations;
    private ?string $swcpJobsEhId;

    /** Reverse-lookup maps: display label → enum key */
    private array $incidentMap;
    private array $reportTypeMap;
    private array $natureMap;
    private array $mechanismMap;
    private array $agencyMap;

    public function __construct(?int $uploadedBy = null)
    {
        $this->uploadedBy = $uploadedBy;

        $this->employeeMap = Employee::get(['id', 'name', 'preferred_name'])
            ->flatMap(fn ($e) => collect([
                strtolower($e->name) => $e->id,
                $e->preferred_name ? strtolower($e->preferred_name) : null => $e->id,
            ])->filter(fn ($v, $k) => $k !== null));

        // Load all project locations across all companies
        $jobsEhIds = Location::where('name', 'Jobs')->pluck('eh_location_id');
        $locations = Location::whereIn('eh_parent_id', $jobsEhIds)
            ->get(['id', 'name', 'eh_parent_id']);

        // SWCP jobs node — preferred over SWC/GRE for duplicate names
        $swcpEhId = Location::where('name', 'SWCP Employment')->value('eh_location_id');
        $this->swcpJobsEhId = $swcpEhId
            ? Location::where('name', 'Jobs')->where('eh_parent_id', $swcpEhId)->value('eh_location_id')
            : null;

        // Build map: sort so SWCP entries come last and overwrite duplicates
        $sorted = $locations->sortBy(fn ($loc) => $loc->eh_parent_id === $this->swcpJobsEhId ? 1 : 0);
        $this->locationMap = $sorted->mapWithKeys(fn ($loc) => [strtolower($loc->name) => $loc->id]);
        $this->locations = $locations;

        $this->incidentMap = $this->buildReverseMap(Injury::INCIDENT_OPTIONS);
        $this->reportTypeMap = $this->buildReverseMap(Injury::REPORT_TYPE_OPTIONS);
        $this->natureMap = $this->buildReverseMap(Injury::NATURE_OPTIONS);
        $this->mechanismMap = $this->buildReverseMap(Injury::MECHANISM_OPTIONS);
        $this->agencyMap = $this->buildReverseMap(Injury::AGENCY_OPTIONS);
    }

    public function chunkSize(): int
    {
        return 100;
    }

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            try {
                $idFormal = $this->trimValue($row['id'] ?? null);

                if (! $idFormal) {
                    $this->errors[] = "Row " . ($index + 2) . ": No ID found. Keys: " . implode(', ', $row->keys()->toArray());
                    $this->skippedCount++;
                    continue;
                }

                $occurredAt = $this->parseDateTime($row['occurred_at'] ?? null);
                $workerName = $this->trimValue($row['worker'] ?? null);
                $projectName = $this->trimValue($row['project'] ?? null);

                // Build description from body_location and comments if present
                $descParts = [];
                $bodyLocation = $this->trimValue($row['body_location'] ?? null);
                $comments = $this->trimValue($row['comments'] ?? null);
                if ($bodyLocation) {
                    $descParts[] = "Body location: {$bodyLocation}";
                }
                if ($comments) {
                    $descParts[] = $comments;
                }

                $data = [
                    'occurred_at' => $occurredAt,
                    'employee_id' => $this->resolveEmployeeId($workerName),
                    'employee_name' => $workerName,
                    'location_id' => $this->resolveLocationId($projectName),
                    'incident' => $this->resolveEnumKey($this->trimValue($row['incident'] ?? null), $this->incidentMap),
                    'natures' => $this->resolveMultiEnumKeys($this->trimValue($row['nature_of_injury'] ?? null), $this->natureMap),
                    'mechanisms' => $this->resolveMultiEnumKeys($this->trimValue($row['mechanisms_of_incident'] ?? null), $this->mechanismMap),
                    'agencies' => $this->resolveMultiEnumKeys($this->trimValue($row['agency_of_incident'] ?? null), $this->agencyMap),
                    'work_cover_claim' => $this->booleanValue($row['workcover_claim'] ?? null),
                    'work_days_missed' => $this->numericValue($row['no_of_days_lost'] ?? null) ?? 0,
                    'report_type' => $this->resolveEnumKey($this->trimValue($row['type'] ?? null), $this->reportTypeMap),
                    'description' => count($descParts) > 0 ? implode("\n", $descParts) : null,
                ];

                $existing = Injury::where('id_formal', $idFormal)->first();

                if ($existing) {
                    $existing->update($data);
                    $this->updatedCount++;
                } else {
                    $data['id_formal'] = $idFormal;
                    $data['created_by'] = $this->uploadedBy;
                    $injury = Injury::create($data);

                    if ($comments) {
                        $injury->addSystemComment($comments, ['event' => 'legacy_import'], $this->uploadedBy);
                    }
                    $this->importedCount++;
                }
            } catch (\Exception $e) {
                $this->errors[] = "Row {$idFormal}: " . $e->getMessage();
                $this->skippedCount++;
            }
        }
    }

    private function buildReverseMap(array $options): array
    {
        $map = [];
        foreach ($options as $key => $label) {
            $map[strtolower($label)] = $key;
        }

        return $map;
    }

    private function resolveEnumKey(?string $label, array $map): ?string
    {
        if (! $label) {
            return null;
        }

        return $this->fuzzyMatchEnum(strtolower($label), $map);
    }

    /**
     * Resolve pipe-separated display labels to an array of enum keys.
     * e.g. "Cut or open wound | Puncture wound" → ['cut', 'puncture_wound']
     */
    private function resolveMultiEnumKeys(?string $label, array $map): ?array
    {
        if (! $label) {
            return null;
        }

        $parts = array_map('trim', explode('|', $label));
        $keys = [];
        foreach ($parts as $part) {
            $key = $this->fuzzyMatchEnum(strtolower($part), $map);
            if ($key) {
                $keys[] = $key;
            }
        }

        return count($keys) > 0 ? $keys : null;
    }

    /**
     * Try exact match first, then partial/contains match on enum labels.
     */
    private function fuzzyMatchEnum(string $needle, array $map): ?string
    {
        // Exact match
        if (isset($map[$needle])) {
            return $map[$needle];
        }

        // Partial match: label contains needle or needle contains label
        foreach ($map as $label => $key) {
            if (str_contains($label, $needle) || str_contains($needle, $label)) {
                return $key;
            }
        }

        return null;
    }

    private function parseDateTime($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        // Excel serial number (e.g. 44890 or 44890.625 for date+time)
        if (is_numeric($value)) {
            try {
                $dt = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($value);
                return Carbon::instance($dt)->format('Y-m-d H:i:s');
            } catch (\Exception) {
            }
        }

        $v = trim((string) $value);

        // Try with time: "Wed 25/03/2026 10:30am"
        try {
            return Carbon::createFromFormat('D d/m/Y g:ia', $v)?->format('Y-m-d H:i:s');
        } catch (\Exception) {
        }

        // Try without time: "Tue 10/11/2020"
        try {
            return Carbon::createFromFormat('D d/m/Y', $v)?->startOfDay()->format('Y-m-d H:i:s');
        } catch (\Exception) {
        }

        // Try d/m/Y with or without day name
        try {
            return Carbon::createFromFormat('d/m/Y', $v)?->startOfDay()->format('Y-m-d H:i:s');
        } catch (\Exception) {
        }

        // Fallback: let Carbon guess
        try {
            return Carbon::parse($v)->format('Y-m-d H:i:s');
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

        return strtoupper(trim((string) $value)) === 'YES';
    }

    private function resolveEmployeeId(?string $name): ?int
    {
        if (! $name) {
            return null;
        }

        return $this->employeeMap[strtolower($name)] ?? null;
    }

    private function resolveLocationId(?string $projectName): ?int
    {
        if (! $projectName) {
            return null;
        }

        $key = strtolower($projectName);

        // Exact match
        if (isset($this->locationMap[$key])) {
            return $this->locationMap[$key];
        }

        // Location name contains the project name (e.g. "Coast" matches "COA00 - Coast")
        $candidates = $this->locations->filter(
            fn ($loc) => stripos($loc->name, $projectName) !== false
        );

        if ($candidates->isNotEmpty()) {
            return $this->preferSwcp($candidates)->id;
        }

        // Project name contains the location display name (after code prefix)
        $candidates = $this->locations->filter(function ($loc) use ($projectName) {
            $parts = explode(' - ', $loc->name, 2);
            $displayName = $parts[1] ?? $parts[0];

            return stripos($displayName, $projectName) !== false
                || stripos($projectName, $displayName) !== false;
        });

        if ($candidates->isNotEmpty()) {
            return $this->preferSwcp($candidates)->id;
        }

        return null;
    }

    /**
     * From a set of candidate locations, prefer one under SWCP Jobs.
     */
    private function preferSwcp(Collection $candidates)
    {
        if ($this->swcpJobsEhId) {
            $swcp = $candidates->firstWhere('eh_parent_id', $this->swcpJobsEhId);
            if ($swcp) {
                return $swcp;
            }
        }

        return $candidates->first();
    }
}
