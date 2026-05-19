import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Bug, ChevronDown, Copy, Download, Eye, Info, Pencil, Printer, Send } from 'lucide-react';

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

interface DirectMaterial {
    id: number;
    line_number: number;
    sort_order: number;
    material_code: string | null;
    material_description: string | null;
    cost_type: string | null;
    description: string | null;
    qty: number | string;
    unit_cost: number | string;
    sell_cost: number | string;
    material_item?: { id: number; code: string; description: string } | null;
    cost_code?: { id: number; code: string; description: string } | null;
    supplier?: { id: number; code: string; name: string } | null;
}

interface Props {
    variation: {
        id: number;
        co_number: string;
        type: string;
        description: string;
        reference_number: string | null;
        display_description: string;
        status: string;
        co_date: string;
        location_id: number;
        location: { id: number; name: string } | null;
        created_by: string;
        updated_by: string | null;
        created_at: string;
        updated_at: string;
        markup_percentage: number | null;
        extra_days: number | null;
        premier_lines_stale: boolean;
        client_notes: string | null;
        premier_co_id: string | null;
        drawing_id: number | null;
        drawing: { id: number; name: string } | null;
        pricing_items: PricingItem[];
        line_items: LineItem[];
        direct_materials: DirectMaterial[];
    };
    totals: {
        cost: number;
        revenue: number;
        pricing_cost: number;
        pricing_sell: number;
        direct_material_cost: number;
        direct_material_sell: number;
        client_total: number;
    };
    locationScope?: { id: number; name: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(value: number | string) {
    return `$${Math.ceil(Number(value) || 0).toLocaleString('en-US')}`;
}

function formatMoney2(value: number | string | null | undefined) {
    if (value == null) return '—';
    return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimestamp(iso: string | null | undefined, by: string | null | undefined): string {
    if (!iso) return '—';
    const when = new Date(iso).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
    return by ? `${when} · ${by}` : when;
}

const isSentOrApproved = (status: string) => status === 'sent' || status === 'Approved';

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
    return (
        <div>
            <span className="text-muted-foreground text-xs">{label}</span>
            <p className="mt-0.5 text-xs font-medium">{value || '—'}</p>
        </div>
    );
}

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{title}</h2>
            {action}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function VariationShow({ variation, totals, locationScope }: Props) {
    const { props: pageProps } = usePage<{ appEnv?: string }>();
    const isLocal = pageProps.appEnv === 'local';
    const locked = isSentOrApproved(variation.status);
    const totalCost = Number(totals.cost) || 0;
    const totalRevenue = Number(totals.client_total) || 0;
    const markup = totalRevenue - totalCost;
    const markupPercent = totalCost > 0 ? (markup / totalCost) * 100 : 0;

    const breadcrumbs: BreadcrumbItem[] = locationScope
        ? [
              { title: 'Locations', href: '/locations' },
              { title: locationScope.name, href: `/locations/${locationScope.id}` },
              { title: 'Variations', href: `/locations/${locationScope.id}/variations` },
              { title: variation.co_number, href: `/locations/${locationScope.id}/variations/${variation.id}/show` },
          ]
        : [
              { title: 'Variations', href: '/variations' },
              { title: variation.co_number, href: `/variations/${variation.id}/show` },
          ];

    const hasSellRates = variation.pricing_items.some((p) => p.sell_total != null && Number(p.sell_total) > 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Variation ${variation.co_number}`} />

            <div className="mx-auto w-full max-w-5xl space-y-6 p-4 text-xs sm:p-6">
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={locked}
                            onClick={() => router.visit(`/variations/${variation.id}/edit`)}
                        >
                            <Pencil className="mr-1.5 h-4 w-4" />
                            Edit
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5">
                                    Actions
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                    <a href={`/variations/${variation.id}/client-quote`} target="_blank" rel="noopener noreferrer">
                                        <Printer className="h-4 w-4" />
                                        Print
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href={`/variations/${variation.id}/download/excel`}>
                                        <Download className="h-4 w-4" />
                                        Download Excel
                                    </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    disabled={locked}
                                    onClick={() => {
                                        if (locked) return;
                                        if (confirm('Send this variation to Premier?')) {
                                            router.visit(`/variations/${variation.id}/send-to-premier`);
                                        }
                                    }}
                                >
                                    <Send className="h-4 w-4" />
                                    Send to Premier
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => {
                                        if (confirm('Duplicate this variation?')) {
                                            router.visit(`/variations/${variation.id}/duplicate`);
                                        }
                                    }}
                                >
                                    <Copy className="h-4 w-4" />
                                    Duplicate
                                </DropdownMenuItem>
                                {isLocal && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <a href={`/variations/${variation.id}/debug-premier-payload`}>
                                                <Bug className="h-4 w-4" />
                                                Download Premier JSON
                                            </a>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                </div>

                {/* ── Summary tiles ────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card className="py-0">
                        <CardContent className="flex flex-col px-3 py-2">
                            <p className="text-muted-foreground text-xs">Total cost</p>
                            <p className="text-sm font-semibold tabular-nums">{formatCurrency(totalCost)}</p>
                        </CardContent>
                    </Card>
                    <Card className="py-0">
                        <CardContent className="flex flex-col px-3 py-2">
                            <p className="text-muted-foreground text-xs">Total revenue</p>
                            <p className="text-sm font-semibold tabular-nums">{formatCurrency(totalRevenue)}</p>
                        </CardContent>
                    </Card>
                    <Card className="py-0">
                        <CardContent className="flex flex-col px-3 py-2">
                            <p className="text-muted-foreground text-xs">Markup</p>
                            <p className={cn('text-sm font-semibold tabular-nums', markup < 0 && 'text-destructive')}>
                                {formatCurrency(markup)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="py-0">
                        <CardContent className="flex flex-col px-3 py-2">
                            <p className="text-muted-foreground text-xs">Markup %</p>
                            <p className={cn('text-sm font-semibold tabular-nums', markupPercent < 0 && 'text-destructive')}>
                                {markupPercent.toFixed(1)}%
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Details ──────────────────────────────────────────── */}
                <section className="space-y-3">
                    <SectionHeading title="Variation Details" />
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <DetailField label="CO Number" value={variation.co_number} />
                        <DetailField label="Reference No." value={variation.reference_number} />
                        <DetailField label="Status" value={variation.status} />
                        <DetailField label="Type" value={variation.type} />
                        <DetailField label="Date" value={variation.co_date ? new Date(variation.co_date + 'T00:00:00').toLocaleDateString('en-GB') : null} />
                        <DetailField label="Location" value={variation.location?.name} />
                        <DetailField label="Created" value={formatTimestamp(variation.created_at, variation.created_by)} />
                        {(variation.updated_by || variation.updated_at !== variation.created_at) && (
                            <DetailField label="Updated" value={formatTimestamp(variation.updated_at, variation.updated_by)} />
                        )}
                        {variation.drawing && <DetailField label="Drawing" value={variation.drawing.name} />}
                        {variation.premier_co_id && <DetailField label="Premier CO ID" value={variation.premier_co_id} />}
                        {variation.markup_percentage != null && <DetailField label="Markup %" value={`${variation.markup_percentage}%`} />}
                        {variation.extra_days != null && variation.extra_days > 0 && (
                            <DetailField label="Extra Days" value={String(variation.extra_days)} />
                        )}
                    </div>
                    {variation.display_description && (
                        <>
                            <Separator />
                            <div>
                                <span className="text-muted-foreground text-xs">Description</span>
                                <p className="mt-1 text-xs whitespace-pre-wrap">{variation.display_description}</p>
                            </div>
                        </>
                    )}
                </section>

                {/* ── Pricing Items ────────────────────────────────────── */}
                <section className="space-y-3">
                    <SectionHeading title="Pricing Items" />
                    {variation.pricing_items.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-xs">No pricing items</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[700px] text-xs">
                                <thead>
                                    <tr className="bg-muted/50 border-b">
                                        <th className="text-muted-foreground px-3 py-2 text-left font-medium">Description</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Qty</th>
                                        <th className="text-muted-foreground px-3 py-2 text-center font-medium">Unit</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Labour</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Material</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Unit Rate</th>
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
                                            <td className="px-3 py-2 text-right tabular-nums">{formatMoney2(item.labour_cost)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{formatMoney2(item.material_cost)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">
                                                {Number(item.qty) > 0 ? formatMoney2(Number(item.total_cost) / Number(item.qty)) : '—'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney2(item.total_cost)}</td>
                                            {hasSellRates && (
                                                <>
                                                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney2(item.sell_rate)}</td>
                                                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney2(item.sell_total)}</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 border-t font-semibold">
                                        <td className="px-3 py-2" colSpan={3}>Totals</td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {formatMoney2(variation.pricing_items.reduce((s, i) => s + Number(i.labour_cost), 0))}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {formatMoney2(variation.pricing_items.reduce((s, i) => s + Number(i.material_cost), 0))}
                                        </td>
                                        <td className="px-3 py-2"></td>
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {formatMoney2(variation.pricing_items.reduce((s, i) => s + Number(i.total_cost), 0))}
                                        </td>
                                        {hasSellRates && (
                                            <>
                                                <td className="px-3 py-2"></td>
                                                <td className="px-3 py-2 text-right tabular-nums">
                                                    {formatMoney2(variation.pricing_items.reduce((s, i) => s + Number(i.sell_total || 0), 0))}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </section>

                {/* ── Direct Materials ──────────────────────────────────── */}
                {variation.direct_materials && variation.direct_materials.length > 0 && (
                    <section className="space-y-3">
                        <SectionHeading title="Direct Materials" />
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[800px] text-xs">
                                <thead>
                                    <tr className="bg-muted/50 border-b">
                                        <th className="text-muted-foreground w-12 px-3 py-2 text-center font-medium">#</th>
                                        <th className="text-muted-foreground px-3 py-2 text-left font-medium">Material</th>
                                        <th className="text-muted-foreground px-3 py-2 text-left font-medium">Supplier</th>
                                        <th className="text-muted-foreground px-3 py-2 text-left font-medium">Cost Code</th>
                                        <th className="text-muted-foreground px-3 py-2 text-left font-medium">Description</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Qty</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Unit Cost</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Total Cost</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right font-medium">Sell</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variation.direct_materials.map((m) => {
                                        const qty = Number(m.qty) || 0;
                                        const unitCost = Number(m.unit_cost) || 0;
                                        const totalCost = qty * unitCost;
                                        const materialLabel = m.material_item
                                            ? `${m.material_item.code} — ${m.material_item.description}`
                                            : (m.material_code || m.material_description || '—');
                                        const supplierLabel = m.supplier ? `${m.supplier.code} — ${m.supplier.name}` : '—';
                                        const costCodeLabel = m.cost_code ? `${m.cost_code.code} — ${m.cost_code.description}` : '—';
                                        return (
                                            <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                                                <td className="px-3 py-2 text-center">
                                                    <span className="bg-muted inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium">
                                                        {m.line_number}
                                                    </span>
                                                </td>
                                                <td className="max-w-[220px] truncate px-3 py-2 font-mono">{materialLabel}</td>
                                                <td className="max-w-32 truncate px-3 py-2">{supplierLabel}</td>
                                                <td className="max-w-32 truncate px-3 py-2">{costCodeLabel}</td>
                                                <td className="max-w-32 truncate px-3 py-2">{m.description || '—'}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{qty.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{formatMoney2(unitCost)}</td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney2(totalCost)}</td>
                                                <td className="px-3 py-2 text-right font-medium tabular-nums">{formatMoney2(m.sell_cost)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-muted/30 border-t font-semibold">
                                        <td className="px-3 py-2" colSpan={7}>Totals</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney2(totals.direct_material_cost)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney2(totals.direct_material_sell)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </section>
                )}

                {/* ── Premier Line Items ────────────────────────────────── */}
                <section className="space-y-3">
                    <SectionHeading title="Premier Line Items" />
                    {variation.premier_lines_stale && variation.line_items.length > 0 && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p className="text-xs leading-relaxed">
                                Pricing has changed since these lines were generated. Edit the variation and regenerate before sending to Premier.
                            </p>
                        </div>
                    )}
                    {variation.line_items.length > 0 && !variation.line_items.some((i) => i.cost_item === '99-99' && Number(i.revenue) > 0) && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p className="text-xs leading-relaxed">
                                Revenue line must be added in Premier directly. It will appear here after sync.
                            </p>
                        </div>
                    )}
                    {variation.line_items.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-xs">No Premier line items generated yet</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-[800px] text-xs">
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
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                                            <td className="px-3 py-2 text-center">
                                                <span className="bg-muted inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium">
                                                    {item.line_number}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 font-mono">{item.cost_item}</td>
                                            <td className="px-3 py-2">
                                                <Badge variant="secondary" className="text-[10px]">
                                                    {item.cost_type}
                                                </Badge>
                                            </td>
                                            <td className="max-w-[250px] truncate px-3 py-2">{item.description}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{item.cost_type === 'REV' ? '—' : Number(item.qty).toFixed(2)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{item.cost_type === 'REV' ? '—' : formatCurrency(item.unit_cost)}</td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums">{item.cost_type === 'REV' ? '—' : formatCurrency(item.total_cost)}</td>
                                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                                                {item.cost_item === '99-99' ? formatCurrency(item.revenue) : ''}
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
                                        <td className="px-3 py-2 text-right tabular-nums">
                                            {formatCurrency(variation.line_items.reduce((s, i) => s + Number(i.revenue || 0), 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </section>

                {/* ── Client Notes ──────────────────────────────────────── */}
                {(variation.client_notes || hasSellRates) && (
                    <section className="space-y-3">
                        <SectionHeading
                            title="Client"
                            action={
                                <Button variant="outline" size="sm" asChild>
                                    <a href={`/variations/${variation.id}/client-quote`} target="_blank" rel="noopener noreferrer">
                                        <Eye className="mr-1.5 h-4 w-4" />
                                        Print Quote
                                    </a>
                                </Button>
                            }
                        />
                        {variation.client_notes && (
                            <div>
                                <span className="text-muted-foreground text-xs">Client notes</span>
                                <p className="mt-1 text-xs whitespace-pre-wrap">{variation.client_notes}</p>
                            </div>
                        )}
                    </section>
                )}
            </div>
        </AppLayout>
    );
}
