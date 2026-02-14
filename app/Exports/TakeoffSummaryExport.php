<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class TakeoffSummaryExport implements FromArray, ShouldAutoSize, WithHeadings, WithStyles, WithTitle
{
    public function __construct(
        private array $rows,
        private string $projectName,
    ) {}

    public function title(): string
    {
        return 'Takeoff Summary';
    }

    public function headings(): array
    {
        return [
            'Cond #',
            'Condition Name',
            'Type',
            'Area',
            'Height',
            'Qty',
            'Unit Cost',
            'Labour Cost',
            'Material Cost',
            'Total Cost',
        ];
    }

    public function array(): array
    {
        $data = [];
        $totalLabour = 0;
        $totalMaterial = 0;
        $grandTotal = 0;

        foreach ($this->rows as $row) {
            $data[] = [
                $row['condition_number'],
                $row['condition_name'],
                $row['type'],
                $row['area'],
                $row['height'],
                $row['qty_display'],
                $row['unit_cost'],
                $row['labour_cost'],
                $row['material_cost'],
                $row['total_cost'],
            ];

            $totalLabour += $row['labour_cost'];
            $totalMaterial += $row['material_cost'];
            $grandTotal += $row['total_cost'];
        }

        $data[] = [
            '', '', '', '', '',
            'Grand Total',
            '',
            round($totalLabour, 2),
            round($totalMaterial, 2),
            round($grandTotal, 2),
        ];

        return $data;
    }

    public function styles(Worksheet $sheet): array
    {
        $lastRow = count($this->rows) + 2; // +1 header +1 grand total

        // Format currency columns (G, H, I, J) as numbers with 2 decimals
        $sheet->getStyle("G2:J{$lastRow}")->getNumberFormat()
            ->setFormatCode(NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1);

        return [
            1 => ['font' => ['bold' => true, 'size' => 11]],
            $lastRow => ['font' => ['bold' => true, 'size' => 11]],
        ];
    }
}
