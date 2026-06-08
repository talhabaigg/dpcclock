import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

type Transaction = {
    id: number;
    transaction_date: string | null;
    journal_type: string | null;
    account: string | null;
    account_name: string | null;
    sub_account: string | null;
    sub_account_name: string | null;
    division: string | null;
    description: string | null;
    debit: string | number;
    credit: string | number;
    audit_number: string | null;
    reference_document_number: string | null;
};

type Filters = {
    account: string;
    from: string;
    to: string;
};

type Totals = { debit: number; credit: number; net: number; count: number };

type AccountInfo = { account_number: string; description: string | null } | null;

type PageProps = {
    filters: Filters;
    accountInfo: AccountInfo;
    transactions: Transaction[];
    totals: Totals;
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'GL Budget vs Actual', href: '/reports/gl-budget-actual' },
    { title: 'GL Transactions', href: '/reports/gl-transaction-detail' },
];

const formatCurrency = (value: number): string => {
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
};

const formatDate = (value: string | null): string => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Sticky on each <th> — border-collapse: collapse breaks thead-level sticky in some browsers.
const HEAD = 'sticky top-0 z-20 h-7 px-2 py-1 text-[11px] font-semibold text-muted-foreground text-left bg-background border-b border-border';
const CELL = 'py-1 px-2 text-xs';

export default function GlTransactionDetailReport({ filters, accountInfo, transactions, totals }: PageProps) {
    const hasData = transactions.length > 0;

    const accountTitle = accountInfo
        ? `${accountInfo.account_number}${accountInfo.description ? ' — ' + accountInfo.description : ''}`
        : 'All Accounts';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`GL Transactions — ${accountInfo?.account_number ?? 'All'}`} />

            <div className="mx-auto flex h-[calc(100svh-4rem)] w-full max-w-7xl flex-col p-3 lg:p-4">
                <div className="mb-3 shrink-0 text-center">
                    <h2 className="text-foreground text-sm font-bold">GL Transaction Detail</h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                        {accountTitle} &mdash; {formatDate(filters.from)} to {formatDate(filters.to)}
                        <span className="text-muted-foreground/70"> &nbsp;&middot;&nbsp; {totals.count.toLocaleString('en-AU')} {totals.count === 1 ? 'transaction' : 'transactions'}</span>
                    </p>
                </div>

                <div className="min-h-0 flex-1 overflow-auto border-t border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full min-w-[1000px] caption-bottom text-xs">
                    <thead>
                        <tr>
                            <th className={cn(HEAD, 'pl-3')}>Date</th>
                            <th className={HEAD}>Journal</th>
                            <th className={HEAD}>Account</th>
                            <th className={HEAD}>Sub-Account</th>
                            <th className={HEAD}>Division</th>
                            <th className={HEAD}>Description</th>
                            <th className={HEAD}>Reference</th>
                            <th className={HEAD}>Audit #</th>
                            <th className={cn(HEAD, 'text-right')}>Debit</th>
                            <th className={cn(HEAD, 'text-right')}>Credit</th>
                            <th className={cn(HEAD, 'pr-3 text-right')}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!hasData ? (
                            <tr>
                                <td colSpan={11} className="py-12 text-center">
                                    <p className="text-muted-foreground text-xs">No GL transactions for this account and period.</p>
                                </td>
                            </tr>
                        ) : (
                            (() => {
                                let running = 0;
                                return transactions.map((t) => {
                                    const debit = Number(t.debit ?? 0);
                                    const credit = Number(t.credit ?? 0);
                                    running += debit - credit;
                                    return (
                                        <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                                            <td className={cn(CELL, 'pl-3 whitespace-nowrap text-muted-foreground')}>
                                                {formatDate(t.transaction_date)}
                                            </td>
                                            <td className={cn(CELL, 'tabular-nums text-muted-foreground')}>
                                                {t.journal_type ?? '—'}
                                            </td>
                                            <td className={cn(CELL, 'tabular-nums')}>{t.account ?? '—'}</td>
                                            <td className={cn(CELL, 'tabular-nums text-muted-foreground')}>
                                                {t.sub_account ?? '—'}
                                                {t.sub_account_name ? (
                                                    <span className="ml-1 text-[10px] text-muted-foreground/80">{t.sub_account_name}</span>
                                                ) : null}
                                            </td>
                                            <td className={cn(CELL, 'tabular-nums text-muted-foreground')}>
                                                {t.division ?? '—'}
                                            </td>
                                            <td className={cn(CELL, 'max-w-[280px] truncate text-foreground')} title={t.description ?? ''}>
                                                {t.description ?? '—'}
                                            </td>
                                            <td className={cn(CELL, 'text-muted-foreground')}>
                                                {t.reference_document_number ?? '—'}
                                            </td>
                                            <td className={cn(CELL, 'tabular-nums text-muted-foreground')}>
                                                {t.audit_number ?? '—'}
                                            </td>
                                            <td className={cn(CELL, 'text-right tabular-nums')}>
                                                {debit > 0 ? formatCurrency(debit) : ''}
                                            </td>
                                            <td className={cn(CELL, 'text-right tabular-nums')}>
                                                {credit > 0 ? formatCurrency(credit) : ''}
                                            </td>
                                            <td className={cn(CELL, 'pr-3 text-right tabular-nums font-medium')}>
                                                {formatCurrency(running)}
                                            </td>
                                        </tr>
                                    );
                                });
                            })()
                        )}
                    </tbody>
                    {hasData && (
                        <tfoot>
                            <tr>
                                <td colSpan={8} className="pl-3 py-1.5 text-xs font-bold border-y border-border">
                                    Total
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                    {formatCurrency(totals.debit)}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                    {formatCurrency(totals.credit)}
                                </td>
                                <td className="py-1.5 px-2 pr-3 text-right tabular-nums text-xs font-bold border-y border-border">
                                    {formatCurrency(totals.net)}
                                </td>
                            </tr>
                        </tfoot>
                    )}
                </table>
                </div>
            </div>
        </AppLayout>
    );
}
