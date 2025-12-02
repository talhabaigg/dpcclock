<?php

namespace App\Exports;

use App\Models\MaterialItem;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
class MaterialItemExport implements WithColumnFormatting, FromQuery, WithMapping, WithStyles, WithHeadings
{
    /**
     * @return \Illuminate\Support\Query\Builder
     */
    use Exportable;
    public function query()
    {
        return MaterialItem::with('supplier', 'costCode');
    }
    public function columnFormats(): array
    {
        return [
            'A' => NumberFormat::FORMAT_GENERAL,
            'B' => NumberFormat::FORMAT_GENERAL,
            'C' => NumberFormat::FORMAT_GENERAL,
            'D' => NumberFormat::FORMAT_GENERAL,
        ];
    }
    public function styles(Worksheet $sheet)
    {
        return [
            // Style the first row as bold text.
            1 => ['font' => ['bold' => true]],


        ];
    }
    public function headings(): array
    {
        return [
            'Code',
            'Description',
            'Supplier Code',
            'Cost Code',
        ];
    }

    public function map($materialItem): array
    {
        return [
            $materialItem->code,
            $materialItem->description,
            $materialItem->supplier ? $materialItem->supplier->code : '',
            $materialItem->costCode ? $materialItem->costCode->code : '',
        ];
    }

}
