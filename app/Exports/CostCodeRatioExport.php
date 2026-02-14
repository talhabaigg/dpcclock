<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class CostCodeRatioExport implements FromArray, ShouldAutoSize, WithHeadings, WithStyles, WithTitle
{
    public function __construct(
        private array $rows,
    ) {}

    public function title(): string
    {
        return 'Cost Code Ratios';
    }

    public function headings(): array
    {
        return [
            'Job Number',
            'Cost Code',
            'Description',
            'Variation Ratio',
            'Dayworks Ratio',
            'Waste Ratio',
            'Prelim Type',
        ];
    }

    public function array(): array
    {
        return $this->rows;
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}
