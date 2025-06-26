<?php

namespace App\Services;

use Auth;
use Illuminate\Support\Facades\Storage;
use Log;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\Requisition;
use App\Models\MaterialItem;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Illuminate\Support\Collection;
use Carbon\Carbon;
use App\Models\Location;

class ExcelExportService
{
    public function generateCsv($requisition): string
    {
        $datetime = now()->format('YmdHis');
        $parentId = Location::where('id', $requisition->project_number)->value('eh_parent_id');
        Log::info('Parent ID: ' . $parentId);

        if ($parentId === '1149031') {
            $company = 'SWC';
        }
        if ($parentId === '1198645') {
            $company = 'GREEN';
        }
        $fileName = "PO-{$requisition->po_number}{$datetime}_{$company}.csv";

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
                    $lineItemValue = $lineItem->code ? $lineItem->code . '-' . $lineItem->description : $lineItem->description;
                    return [
                        'AP',
                        'PO' . $requisition->po_number ?? $po_number,
                        $requisition->supplier?->code ?? 'N/A',
                        $requisition->location?->external_id ?? 'N/A',
                        $requisition->order_reference ?? '',
                        Carbon::now()->format('d/m/Y'),
                        Carbon::parse($requisition->date_required)->format('d/m/Y'),
                        Carbon::parse($requisition->date_required)->format('d/m/Y'),
                        'JOB',
                        $requisition->location?->external_id ?? 'N/A',
                        $requisition->requested_by ?? Auth::user()->name,
                        $index + 1,
                        '',
                        $lineItemValue,
                        $lineItem->qty ?? 1,
                        ((float) $lineItem->qty != (int) $lineItem->qty) ? 'm' : 'EA',
                        $lineItem->unit_cost ?? 0,
                        'J',
                        $requisition->location?->external_id ?? 'N/A',
                        $lineItem->cost_code ?? '90-10',
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
