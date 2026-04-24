<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class TrainingRegisterExport implements FromCollection, ShouldAutoSize, WithHeadings, WithStyles
{
    public function __construct(
        protected Collection $rows,
        protected Collection $fileTypes,
    ) {}

    public function collection(): Collection
    {
        return $this->rows->map(function (array $row) {
            $validIds = array_flip($row['files']);
            $jobs = collect($row['kiosks'])
                ->map(fn ($k) => $k['job_number'] ?: $k['name'])
                ->implode(', ');

            $line = [
                $row['name'],
                $jobs,
            ];

            foreach ($this->fileTypes as $ft) {
                $line[] = isset($validIds[$ft['id']]) ? 'Yes' : 'No';
            }

            return $line;
        });
    }

    public function headings(): array
    {
        return [
            'Worker',
            'Jobs',
            ...$this->fileTypes->pluck('name')->all(),
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
}
