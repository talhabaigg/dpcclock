<?php

namespace App\Imports;

use App\Models\GlMonthlyBudget;
use App\Models\PremierGlAccount;
use Carbon\Carbon;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithCalculatedFormulas;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class GlBudgetImport implements ToCollection, WithCalculatedFormulas
{
    use Importable;

    public int $insertedCount = 0;

    public int $updatedCount = 0;

    public int $deletedCount = 0;

    /** @var string[] */
    public array $unmatchedCodes = [];

    public array $errors = [];

    private array $months;

    public function __construct(private int $fyYear)
    {
        $this->months = [];
        for ($i = 0; $i < 12; $i++) {
            $this->months[] = date('Y-m', strtotime("{$this->fyYear}-07-01 +{$i} months"));
        }
    }

    public function collection($rows): void
    {
        if ($rows->isEmpty()) {
            $this->errors[] = 'Sheet is empty.';

            return;
        }

        // Header row decides which spreadsheet columns map to which FY months.
        $headerRow = $rows->first()->toArray();
        $colToMonth = $this->mapHeaderToMonths($headerRow);

        if (count($colToMonth) === 0) {
            $this->errors[] = 'No month columns recognised in the header row. Use the downloaded template.';

            return;
        }

        $accountsByNumber = PremierGlAccount::orderBy('account_number')
            ->get(['id', 'account_number'])
            ->keyBy(fn ($a) => (string) $a->account_number);

        foreach ($rows->slice(1) as $row) {
            $cells = $row->toArray();
            $code = trim((string) ($cells[0] ?? ''));
            if ($code === '') {
                continue;
            }

            // Handle "1234 - Description" pasted into the code column
            if (preg_match('/^(\d+)/', $code, $m)) {
                $code = $m[1];
            }

            $account = $accountsByNumber->get($code);
            if (! $account) {
                $this->unmatchedCodes[] = $code;
                continue;
            }

            foreach ($colToMonth as $col => $month) {
                $raw = $cells[$col] ?? null;
                $amount = is_numeric($raw) ? (float) $raw : 0.0;

                $existing = GlMonthlyBudget::where('premier_gl_account_id', $account->id)
                    ->where('fy_year', $this->fyYear)
                    ->where('month', $month)
                    ->first();

                if ($amount == 0.0) {
                    if ($existing) {
                        $existing->delete();
                        $this->deletedCount++;
                    }
                    continue;
                }

                if ($existing) {
                    if ((float) $existing->budget_amount !== $amount) {
                        $existing->budget_amount = $amount;
                        $existing->save();
                        $this->updatedCount++;
                    }
                } else {
                    GlMonthlyBudget::create([
                        'premier_gl_account_id' => $account->id,
                        'fy_year' => $this->fyYear,
                        'month' => $month,
                        'budget_amount' => $amount,
                    ]);
                    $this->insertedCount++;
                }
            }
        }

        // De-duplicate unmatched
        $this->unmatchedCodes = array_values(array_unique($this->unmatchedCodes));
    }

    /**
     * Recognise a header cell as a FY month. Accepts:
     *  - "Jul 2025" / "July 2025"
     *  - "2025-07"
     *  - Excel date serial that resolves to a day in that month
     */
    private function mapHeaderToMonths(array $header): array
    {
        $validMonths = array_flip($this->months);
        $map = [];
        foreach ($header as $col => $cell) {
            if ($cell === null || $cell === '') {
                continue;
            }
            $parsed = $this->tryParseMonth($cell);
            if ($parsed !== null && isset($validMonths[$parsed])) {
                $map[$col] = $parsed;
            }
        }

        return $map;
    }

    private function tryParseMonth(mixed $cell): ?string
    {
        if (is_numeric($cell)) {
            try {
                $dt = ExcelDate::excelToDateTimeObject((float) $cell);

                return $dt->format('Y-m');
            } catch (\Throwable) {
                return null;
            }
        }

        if (is_string($cell)) {
            $cell = trim($cell);
            if (preg_match('/^\d{4}-\d{2}$/', $cell)) {
                return $cell;
            }
            try {
                return Carbon::parse($cell)->format('Y-m');
            } catch (\Throwable) {
                return null;
            }
        }

        return null;
    }
}
