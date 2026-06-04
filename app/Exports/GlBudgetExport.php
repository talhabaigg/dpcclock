<?php

namespace App\Exports;

use App\Models\GlMonthlyBudget;
use App\Models\PremierGlAccount;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class GlBudgetExport implements FromArray, WithEvents, WithHeadings, WithStyles, WithTitle
{
    use Exportable;

    public function __construct(private int $fyYear, private bool $template = false)
    {
    }

    public function title(): string
    {
        return 'GL Budgets';
    }

    public function headings(): array
    {
        $months = $this->fyMonths();
        $monthHeaders = array_map(fn (string $m) => date('M Y', strtotime($m.'-01')), $months);

        return array_merge(['GL Code', 'Account Name'], $monthHeaders);
    }

    public function array(): array
    {
        $months = $this->fyMonths();

        $accounts = PremierGlAccount::orderBy('account_number')
            ->get(['id', 'account_number', 'description']);

        $budgetsByAccount = [];
        if (! $this->template) {
            GlMonthlyBudget::where('fy_year', $this->fyYear)
                ->whereIn('month', $months)
                ->get(['premier_gl_account_id', 'month', 'budget_amount'])
                ->each(function ($b) use (&$budgetsByAccount) {
                    $budgetsByAccount[$b->premier_gl_account_id][$b->month] = (float) $b->budget_amount;
                });
        }

        $out = [];
        foreach ($accounts as $account) {
            $row = [$account->account_number, $account->description ?? ''];
            foreach ($months as $m) {
                $row[] = $budgetsByAccount[$account->id][$m] ?? 0;
            }
            $out[] = $row;
        }

        return $out;
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => ['font' => ['bold' => true], 'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'E2E8F0'],
            ]],
        ];
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $rowCount = count($this->array());
                $months = $this->fyMonths();
                $monthCount = count($months);

                // GL Code (A) and Account Name (B) widths
                $sheet->getColumnDimension('A')->setWidth(12);
                $sheet->getColumnDimension('B')->setWidth(45);

                // Month columns (C onwards) — format as currency, width 14
                for ($i = 0; $i < $monthCount; $i++) {
                    $col = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(3 + $i);
                    $sheet->getColumnDimension($col)->setWidth(14);
                    if ($rowCount > 0) {
                        $sheet->getStyle($col.'2:'.$col.($rowCount + 1))
                            ->getNumberFormat()
                            ->setFormatCode('#,##0.00;(#,##0.00);"-"');
                    }
                }

                // Freeze first row + first two columns
                $sheet->freezePane('C2');
                $sheet->getRowDimension(1)->setRowHeight(22);

                // Right-align numeric columns
                if ($rowCount > 0) {
                    $startCol = 'C';
                    $endCol = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(2 + $monthCount);
                    $sheet->getStyle("{$startCol}2:{$endCol}".($rowCount + 1))
                        ->getAlignment()
                        ->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_RIGHT);
                }

                // Notes sheet
                $notes = $event->sheet->getDelegate()->getParent()->createSheet();
                $notes->setTitle('README');
                $fyLabel = 'FY'.$this->fyYear.'-'.substr((string) ($this->fyYear + 1), 2, 2);
                $notes->fromArray([
                    ["GL Budget Import Template — {$fyLabel}"],
                    [''],
                    ['How to use:'],
                    ['  1. Fill in monthly budget amounts in the "GL Budgets" sheet.'],
                    ['  2. Only the "GL Code" column is used to match accounts — the "Account Name" column is for reference only.'],
                    ['  3. Leave a cell blank or enter 0 to clear that month\'s budget.'],
                    ['  4. Rows for GL Codes not found in the system will be skipped (and reported on upload).'],
                    ['  5. Upload via Budget Management → GL Budgets → Import.'],
                    [''],
                    ['Notes:'],
                    ['  • Amounts are stored without GST.'],
                    ['  • Months follow the Australian FY (Jul–Jun).'],
                    ['  • Save the file as .xlsx.'],
                ], null, 'A1');
                $notes->getColumnDimension('A')->setWidth(90);
                $notes->getStyle('A1')->getFont()->setBold(true)->setSize(13);
            },
        ];
    }

    private function fyMonths(): array
    {
        $months = [];
        for ($i = 0; $i < 12; $i++) {
            $months[] = date('Y-m', strtotime("{$this->fyYear}-07-01 +{$i} months"));
        }

        return $months;
    }
}
