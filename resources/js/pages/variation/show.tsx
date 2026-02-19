import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn, fmtCurrency, fmtPercent } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Copy, Download, Eye, Pencil, Printer, Send } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

interface PricingItem {
    id: number;
    description: string;
    qty: number;
    unit: string;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
    sell_rate?: number | null;
    sell_total?: number | null;
    sort_order: number;
    condition?: {
        name: string;
        condition_type?: { name: string; unit: string; color: string } | null;
    } | null;
}

interface LineItem {
    id: number;
    line_number: number;
    cost_item: string;
    cost_type: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    revenue: number;
}

interface Props {
    variation: {
        id: number;
        co_number: string;
        type: string;
        description: string;
        status: string;
        co_date: string;
        location_id: number;
        location: { id: number; name: string } | null;
        created_by: string;
        updated_by: string | null;
        markup_percentage: number | null;
        client_notes: string | null;
        premier_co_id: string | null;
        drawing_id: number | null;
        drawing: { id: number; name: string } | null;
        pricing_items: PricingItem[];
        line_items: LineItem[];
    };
    totals: {
        cost: number;
        revenue: number;
        pricing_cost: number;
        pricing_sell: number;
    };
}

// ── Helpers ──────────────────────────────────────────────────────────────

const statusVariants: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
};

function getStatusClasses(status: string) {
    return statusVariants[status] ?? 'bg-muted text-muted-foreground border';
}

function formatCurrency(value: number | string) {
    return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const isSentOrApproved = (status: string) => status === 'sent' || status === 'Approved';

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">{label}</span>
            <p className="mt-0.5 text-sm font-medium">{value || '\u2014'}</p>
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function VariationShow({ variation, totals }: Props) {
    const locked = isSentOrApproved(variation.status);
    const totalCost = Number(totals.cost) || 0;
    const totalRevenue = Number(totals.revenue) || 0;
    const totalSell = Number(totals.pricing_sell) || 0;
    const margin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Variations', href: '/variations' },
        { title: variation.co_number, href: `/variations/${variation.id}/show` },
    ];

    const hasSellRates = variation.pricing_items.some((p) => p.sell_total != null && Number(p.sell_total) > 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Variation ${variation.co_number}`} />

            <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="font-mono text-xl font-bold">{variation.co_number}</h1>
                        <Badge variant="outline" className={cn('text-xs capitalize', getStatusClasses(variation.status))}>
                            {variation.status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs capitalize">
                            {variation.type}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                            <ArrowLeft className="mr-1.5 h-4 w-4" />
                            Back
                        </Button>
                        <Button variant="outline" size="sm" disabled={locked} onClick={() => router.visit(`/variations/${variation.id}/edit`)}>
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/variations/${variation.id}/client-quote`} target="_blank" rel="noopener noreferrer">
                                <Printer className="mr-1.5 h-4 w-4" />
                                Print
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/variations/${variation.id}/download/excel`}>
                                <Download className="mr-1.5 h-4 w-4" />
                                Excel
                            </a>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={locked}
                            onClick={() => {
                                if (confirm('Send this variation to Premier?')) {
                                    router.visit(`/variations/${variation.id}/send-to-premier`);
                                }
                            }}
                        >
                            <Send className="mr-1.5 h-4 w-4" />
                            Send to Premier
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                if (confirm('Duplicate this variation?')) {
                                    router.visit(`/variations/${variation.id}/duplicate`);
                                }
                            }}
                        >
                            <Copy className="mr-1.5 h-4 w-4" />
                            Duplicate
                        </Button>
                    </div>
                </div>

                {/* ── Summary Cards ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="bg-card rounded-lg border p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Total Cost</div>
                        <div className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(totalCost)}</div>
                    </div>
                    <div className="bg-card rounded-lg border p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Total Revenue</div>
                        <div className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(totalRevenue)}</div>
                    </div>
                    <div className="bg-card rounded-lg border p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Margin</div>
                        <div className={cn('mt-1 text-lg font-bold tabular-nums', margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {formatCurrency(margin)}
                        </div>
                    </div>
                    <div className="bg-card rounded-lg border p-3">
                        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Margin %</div>
                        <div className={cn('mt-1 text-lg font-bold tabular-nums', marginPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                            {marginPercent.toFixed(1)}%
                        </div>
                    </div>
                </div>

                {/* ── Details Card ──────────────────────────────────────── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Variation Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <DetailField label="CO Number" value={variation.co_number} />
                            <DetailField label="Type" value={variation.type} />
                            <DetailField label="Date" value={variation.co_date ? new Date(variation.co_date + 'T00:00:00').toLocaleDateString('en-GB') : null} />
                            <DetailField label="Location" value={variation.location?.name} />
                            <DetailField label="Created By" value={variation.created_by} />
                            {variation.updated_by && <DetailField label="Updated By" value={variation.updated_by} />}
                            {variation.drawing && <DetailField label="Drawing" value={variation.drawing.name} />}
                            {variation.premier_co_id && <DetailField label="Premier CO ID" value={variation.premier_co_id} />}
                            {variation.markup_percentage != null && <DetailField label="Markup %" value={`${variation.markup_percentage}%`} />}
                        </div>
                        {variation.description && (
                            <>
                                <Separator className="my-4" />
                                <div>
                                    <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Description</span>
                                    <p className="mt-1 text-sm whitespace-pre-wrap">{variation.description}</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* ── Pricing Items ────────────────────────────────────── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Pricing Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {variation.pricing_items.length === 0 ? (
                            <p className="text-muted-foreground py-6 text-center text-sm">No pricing items</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[700px] text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 border-b">
                                            <th className="text-muted-foreground px-3 py-2 text-left font-medium">Description</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Qty</th>
                                            <th className="text-muted-foreground px-3 py-2 text-center font-medium">Unit</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Labour</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Material</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Total</th>
                                            {hasSellRates && (
                                                <>
                                                    <th className="text-muted-foreground px-3 py-2 text-right font-medium">Sell Rate</th>
                                                    <th className="text-muted-foreground px-3 py-2 text-right font-medium">Sell Total</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {variation.pricing_items.map((item) => (
                                            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        {item.condition?.condition_type?.color && (
                                                            <span
                                                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                                                style={{ backgroundColor: item.condition.condition_type.color }}
                                                            />
                                                        )}
                                                        <span className="truncate">{item.description}</span>
                                                        {item.condition && (
                                                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                                                                Condition
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">{Number(item.qty).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-center">{item.unit}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.labour_cost)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(item.material_cost)}</td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatCurrency(item.total_cost)}</td>
                                                {hasSellRates && (
                                                    <>
                                                        <td className="px-3 py-2 text-right tabular-nums">{item.sell_rate != null ? formatCurrency(item.sell_rate) : '\u2014'}</td>
                                                        <td className="px-3 py-2 text-right font-medium tabular-nums">{item.sell_total != null ? formatCurrency(item.sell_total) : '\u2014'}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-muted/30 border-t font-semibold">
                                            <td className="px-3 py-2" colSpan={3}>Totals</td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {formatCurrency(variation.pricing_items.reduce((s, i) => s + Number(i.labour_cost), 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {formatCurrency(variation.pricing_items.reduce((s, i) => s + Number(i.material_cost), 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {formatCurrency(variation.pricing_items.reduce((s, i) => s + Number(i.total_cost), 0))}
                                            </td>
                                            {hasSellRates && (
                                                <>
                                                    <td className="px-3 py-2"></td>
                                                    <td className="px-3 py-2 text-right tabular-nums">
                                                        {formatCurrency(variation.pricing_items.reduce((s, i) => s + Number(i.sell_total || 0), 0))}
                                                    </td>
                                                </>
                                            )}
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Premier Line Items ────────────────────────────────── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Premier Line Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {variation.line_items.length === 0 ? (
                            <p className="text-muted-foreground py-6 text-center text-sm">No Premier line items generated yet</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[800px] text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 border-b">
                                            <th className="text-muted-foreground w-16 px-3 py-2 text-center font-medium">#</th>
                                            <th className="text-muted-foreground px-3 py-2 text-left font-medium">Cost Item</th>
                                            <th className="text-muted-foreground px-3 py-2 text-left font-medium">Type</th>
                                            <th className="text-muted-foreground px-3 py-2 text-left font-medium">Description</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Qty</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Unit Cost</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Total Cost</th>
                                            <th className="text-muted-foreground px-3 py-2 text-right font-medium">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {variation.line_items.map((item) => (
                                            <tr
                                                key={item.id}
                                                className={cn(
                                                    'border-b last:border-0 hover:bg-muted/30',
                                                    item.cost_type === 'REV' && 'bg-emerald-50/50 dark:bg-emerald-950/20',
                                                )}
                                            >
                                                <td className="px-3 py-2 text-center">
                                                    <span className="bg-muted inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium">
                                                        {item.line_number}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 font-mono text-xs">{item.cost_item}</td>
                                                <td className="px-3 py-2">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {item.cost_type}
                                                    </Badge>
                                                </td>
                                                <td className="max-w-[250px] truncate px-3 py-2">{item.description}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{item.cost_type === 'REV' ? '\u2014' : Number(item.qty).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{item.cost_type === 'REV' ? '\u2014' : formatCurrency(item.unit_cost)}</td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums">{item.cost_type === 'REV' ? '\u2014' : formatCurrency(item.total_cost)}</td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                                                    {Number(item.revenue) ? formatCurrency(item.revenue) : '\u2014'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-muted/30 border-t font-semibold">
                                            <td className="px-3 py-2" colSpan={6}>Totals</td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {formatCurrency(variation.line_items.reduce((s, i) => s + (i.cost_type === 'REV' ? 0 : Number(i.total_cost)), 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                                                {formatCurrency(variation.line_items.reduce((s, i) => s + Number(i.revenue || 0), 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Client Notes ──────────────────────────────────────── */}
                {(variation.client_notes || hasSellRates) && (
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Client</CardTitle>
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`/variations/${variation.id}/client-quote`} target="_blank" rel="noopener noreferrer">
                                        <Eye className="mr-1.5 h-4 w-4" />
                                        Print Quote
                                    </a>
                                </Button>
                            </div>
                        </CardHeader>
                        {variation.client_notes && (
                            <CardContent>
                                <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Client Notes</span>
                                <p className="mt-1 text-sm whitespace-pre-wrap">{variation.client_notes}</p>
                            </CardContent>
                        )}
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
