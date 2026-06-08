<?php

namespace App\Http\Controllers;

use App\Models\GlTransactionDetail;
use App\Models\PremierGlAccount;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GlTransactionDetailReportController extends Controller
{
    public function index(Request $request)
    {
        $account = trim((string) $request->query('account', ''));
        $from = $this->sanitizeDate($request->query('from'));
        $to = $this->sanitizeDate($request->query('to'));

        if ($from === null || $to === null) {
            $from = $from ?? now()->startOfMonth()->toDateString();
            $to = $to ?? now()->endOfMonth()->toDateString();
        }
        if ($from > $to) {
            [$from, $to] = [$to, $from];
        }

        $query = GlTransactionDetail::query()
            ->where('company_code', 'SWCP')
            ->whereBetween('transaction_date', [$from, $to]);

        if ($account !== '') {
            $query->where('account', $account);
        }

        $transactions = $query
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get([
                'id',
                'transaction_date',
                'journal_type',
                'account',
                'account_name',
                'sub_account',
                'sub_account_name',
                'division',
                'description',
                'debit',
                'credit',
                'audit_number',
                'reference_document_number',
            ]);

        $totalDebit = (float) $transactions->sum('debit');
        $totalCredit = (float) $transactions->sum('credit');

        $accountInfo = null;
        if ($account !== '') {
            $premier = PremierGlAccount::where('account_number', $account)->first(['account_number', 'description']);
            $accountInfo = [
                'account_number' => $account,
                'description' => $premier?->description,
            ];
        }

        return Inertia::render('gl-transaction-detail/index', [
            'filters' => [
                'account' => $account,
                'from' => $from,
                'to' => $to,
            ],
            'accountInfo' => $accountInfo,
            'transactions' => $transactions,
            'totals' => [
                'debit' => $totalDebit,
                'credit' => $totalCredit,
                'net' => $totalDebit - $totalCredit,
                'count' => $transactions->count(),
            ],
        ]);
    }

    private function sanitizeDate(mixed $value): ?string
    {
        if (! is_string($value) || $value === '') {
            return null;
        }
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        return $value;
    }
}
