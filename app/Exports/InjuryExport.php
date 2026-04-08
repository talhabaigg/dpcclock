<?php

namespace App\Exports;

use App\Models\Injury;
use Illuminate\Database\Eloquent\Builder;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class InjuryExport implements FromQuery, ShouldAutoSize, WithHeadings, WithMapping, WithStyles
{
    protected array $filters;

    public function __construct(array $filters = [])
    {
        $this->filters = $filters;
    }

    public function query(): Builder
    {
        $query = Injury::with(['employee', 'location'])->latest('occurred_at');

        if (! empty($this->filters['location_id'])) {
            $query->where('location_id', $this->filters['location_id']);
        }
        if (! empty($this->filters['employee_id'])) {
            $query->where('employee_id', $this->filters['employee_id']);
        }
        if (! empty($this->filters['incident'])) {
            $query->where('incident', $this->filters['incident']);
        }
        if (! empty($this->filters['report_type'])) {
            $query->where('report_type', $this->filters['report_type']);
        }

        return $query;
    }

    public function headings(): array
    {
        return [
            'ID',
            'Occurred at',
            'Worker',
            'Employee type',
            'Project',
            'Incident',
            'Nature of injury',
            'Mechanisms of incident',
            'Agency of incident',
            'Workcover claim',
            'No. of days lost',
            'Type',
        ];
    }

    public function map($injury): array
    {
        return [
            $injury->id_formal,
            $injury->occurred_at?->format('D d/m/Y g:ia'),
            $injury->employee?->preferred_name ?? $injury->employee?->name ?? $injury->employee_name ?? '',
            $injury->employee?->employment_type ?? '',
            $injury->location?->name ?? '',
            Injury::INCIDENT_OPTIONS[$injury->incident] ?? $injury->incident ?? '',
            $this->mapArrayToLabels($injury->natures, Injury::NATURE_OPTIONS),
            $this->mapArrayToLabels($injury->mechanisms, Injury::MECHANISM_OPTIONS),
            $this->mapArrayToLabels($injury->agencies, Injury::AGENCY_OPTIONS),
            $injury->work_cover_claim ? 'Yes' : 'No',
            $injury->work_days_missed,
            Injury::REPORT_TYPE_OPTIONS[$injury->report_type] ?? '',
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => [
                    'bold' => true,
                    'color' => ['argb' => Color::COLOR_WHITE],
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FF4F81BD'],
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                ],
            ],
        ];
    }

    private function mapArrayToLabels(?array $keys, array $options): string
    {
        if (! $keys || count($keys) === 0) {
            return '';
        }

        return collect($keys)
            ->map(fn ($key) => $options[$key] ?? $key)
            ->implode(' | ');
    }
}
