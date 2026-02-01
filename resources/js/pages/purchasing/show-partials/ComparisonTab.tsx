import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, FileText, Minus, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

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
        unchanged: { label: 'Match', className: 'text-green-600 border-green-200 bg-green-50' },
        modified: { label: 'Modified', className: 'text-amber-600 border-amber-200 bg-amber-50' },
        added: { label: 'Added in Premier', className: 'text-blue-600 border-blue-200 bg-blue-50' },
        removed: { label: 'Removed', className: 'text-red-600 border-red-200 bg-red-50' },
    };

    const { label, className } = config[status];

    return (
        <Badge variant="outline" className={className}>
            {label}
        </Badge>
    );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VarianceCell = ({ variance, isCurrency = false }: { variance: Variance; isCurrency?: boolean }) => {
    if (!variance.has_change) {
        return <span className="text-muted-foreground">{isCurrency ? formatCurrency(variance.local) : variance.local}</span>;
    }

    const isPositive = variance.difference > 0;

    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-xs line-through">{isCurrency ? formatCurrency(variance.local) : variance.local}</span>
                <span className="font-medium">{isCurrency ? formatCurrency(variance.premier) : variance.premier}</span>
            </div>
            <div className={cn('flex items-center gap-0.5 text-xs', isPositive ? 'text-rose-600' : 'text-emerald-600')}>
                {isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {isCurrency ? formatCurrency(Math.abs(variance.difference)) : Math.abs(variance.difference).toFixed(2)}
            </div>
        </div>
    );
};

const SummaryCard = ({
    title,
    value,
    icon: Icon,
    variant,
}: {
    title: string;
    value: number | string;
    icon: React.ElementType;
    variant: 'default' | 'success' | 'warning' | 'danger';
}) => {
    const variantStyles = {
        default: 'text-muted-foreground',
        success: 'text-emerald-600',
        warning: 'text-amber-600',
        danger: 'text-rose-600',
    };

    return (
        <Card>
            <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-xs">{title}</p>
                        <p className={cn('text-2xl font-bold', variantStyles[variant])}>{value}</p>
                    </div>
                    <Icon className={cn('size-8 opacity-50', variantStyles[variant])} />
                </div>
            </CardContent>
        </Card>
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
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
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

    if (!premierPoId) {
        return (
            <Alert className="mt-4">
                <AlertCircle className="size-4" />
                <AlertTitle>Comparison Not Available</AlertTitle>
                <AlertDescription>
                    This requisition has not been synced with Premier yet. Send the PO to Premier first to enable comparison.
                </AlertDescription>
            </Alert>
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
        <div className="mt-4 space-y-6">
            {/* Header with Refresh */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-muted-foreground text-sm">Last fetched: {new Date(fetched_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)}>
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
                <Card className="bg-slate-50 p-4 text-xs">
                    <p className="font-semibold">Debug Info:</p>
                    <p>Local items: {debug.local_count} | Premier items: {debug.premier_count} | Invoice lines: {debug.invoice_lines_count ?? 0}</p>

                    <div className="mt-3 grid grid-cols-2 gap-4">
                        <div className="rounded border bg-white p-2">
                            <p className="font-semibold text-green-700">Local Sample:</p>
                            {Array.isArray(debug.local_sample) ? debug.local_sample.map((item, i) => (
                                <div key={i} className="mt-1 border-t pt-1">
                                    <p><span className="text-muted-foreground">Line:</span> {item.line_number ?? 'null'}</p>
                                    <p><span className="text-muted-foreground">Code:</span> {item.code || 'null'}</p>
                                    <p><span className="text-muted-foreground">Desc:</span> {item.description || 'null'}</p>
                                    <p><span className="text-muted-foreground">Qty:</span> {item.qty} @ {formatCurrency(item.unit_cost)}</p>
                                    <p><span className="text-muted-foreground">Price List:</span> <span className="font-medium text-blue-600">{item.price_list ?? 'null'}</span></p>
                                </div>
                            )) : <pre className="text-red-500">{JSON.stringify(debug.local_sample, null, 2)}</pre>}
                        </div>

                        <div className="rounded border bg-white p-2">
                            <p className="font-semibold text-blue-700">Premier Sample:</p>
                            {Array.isArray(debug.premier_sample) ? debug.premier_sample.map((item, i) => (
                                <div key={i} className="mt-1 border-t pt-1">
                                    <p><span className="text-muted-foreground">Line:</span> {item.line_number ?? 'null'}</p>
                                    <p><span className="text-muted-foreground">Desc:</span> {item.description || 'null'}</p>
                                    <p><span className="text-muted-foreground">Qty:</span> {item.qty} @ {formatCurrency(item.unit_cost)}</p>
                                </div>
                            )) : <pre className="text-red-500">{JSON.stringify(debug.premier_sample, null, 2)}</pre>}
                            {Array.isArray(debug.premier_sample) && debug.premier_sample.length === 0 && <p className="text-red-500">No Premier data received!</p>}
                        </div>
                    </div>

                    {/* Invoice Lines Sample */}
                    {debug.invoice_lines_sample && debug.invoice_lines_sample.length > 0 && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold text-purple-700">Invoice Lines Sample ({debug.invoice_lines_count} total):</p>
                            <pre className="mt-1 max-h-40 overflow-auto text-xs bg-gray-50 p-1 rounded">{JSON.stringify(debug.invoice_lines_sample, null, 2)}</pre>
                        </div>
                    )}

                    {debug.premier_raw_sample && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold text-purple-700">
                                Raw Premier API Response
                                {(debug.premier_raw_sample as Record<string, unknown>).total_count !== undefined && (
                                    <span className="ml-2 font-normal">
                                        ({String((debug.premier_raw_sample as Record<string, unknown>).total_count)} items returned)
                                    </span>
                                )}
                            </p>
                            {debug.expected_po_id && (
                                <p className="text-xs">
                                    Expected PO ID: <code className="bg-gray-100 px-1">{debug.expected_po_id}</code>
                                </p>
                            )}
                            <pre className="mt-1 max-h-60 overflow-auto text-xs">{JSON.stringify(debug.premier_raw_sample, null, 2)}</pre>
                        </div>
                    )}

                    {debug.invoice_query && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold text-orange-700">Invoice Query Debug</p>
                            <p className="text-xs">
                                Method: <code className="bg-gray-100 px-1">{debug.invoice_query.method}</code>
                            </p>
                            <p className="text-xs mt-1">
                                PO Number: <code className="bg-gray-100 px-1">{debug.invoice_query.po_number || 'N/A'}</code>
                            </p>
                            <p className="text-xs mt-1 font-medium">
                                Invoices found: {debug.invoice_query.invoices_found}
                            </p>
                        </div>
                    )}

                    {/* Description Similarity Comparison */}
                    {debug.description_comparison && debug.description_comparison.length > 0 && (
                        <div className="mt-3 rounded border bg-white p-2">
                            <p className="font-semibold text-indigo-700">Matching Scores (Local → Invoice)</p>
                            <p className="text-xs text-muted-foreground mb-2">Threshold: 30% | Matches by: description OR cost</p>
                            <div className="space-y-3 max-h-80 overflow-auto">
                                {debug.description_comparison.map((item, i) => (
                                    <div key={i} className="border-b pb-2">
                                        <p className="text-xs font-medium text-blue-700">
                                            Local: "{item.local_desc}"
                                            <span className="text-muted-foreground ml-1">(${item.local_total?.toFixed(2)})</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground ml-2">Words: [{item.local_words?.join(', ')}]</p>
                                        <div className="ml-4 mt-1 space-y-1">
                                            {item.invoice_matches.map((match, j) => (
                                                <div key={j} className="flex items-center gap-2 text-xs flex-wrap">
                                                    <span className={cn(
                                                        'font-mono px-1 rounded font-bold',
                                                        (match.best_desc >= 30 || match.cost_match) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                    )}>
                                                        {match.best_desc}%
                                                    </span>
                                                    <span className="text-muted-foreground">(str:{match.similar_text}% word:{match.word_match}%)</span>
                                                    {match.cost_match && (
                                                        <span className="bg-blue-100 text-blue-700 px-1 rounded font-bold">
                                                            💰 {match.cost_match}
                                                        </span>
                                                    )}
                                                    <span className="text-purple-700">"{match.invoice_desc}"</span>
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

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <SummaryCard title="Matched Items" value={summary.unchanged_count} icon={CheckCircle2} variant="success" />
                <SummaryCard
                    title="Modified Items"
                    value={summary.modified_count}
                    icon={AlertCircle}
                    variant={summary.modified_count > 0 ? 'warning' : 'default'}
                />
                <SummaryCard title="Added in Premier" value={summary.added_count} icon={Plus} variant={summary.added_count > 0 ? 'warning' : 'default'} />
                <SummaryCard title="Removed" value={summary.removed_count} icon={Minus} variant={summary.removed_count > 0 ? 'danger' : 'default'} />
            </div>

            {/* Total Variance Banner */}
            {/* Totals Summary Banner */}
            <Card className="bg-muted/30 p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Original (Local)</p>
                        <p className="text-xl font-bold text-blue-700">{formatCurrency(local_total)}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Premier PO</p>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(premier_total)}</p>
                        {poVariance !== 0 && (
                            <p className={cn('text-xs', poVariance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {poVariance > 0 ? '+' : ''}{formatCurrency(poVariance)} from original
                            </p>
                        )}
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">Invoiced</p>
                        <p className="text-xl font-bold text-purple-700">{formatCurrency(invoice_total)}</p>
                        {invoice_total > 0 && invoiceVariance !== 0 && (
                            <p className={cn('text-xs', invoiceVariance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                {invoiceVariance > 0 ? '+' : ''}{formatCurrency(invoiceVariance)} from PO
                            </p>
                        )}
                    </div>
                </div>
            </Card>

            {!summary.has_discrepancies && (
                <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="size-4 text-green-600" />
                    <AlertTitle className="text-green-800">No Discrepancies Found</AlertTitle>
                    <AlertDescription className="text-green-700">All line items match between local and Premier records.</AlertDescription>
                </Alert>
            )}

            {/* Invoice Status */}
            {invoices && !invoices.has_invoices && (
                <Alert className="border-amber-200 bg-amber-50">
                    <FileText className="size-4 text-amber-600" />
                    <AlertTitle className="text-amber-800">No Invoices Received</AlertTitle>
                    <AlertDescription className="text-amber-700">
                        No invoices have been posted for this PO yet. Comparison results may change once invoices are processed.
                    </AlertDescription>
                </Alert>
            )}

            {invoices && invoices.has_invoices && (
                <Alert className="border-green-200 bg-green-50">
                    <FileText className="size-4 text-green-600" />
                    <AlertTitle className="text-green-800">
                        {invoices.count} Invoice{invoices.count > 1 ? 's' : ''} Received — Total: {formatCurrency(invoices.total)}
                    </AlertTitle>
                    <AlertDescription className="text-green-700">
                        <div className="mt-2 space-y-1">
                            {invoices.invoices.map((inv, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm">
                                    <span className="font-medium">{inv.invoice_number}</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : 'No date'}</span>
                                    <span className="text-muted-foreground">•</span>
                                    <span>{formatCurrency(inv.total)}</span>
                                    {inv.status && (
                                        <>
                                            <span className="text-muted-foreground">•</span>
                                            <Badge variant="outline" className="text-xs">{inv.status}</Badge>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            {/* Comparison Table */}
            <Card className="p-0">
                <CardHeader>
                    <CardTitle>Line Item Comparison</CardTitle>
                    <p className="text-muted-foreground text-sm">Comparing original requisition → Premier PO → Invoiced amounts</p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table className="min-w-[1600px]">
                            <TableHeader>
                                <TableRow className="border-b-2">
                                    <TableHead rowSpan={2} className="w-[80px] border-r bg-muted/30 align-middle">Status</TableHead>
                                    <TableHead rowSpan={2} className="min-w-[180px] border-r bg-muted/30 align-middle">Description</TableHead>
                                    <TableHead colSpan={4} className="border-r bg-blue-50 text-center text-blue-700">Original (Local)</TableHead>
                                    <TableHead colSpan={4} className="border-r bg-green-50 text-center text-green-700">Premier PO</TableHead>
                                    <TableHead colSpan={4} className="border-r bg-purple-50 text-center text-purple-700">Invoiced</TableHead>
                                </TableRow>
                                <TableRow className="border-b-2">
                                    <TableHead className="w-[50px] text-right text-xs text-blue-600">Qty</TableHead>
                                    <TableHead className="w-[100px] text-left text-xs text-blue-600">Price List</TableHead>
                                    <TableHead className="w-[80px] text-right text-xs text-blue-600">Unit</TableHead>
                                    <TableHead className="w-[90px] border-r text-right text-xs text-blue-600">Total</TableHead>
                                    <TableHead className="w-[50px] text-right text-xs text-green-600">Qty</TableHead>
                                    <TableHead className="w-[80px] text-right text-xs text-green-600">Unit</TableHead>
                                    <TableHead className="w-[90px] text-right text-xs text-green-600">Total</TableHead>
                                    <TableHead className="w-[90px] border-r text-right text-xs text-green-600">Δ Original</TableHead>
                                    <TableHead className="w-[50px] text-right text-xs text-purple-600">Qty</TableHead>
                                    <TableHead className="w-[80px] text-right text-xs text-purple-600">Unit</TableHead>
                                    <TableHead className="w-[90px] text-right text-xs text-purple-600">Total</TableHead>
                                    <TableHead className="w-[90px] border-r text-right text-xs text-purple-600">Remaining</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {comparison.map((item, index) => {
                                    const displayItem = item.local || item.premier;
                                    const hasQtyChange = item.variances?.qty.has_change;
                                    const hasUnitChange = item.variances?.unit_cost.has_change;
                                    const hasTotalChange = item.variances?.total_cost.has_change;

                                    // Calculate variance percentage (Local vs Premier)
                                    const totalVariance = item.variances?.total_cost.difference ?? 0;
                                    const localTotal = item.local?.total_cost ?? 0;
                                    const variancePct = localTotal > 0 ? (totalVariance / localTotal) * 100 : 0;

                                    // Calculate remaining (Premier PO - Invoice)
                                    const premierTotal = item.premier?.total_cost ?? 0;
                                    const invoiceTotal = item.invoice?.total_cost ?? 0;
                                    const remaining = premierTotal - invoiceTotal;
                                    const hasInvoice = item.invoice !== null;

                                    return (
                                        <TableRow
                                            key={index}
                                            className={cn(
                                                'hover:bg-muted/20',
                                                item.status === 'added' && 'bg-blue-50/30',
                                                item.status === 'removed' && 'bg-red-50/30',
                                                item.status === 'modified' && 'bg-amber-50/30',
                                            )}
                                        >
                                            {/* Status */}
                                            <TableCell className="border-r">
                                                <StatusBadge status={item.status} />
                                            </TableCell>

                                            {/* Description */}
                                            <TableCell className="max-w-[200px] border-r">
                                                <div className="whitespace-normal break-words text-sm">
                                                    {displayItem?.line_number && (
                                                        <span className="text-muted-foreground mr-1 text-xs">#{displayItem.line_number}</span>
                                                    )}
                                                    {displayItem?.code && <span className="font-medium">{displayItem.code}</span>}
                                                    {displayItem?.code && displayItem?.description && <span className="text-muted-foreground mx-1">-</span>}
                                                    <span>{displayItem?.description || <span className="text-muted-foreground italic">No desc</span>}</span>
                                                </div>
                                            </TableCell>

                                            {/* Original (Local) Values */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.local ? (
                                                    <span className="text-blue-700">{item.local.qty}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-left max-w-[120px]">
                                                {item.local?.price_list != null && item.local.price_list !== '' ? (
                                                    <span className="text-blue-600 text-xs whitespace-normal break-words block">
                                                        {String(item.local.price_list)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.local ? (
                                                    <span className="text-blue-700">{formatCurrency(item.local.unit_cost)}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r text-right tabular-nums">
                                                {item.local ? (
                                                    <span className="font-medium text-blue-700">{formatCurrency(item.local.total_cost)}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>

                                            {/* Premier PO Values with Variance */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.premier ? (
                                                    <div>
                                                        <span className={cn(hasQtyChange ? 'font-bold text-amber-700' : 'text-green-600')}>
                                                            {item.premier.qty}
                                                        </span>
                                                        {hasQtyChange && item.variances && (
                                                            <div className={cn('text-xs', item.variances.qty.difference > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                                                {item.variances.qty.difference > 0 ? '+' : ''}{item.variances.qty.difference}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.premier ? (
                                                    <div>
                                                        <span className={cn(hasUnitChange ? 'font-bold text-amber-700' : 'text-green-600')}>
                                                            {formatCurrency(item.premier.unit_cost)}
                                                        </span>
                                                        {hasUnitChange && item.variances && (
                                                            <div className={cn('text-xs', item.variances.unit_cost.difference > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                                                {item.variances.unit_cost.difference > 0 ? '+' : ''}{formatCurrency(item.variances.unit_cost.difference)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.premier ? (
                                                    <span className={cn('font-medium', hasTotalChange ? 'text-amber-700' : 'text-green-600')}>
                                                        {formatCurrency(item.premier.total_cost)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="border-r text-right tabular-nums">
                                                {item.premier && item.local ? (
                                                    hasTotalChange && item.variances ? (
                                                        <div className={cn('text-xs font-medium', totalVariance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                                            <div>{totalVariance > 0 ? '+' : ''}{formatCurrency(totalVariance)}</div>
                                                            <div className="text-muted-foreground">({variancePct > 0 ? '+' : ''}{variancePct.toFixed(1)}%)</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-emerald-600 text-xs">—</span>
                                                    )
                                                ) : item.status === 'added' ? (
                                                    <span className="text-blue-600 text-xs">New</span>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>

                                            {/* Invoice Values */}
                                            <TableCell className="text-right tabular-nums">
                                                {item.invoice ? (
                                                    <span className="text-purple-700">{item.invoice.qty}</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.invoice ? (
                                                    <span className="text-purple-700">{formatCurrency(item.invoice.unit_cost)}</span>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {item.invoice ? (
                                                    <div>
                                                        <span className="font-medium text-purple-700">{formatCurrency(item.invoice.total_cost)}</span>
                                                        {item.invoice.invoice_number && (
                                                            <div className="text-xs text-muted-foreground">{item.invoice.invoice_number}</div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </TableCell>
                                            {/* Remaining (Premier PO - Invoice) */}
                                            <TableCell className="border-r text-right tabular-nums">
                                                {item.premier ? (
                                                    hasInvoice ? (
                                                        Math.abs(remaining) < 0.01 ? (
                                                            <span className="text-emerald-600 text-xs font-medium">Fully Invoiced</span>
                                                        ) : (
                                                            <div className={cn('text-xs font-medium', remaining > 0 ? 'text-amber-600' : 'text-rose-600')}>
                                                                <div>{remaining > 0 ? '' : '+'}{formatCurrency(Math.abs(remaining))}</div>
                                                                <div className="text-muted-foreground">
                                                                    {remaining > 0 ? 'remaining' : 'over'}
                                                                </div>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <span className="text-amber-600 text-xs">Not invoiced</span>
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
