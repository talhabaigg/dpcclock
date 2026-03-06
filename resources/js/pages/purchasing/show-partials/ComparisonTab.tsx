import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Variance = {
    local: number;
    premier: number;
    difference: number;
    has_change: boolean;
};

type LineItem = {
    id: number | string | null;
    line_number: number | null;
    code: string | null;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    cost_code: string | null;
    price_list?: number | string | null;
    has_invoice?: boolean;
    invoice_balance?: number;
    source: 'local' | 'premier';
};

type InvoiceLine = {
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    invoice_number: string | null;
};

type ComparisonItem = {
    status: 'unchanged' | 'modified' | 'added' | 'removed';
    local: LineItem | null;
    premier: LineItem | null;
    invoice: InvoiceLine | null;
    variances: {
        qty: Variance;
        unit_cost: Variance;
        total_cost: Variance;
    } | null;
    match_score: number;
};

type Summary = {
    unchanged_count: number;
    modified_count: number;
    added_count: number;
    removed_count: number;
    total_items: number;
    total_variance: number;
    has_discrepancies: boolean;
};

type Invoice = {
    invoice_number: string | null;
    invoice_date: string | null;
    total: number;
    status: string | null;
    approval_status: string | null;
};

type InvoiceSummary = {
    has_invoices: boolean;
    count: number;
    total: number;
    invoices: Invoice[];
};

type InvoiceMatch = {
    invoice_desc: string;
    similar_text: number;
    word_match: number;
    best_desc: number;
    cost_match: string | null;
    inv_total: number;
};

type DescriptionComparison = {
    local_desc: string;
    local_words: string[];
    local_total: number;
    invoice_matches: InvoiceMatch[];
};

type DebugInfo = {
    local_count: number;
    premier_count: number;
    invoice_lines_count?: number;
    local_sample: LineItem[];
    premier_sample: LineItem[];
    invoice_lines_sample?: unknown[];
    premier_raw_sample?: Record<string, unknown>;
    premier_deleted_lines?: unknown[];
    expected_po_id?: string;
    invoice_query?: {
        method: string;
        po_number?: string;
        invoices_found: number;
    };
    description_comparison?: DescriptionComparison[];
};

type ComparisonData = {
    can_compare: boolean;
    comparison: ComparisonItem[];
    summary: Summary;
    local_total: number;
    premier_total: number;
    invoice_total?: number;
    invoices?: InvoiceSummary;
    fetched_at: string;
    error?: string;
    debug?: DebugInfo;
};

type Props = {
    requisitionId: number;
    premierPoId: string | null;
};

const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
    }).format(value);
};

const StatusBadge = ({ status }: { status: ComparisonItem['status'] }) => {
    const config = {
        unchanged: { label: 'Match', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        modified: { label: 'Modified', className: 'bg-amber-50 text-amber-700 border-amber-200' },
        added: { label: 'Added', className: 'bg-muted text-muted-foreground' },
        removed: { label: 'Local Only', className: 'bg-muted text-muted-foreground' },
    };

    const { label, className } = config[status];

    return (
        <Badge variant="outline" className={cn('text-[10px] font-normal', className)}>
            {label}
        </Badge>
    );
};

export default function ComparisonTab({ requisitionId, premierPoId }: Props) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<ComparisonData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDebug, setShowDebug] = useState(false);

    const fetchComparison = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const url = isRefresh ? `/requisition/${requisitionId}/compare/refresh` : `/requisition/${requisitionId}/compare`;

            const response = await fetch(url, {
                method: isRefresh ? 'POST' : 'GET',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const json = await response.json();

            if (!response.ok) {
                throw new Error(json.error || 'Failed to fetch comparison data');
            }

            setData(json);
            if (isRefresh) {
                toast.success('Comparison data refreshed from Premier.');
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'An error occurred';
            setError(message);
            if (isRefresh) {
                toast.error(message);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (premierPoId) {
            fetchComparison();
        } else {
            setLoading(false);
        }
    }, [requisitionId, premierPoId]);

    const [reloading, setReloading] = useState(false);
    const [backfillError, setBackfillError] = useState<string | null>(null);

    if (!premierPoId) {
        return (
            <div className="mt-4 space-y-3">
                <Alert>
                    <AlertCircle className="size-4" />
                    <AlertTitle>Comparison Not Available</AlertTitle>
                    <AlertDescription className="flex items-center justify-between gap-4">
                        <span>This requisition has not been synced with Premier yet. Send the PO to Premier first to enable comparison.</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={reloading}
                            onClick={async () => {
                                setReloading(true);
                                setBackfillError(null);
                                try {
                                    const response = await fetch(`/requisition/${requisitionId}/compare/refresh`, {
                                        method: 'POST',
                                        headers: {
                                            Accept: 'application/json',
                                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                                        },
                                    });
                                    if (response.ok) {
                                        router.reload({ only: ['requisition'] });
                                    } else {
                                        const json = await response.json();
                                        setBackfillError(json.error || 'Could not find PO in Premier.');
                                    }
                                } catch {
                                    setBackfillError('Failed to connect to Premier.');
                                } finally {
                                    setReloading(false);
                                }
                            }}
                        >
                            {reloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                            Refresh from Premier
                        </Button>
                    </AlertDescription>
                </Alert>
                {backfillError && (
                    <Alert variant="destructive">
                        <AlertCircle className="size-4" />
                        <AlertDescription>{backfillError}</AlertDescription>
                    </Alert>
                )}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
                <Skeleton className="h-64" />
            </div>
        );
    }

    if (error) {
        return (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="size-4" />
                <AlertTitle>Error Loading Comparison</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        );
    }

    if (!data) return null;

    const { comparison, summary, local_total, premier_total, invoice_total = 0, invoices, fetched_at, debug } = data;
    const poVariance = premier_total - local_total;
    const invoiceVariance = invoice_total - premier_total;

    return (
        <div className="mt-4 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">Last fetched: {new Date(fetched_at).toLocaleString()}</p>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowDebug(!showDebug)}>
                        {showDebug ? 'Hide Debug' : 'Debug'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fetchComparison(true)} disabled={refreshing}>
                        <RefreshCw className={cn('mr-2 size-4', refreshing && 'animate-spin')} />
                        Refresh from Premier
                    </Button>
                </div>
            </div>

            {/* Debug Info */}
            {showDebug && debug && (
                <Card className="bg-muted/30 p-4 text-xs">
                    <p className="font-semibold">Debug Info:</p>
                    <p>
                        Local items: {debug.local_count} | Premier items: {debug.premier_count} | Invoice lines: {debug.invoice_lines_count ?? 0}
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                        <div className="rounded border bg-white p-2">
                            <p className="font-semibold">Local Sample:</p>
                            {Array.isArray(debug.local_sample) ? (
                                debug.local_sample.map((item, i) => (
                                    <div key={i} className="mt-1 border-t pt-1">
                                        <p>
                                            <span className="text-muted-foreground">Line:</span> {item.line_number ?? 'null'}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Code:</span> {item.code || 'null'}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Desc:</span> {item.description || 'null'}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Qty:</span> {item.qty} @ {formatCurrency(item.unit_cost)}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Price List:</span>{' '}
                                            <span className="font-medium">{item.price_list ?? 'null'}</span>
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <pre className="text-destructive">{JSON.stringify(debug.local_sample, null, 2)}</pre>
                            )}
                        </div>

                        <div className="rounded border bg-white p-2">
                            <p className="font-semibold">Premier Sample:</p>
                            {Array.isArray(debug.premier_sample) ? (
                                debug.premier_sample.map((item, i) => (
                                    <div key={i} className="mt-1 border-t pt-1">
                                        <p>
                                            <span className="text-muted-foreground">Line:</span> {item.line_number ?? 'null'}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Desc:</span> {item.description || 'null'}
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground">Qty:</span> {item.qty} @ {formatCurrency(item.unit_cost)}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <pre className="text-destructive">{JSON.stringify(debug.premier_sample, null, 2)}</pre>
                            )}
                            {Array.isArray(debug.premier_sample) && debug.premier_sample.length === 0 && (
                                <p className="text-destructive">No Premier data received!</p>
                            )}
                        </div>
                    </div>

                    {debug.invoice_lines_sample && debug.invoice_lines_sample.length > 0 && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold">Invoice Lines Sample ({debug.invoice_lines_count} total):</p>
                            <pre className="bg-muted/30 mt-1 max-h-40 overflow-auto rounded p-1 text-xs">
                                {JSON.stringify(debug.invoice_lines_sample, null, 2)}
                            </pre>
                        </div>
                    )}

                    {debug.premier_raw_sample && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold">
                                Raw Premier API Response
                                {(debug.premier_raw_sample as Record<string, unknown>).total_count !== undefined && (
                                    <span className="ml-2 font-normal">
                                        ({String((debug.premier_raw_sample as Record<string, unknown>).total_count)} items returned)
                                    </span>
                                )}
                            </p>
                            {debug.expected_po_id && (
                                <p className="text-xs">
                                    Expected PO ID: <code className="bg-muted rounded px-1">{debug.expected_po_id}</code>
                                </p>
                            )}
                            <pre className="mt-1 max-h-60 overflow-auto text-xs">{JSON.stringify(debug.premier_raw_sample, null, 2)}</pre>
                        </div>
                    )}

                    {debug.invoice_query && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold">Invoice Query Debug</p>
                            <p className="text-xs">
                                Method: <code className="bg-muted rounded px-1">{debug.invoice_query.method}</code>
                            </p>
                            <p className="mt-1 text-xs">
                                PO Number: <code className="bg-muted rounded px-1">{debug.invoice_query.po_number || 'N/A'}</code>
                            </p>
                            <p className="mt-1 text-xs font-medium">Invoices found: {debug.invoice_query.invoices_found}</p>
                        </div>
                    )}

                    {debug.description_comparison && debug.description_comparison.length > 0 && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold">Matching Scores (Local to Invoice)</p>
                            <p className="text-muted-foreground mb-2 text-xs">Threshold: 30% | Matches by: description OR cost</p>
                            <div className="max-h-80 space-y-3 overflow-auto">
                                {debug.description_comparison.map((item, i) => (
                                    <div key={i} className="border-b pb-2">
                                        <p className="text-xs font-medium">
                                            Local: "{item.local_desc}"
                                            <span className="text-muted-foreground ml-1">(${item.local_total?.toFixed(2)})</span>
                                        </p>
                                        <p className="text-muted-foreground ml-2 text-xs">Words: [{item.local_words?.join(', ')}]</p>
                                        <div className="mt-1 ml-4 space-y-1">
                                            {item.invoice_matches.map((match, j) => (
                                                <div key={j} className="flex flex-wrap items-center gap-2 text-xs">
                                                    <span
                                                        className={cn(
                                                            'rounded px-1 font-mono font-bold',
                                                            match.best_desc >= 30 || match.cost_match
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-muted text-muted-foreground',
                                                        )}
                                                    >
                                                        {match.best_desc}%
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        (str:{match.similar_text}% word:{match.word_match}%)
                                                    </span>
                                                    {match.cost_match && (
                                                        <span className="rounded bg-muted px-1 font-medium">
                                                            {match.cost_match}
                                                        </span>
                                                    )}
                                                    <span>"{match.invoice_desc}"</span>
                                                    <span className="text-muted-foreground">(${match.inv_total?.toFixed(2)})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Summary Row */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-md border px-4 py-3">
                    <p className="text-muted-foreground text-xs">Matched</p>
                    <p className="text-2xl font-semibold">{summary.unchanged_count}</p>
                </div>
                <div className="rounded-md border px-4 py-3">
                    <p className="text-muted-foreground text-xs">Modified</p>
                    <p className={cn('text-2xl font-semibold', summary.modified_count > 0 && 'text-amber-600')}>
                        {summary.modified_count}
                    </p>
                </div>
                <div className="rounded-md border px-4 py-3">
                    <p className="text-muted-foreground text-xs">Added in Premier</p>
                    <p className={cn('text-2xl font-semibold', summary.added_count > 0 && 'text-amber-600')}>
                        {summary.added_count}
                    </p>
                </div>
                <div className="rounded-md border px-4 py-3">
                    <p className="text-muted-foreground text-xs">Removed</p>
                    <p className={cn('text-2xl font-semibold', summary.removed_count > 0 && 'text-rose-600')}>
                        {summary.removed_count}
                    </p>
                </div>
            </div>

            {/* Totals Banner */}
            <div className="grid grid-cols-3 gap-4 rounded-md border px-4 py-4">
                <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Original (Local)</p>
                    <p className="text-xl font-semibold">{formatCurrency(local_total)}</p>
                </div>
                <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Premier PO</p>
                    <p className="text-xl font-semibold">{formatCurrency(premier_total)}</p>
                    {poVariance !== 0 && (
                        <p className={cn('text-xs', poVariance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                            {poVariance > 0 ? '+' : ''}
                            {formatCurrency(poVariance)} from original
                        </p>
                    )}
                </div>
                <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Invoiced</p>
                    <p className="text-xl font-semibold">{formatCurrency(invoice_total)}</p>
                    {invoice_total > 0 && invoiceVariance !== 0 && (
                        <p className={cn('text-xs', invoiceVariance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                            {invoiceVariance > 0 ? '+' : ''}
                            {formatCurrency(invoiceVariance)} from PO
                        </p>
                    )}
                </div>
            </div>

            {!summary.has_discrepancies && (
                <Alert className="border-emerald-200 bg-emerald-50/50">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <AlertTitle>No Discrepancies Found</AlertTitle>
                    <AlertDescription className="text-muted-foreground">All line items match between local and Premier records.</AlertDescription>
                </Alert>
            )}

            {/* Invoice Status */}
            {invoices && !invoices.has_invoices && (
                <Alert>
                    <FileText className="size-4" />
                    <AlertTitle>No Invoices Received</AlertTitle>
                    <AlertDescription className="text-muted-foreground">
                        No invoices have been posted for this PO yet.
                    </AlertDescription>
                </Alert>
            )}

            {invoices && invoices.has_invoices && (
                <div className="rounded-md border px-4 py-3">
                    <p className="text-sm font-medium">
                        {invoices.count} Invoice{invoices.count > 1 ? 's' : ''} Received — {formatCurrency(invoices.total)}
                    </p>
                    <div className="mt-2 space-y-1">
                        {invoices.invoices.map((inv, i) => (
                            <div key={i} className="text-muted-foreground flex items-center gap-2 text-sm">
                                <span className="text-foreground font-medium">{inv.invoice_number}</span>
                                <span>·</span>
                                <span>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : 'No date'}</span>
                                <span>·</span>
                                <span>{formatCurrency(inv.total)}</span>
                                {inv.status && (
                                    <>
                                        <span>·</span>
                                        <span className="text-xs">{inv.status}</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Comparison Table */}
            <Card className="gap-0 p-0">
                <CardHeader className="px-6 py-3">
                    <CardTitle className="text-base">Line Item Comparison</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1400px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead rowSpan={2} className="w-[70px] border-r align-middle text-xs">
                                        Status
                                    </TableHead>
                                    <TableHead rowSpan={2} className="min-w-[180px] border-r align-middle text-xs">
                                        Description
                                    </TableHead>
                                    <TableHead colSpan={4} className="border-r text-center text-xs font-normal text-muted-foreground">
                                        Original (Local)
                                    </TableHead>
                                    <TableHead colSpan={4} className="border-r text-center text-xs font-normal text-muted-foreground">
                                        Premier PO
                                    </TableHead>
                                    <TableHead colSpan={4} className="text-center text-xs font-normal text-muted-foreground">
                                        Invoiced
                                    </TableHead>
                                </TableRow>
                                <TableRow>
                                    <TableHead className="w-[50px] text-right text-xs font-normal text-muted-foreground">Qty</TableHead>
                                    <TableHead className="w-[100px] text-left text-xs font-normal text-muted-foreground">Price List</TableHead>
                                    <TableHead className="w-[80px] text-right text-xs font-normal text-muted-foreground">Unit</TableHead>
                                    <TableHead className="w-[90px] border-r text-right text-xs font-normal text-muted-foreground">Total</TableHead>
                                    <TableHead className="w-[50px] text-right text-xs font-normal text-muted-foreground">Qty</TableHead>
                                    <TableHead className="w-[80px] text-right text-xs font-normal text-muted-foreground">Unit</TableHead>
                                    <TableHead className="w-[90px] text-right text-xs font-normal text-muted-foreground">Total</TableHead>
                                    <TableHead className="w-[90px] border-r text-right text-xs font-normal text-muted-foreground">Variance</TableHead>
                                    <TableHead className="w-[50px] text-right text-xs font-normal text-muted-foreground">Qty</TableHead>
                                    <TableHead className="w-[80px] text-right text-xs font-normal text-muted-foreground">Unit</TableHead>
                                    <TableHead className="w-[90px] text-right text-xs font-normal text-muted-foreground">Total</TableHead>
                                    <TableHead className="w-[90px] text-right text-xs font-normal text-muted-foreground">Remaining</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {comparison.map((item, index) => {
                                    const displayItem = item.local || item.premier;
                                    const hasQtyChange = item.variances?.qty.has_change;
                                    const hasUnitChange = item.variances?.unit_cost.has_change;
                                    const hasTotalChange = item.variances?.total_cost.has_change;

                                    const totalVariance = item.variances?.total_cost.difference ?? 0;
                                    const localTotal = item.local?.total_cost ?? 0;
                                    const variancePct = localTotal > 0 ? (totalVariance / localTotal) * 100 : 0;

                                    const premierTotal = item.premier?.total_cost ?? 0;
                                    const invoiceTotal = item.invoice?.total_cost ?? 0;
                                    const remaining = premierTotal - invoiceTotal;
                                    const hasInvoice = item.invoice !== null;

                                    return (
                                        <TableRow key={index}>
                                            {/* Status */}
                                            <TableCell className="border-r">
                                                <StatusBadge status={item.status} />
                                            </TableCell>

                                            {/* Description */}
                                            <TableCell className="max-w-[200px] border-r">
                                                <div className="text-sm break-words whitespace-normal">
                                                    {displayItem?.line_number && (
                                                        <span className="text-muted-foreground mr-1 text-xs">#{displayItem.line_number}</span>
                                                    )}
                                                    {displayItem?.code && <span className="font-medium">{displayItem.code}</span>}
                                                    {displayItem?.code && displayItem?.description && (
                                                        <span className="text-muted-foreground mx-1">-</span>
                                                    )}
                                                    <span>
                                                        {displayItem?.description || <span className="text-muted-foreground italic">No desc</span>}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* Original (Local) Values */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.local ? item.local.qty : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="max-w-[120px] text-left">
                                                {item.local?.price_list != null && item.local.price_list !== '' ? (
                                                    <span className="block text-xs break-words whitespace-normal">
                                                        {String(item.local.price_list)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.local ? formatCurrency(item.local.unit_cost) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="border-r text-right tabular-nums font-medium">
                                                {item.local ? formatCurrency(item.local.total_cost) : <span className="text-muted-foreground font-normal">—</span>}
                                            </TableCell>

                                            {/* Premier PO Values */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.premier ? (
                                                    <span className={cn(hasQtyChange && 'font-semibold text-amber-700')}>
                                                        {item.premier.qty}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.premier ? (
                                                    <span className={cn(hasUnitChange && 'font-semibold text-amber-700')}>
                                                        {formatCurrency(item.premier.unit_cost)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums font-medium">
                                                {item.premier ? (
                                                    <span className={cn(hasTotalChange && 'text-amber-700')}>
                                                        {formatCurrency(item.premier.total_cost)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground font-normal">—</span>
                                                )}
                                            </TableCell>
                                            {/* Variance column */}
                                            <TableCell className="border-r text-right tabular-nums">
                                                {item.premier && item.local ? (
                                                    hasTotalChange && item.variances ? (
                                                        <div className={cn('text-xs font-medium', totalVariance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                                            <div>
                                                                {totalVariance > 0 ? '+' : ''}
                                                                {formatCurrency(totalVariance)}
                                                            </div>
                                                            <div className="text-muted-foreground font-normal">
                                                                ({variancePct > 0 ? '+' : ''}
                                                                {variancePct.toFixed(1)}%)
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">—</span>
                                                    )
                                                ) : item.status === 'added' ? (
                                                    <span className="text-muted-foreground text-xs">New</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>

                                            {/* Invoice Values */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.invoice ? item.invoice.qty : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.invoice ? formatCurrency(item.invoice.unit_cost) : <span className="text-muted-foreground text-xs">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.invoice ? (
                                                    <div>
                                                        <span className="font-medium">{formatCurrency(item.invoice.total_cost)}</span>
                                                        {item.invoice.invoice_number && (
                                                            <div className="text-muted-foreground text-xs">{item.invoice.invoice_number}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            {/* Remaining */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.premier ? (
                                                    hasInvoice ? (
                                                        Math.abs(remaining) < 0.01 ? (
                                                            <span className="text-xs text-emerald-600">Fully Invoiced</span>
                                                        ) : (
                                                            <div className={cn('text-xs font-medium', remaining > 0 ? 'text-amber-600' : 'text-rose-600')}>
                                                                <div>{formatCurrency(Math.abs(remaining))}</div>
                                                                <div className="text-muted-foreground font-normal">{remaining > 0 ? 'remaining' : 'over'}</div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">Not invoiced</span>
                                                    )
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
