<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\Requisition;
use App\Models\MaterialItem;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Illuminate\Support\Collection;

class ExcelExportService
{
    public function generateCsv(Requisition $requisition): string
    {
        $datetime = now()->format('YmdHis');
        $fileName = "PO-{$datetime}_SWC.csv";

        Excel::store(new class ($requisition) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $requisition;

            public function __construct($requisition)
            {
                $this->requisition = $requisition;
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
                    'Discount %'
                ];
            }

            public function collection()
            {
                $requisition = Requisition::with(['lineItems', 'supplier'])->find($this->requisition->id);

                return collect($requisition->lineItems)->map(function ($lineItem, $index) use ($requisition) {
                    $materialItem = MaterialItem::where('code', $lineItem->item_code)->first();
                    $costcode = $materialItem?->costcode;
                    $formattedCostcode = $costcode ? substr($costcode, 0, 2) . '-' . substr($costcode, 2) : 'N/A';
                    $po_number = $requisition->location?->external_id . '-PO-' . $requisition->id;

                    return [
                        'AP',
                        $po_number,
                        $requisition->supplier?->code ?? 'N/A',
                        $requisition->location?->external_id ?? 'N/A',
                        $requisition->notes ?? 'N/A',
                        now()->toDateString(),
                        $requisition->date_required ?? 'N/A',
                        $requisition->date_required ?? 'N/A',
                        'JOB',
                        $requisition->location?->external_id ?? 'N/A',
                        $requisition->requested_by ?? 'N/A',
                        $index + 1,
                        '',
                        $lineItem->code . '-' . $lineItem->description ?? 'N/A',
                        $lineItem->qty ?? 0,
                        'EA',
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
                        ''
                    ];
                });
            }
        }, $fileName, 'public', ExcelFormat::CSV);

        return $fileName;
    }
}
