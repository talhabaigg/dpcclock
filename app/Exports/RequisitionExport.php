<?php

namespace App\Exports;

use App\Models\Requisition;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class RequisitionExport implements FromCollection, ShouldAutoSize, WithColumnFormatting, WithHeadings, WithMapping, WithStyles
{
    protected $requisition;

    public function __construct(Requisition $requisition)
    {
        $this->requisition = $requisition;
    }

    public function collection()
    {
        return $this->requisition->lineItems;
    }

    public function headings(): array
    {
        return [
            'AP Subledger',
            'PO #',
            'Vendor Code',
            'Job #',
            'Memo',
            'PO Date',
            'Required Date',
            'Promised Date',
            'Ship To Type',
            'Ship To',
            'Requested By',
            'Line',
            'Item Code',
            'Line Description',
            'Qty',
            'UofM',
            'Unit Cost',
            'Distribution Type',
            'Line Job #',
            'Cost Item',
            'Cost Type',
            'Department',
            'Location',
            'GL Account',
            'GL Division',
            'GL SubAccount',
            'Tax Group',
            'Discount %',
        ];
    }

    public function map($lineItem): array
    {
        static $index = 0;
        $index++;

        $requisition = $this->requisition;

        $lineItemValue = $lineItem->code ? $lineItem->code.'-'.$lineItem->description : $lineItem->description;

        return [
            'AP',
            'NEXT #',
            $requisition->supplier?->code ?? 'N/A',
            $requisition->location?->external_id ?? 'N/A',
            $requisition->notes ?? 'N/A',
            now()->toDateString(),
            $requisition->date_required ?? 'N/A',
            $requisition->date_required ?? 'N/A',
            'JOB',
            $requisition->location?->external_id ?? 'N/A',
            $requisition->requested_by ?? 'N/A',
            $index,
            '',
            $lineItemValue,
            $lineItem->qty ?? 0,
            ((float) $lineItem->qty != (int) $lineItem->qty) ? 'm' : 'EA',
            $lineItem->unit_cost ?? 0,
            'J',
            $requisition->location?->external_id ?? 'N/A',
            $lineItem->cost_code ?? '32-01',
            'MAT',
            '',
            '',
            '',
            '',
            '',
            'GST',
            '',
        ];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            // Style the first row as bold text with white font and blue background.
            1 => [
                'font' => [
                    'bold' => true,
                    'color' => ['argb' => Color::COLOR_WHITE],
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['argb' => 'FF4F81BD'], // Professional Blue
                ],
                'alignment' => [
                    'horizontal' => Alignment::HORIZONTAL_CENTER,
                ],
            ],
        ];
    }

    public function columnFormats(): array
    {
        return [
            'Q' => '"$"#,##0.00', // Unit Cost column
        ];
    }
}
