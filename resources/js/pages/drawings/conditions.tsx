import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, TableProperties } from 'lucide-react';
import { useMemo, useState } from 'react';

// ---------- types ----------

type LineItemSummary = {
    entry_type: 'material' | 'labour';
    qty_source: 'primary' | 'secondary' | 'fixed';
    fixed_qty: number | null;
    oc_spacing: number | null;
    layers: number;
    waste_percentage: number;
    unit_cost: number | null;
    pack_size: number | null;
    hourly_rate: number | null;
    production_rate: number | null;
};

type ConditionSummary = {
    condition_id: number;
    condition_number: number | null;
    condition_name: string;
    condition_type: string;
    type: 'linear' | 'area' | 'count';
    pricing_method: string;
    color: string;
    height: number | null;
    areas: string[];
    qty: number;
    unit: string;
    unit_price: number;
    material_cost: number;
    labour_cost: number;
    total_cost: number;
    line_items: LineItemSummary[] | null;
};

type Drawing = {
    id: number;
    project_id: number;
    display_name?: string;
    title?: string;
    sheet_number?: string;
    revision_number?: string;
    project?: { id: number; name: string };
};

type Revision = {
    id: number;
    revision_number?: string;
    revision?: string;
    status: string;
    drawing_number?: string;
    drawing_title?: string;
};

// ---------- helpers ----------

function fmtNum(val: number, decimals = 2): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

const TYPE_LABELS: Record<string, string> = { linear: 'Linear', area: 'Area', count: 'Count' };

/**
 * Compute the theoretical unit rate for a detailed condition from its line items.
 * For area/linear conditions with height: secondary qty per unit = 1 / height.
 */
function computeDetailedRate(
    lineItems: LineItemSummary[],
    condType: string,
    height: number | null,
): number {
    const cvUnit = 1;
    const pvUnit = (condType === 'area' || condType === 'linear') && height && height > 0
        ? 1 / height : 0;
    let total = 0;
    for (const li of lineItems) {
        const base = li.qty_source === 'secondary' ? pvUnit
            : li.qty_source === 'fixed' ? (li.fixed_qty ?? 0)
            : cvUnit;
        if (base <= 0) continue;
        const layers = Math.max(1, li.layers);
        const lineQty = li.oc_spacing && li.oc_spacing > 0
            ? (base / li.oc_spacing) * layers : base * layers;
        const effQty = lineQty * (1 + (li.waste_percentage ?? 0) / 100);
        if (li.entry_type === 'material') {
            const uc = li.unit_cost ?? 0;
            total += li.pack_size && li.pack_size > 0
                ? Math.ceil(effQty / li.pack_size) * uc : effQty * uc;
        }
        if (li.entry_type === 'labour') {
            const hr = li.hourly_rate ?? 0;
            const pr = li.production_rate ?? 0;
            if (hr > 0 && pr > 0) total += (effQty / pr) * hr;
        }
    }
    return total;
}

// ---------- component ----------

export default function ConditionsPage() {
    const { drawing, revisions, project, activeTab, conditionSummaries } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: { id: number; name: string };
        activeTab: DrawingTab;
        conditionSummaries: ConditionSummary[];
    }>().props;

    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Group conditions by condition_type, preserving order
    const { grouped, typeNames } = useMemo(() => {
        const map: Record<string, ConditionSummary[]> = {};
        const names: string[] = [];
        for (const c of conditionSummaries) {
            const t = c.condition_type;
            if (!map[t]) {
                map[t] = [];
                names.push(t);
            }
            map[t].push(c);
        }
        return { grouped: map, typeNames: names };
    }, [conditionSummaries]);

    // Grand totals
    const grandMaterial = conditionSummaries.reduce((s, c) => s + c.material_cost, 0);
    const grandLabour = conditionSummaries.reduce((s, c) => s + c.labour_cost, 0);
    const grandTotal = conditionSummaries.reduce((s, c) => s + c.total_cost, 0);

    const toggleGroup = (name: string) =>
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                {conditionSummaries.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <TableProperties className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">No conditions with measurements</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                Take off measurements on drawings to see the condition summary here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead className="w-[60px]">No.</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="w-[70px]">Type</TableHead>
                                    <TableHead className="w-[120px]">Area</TableHead>
                                    <TableHead className="w-[80px] text-right">Height</TableHead>
                                    <TableHead className="w-[110px] text-right">Qty</TableHead>
                                    <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                                    <TableHead className="w-[110px] text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {typeNames.map((typeName) => {
                                    const rows = grouped[typeName];
                                    const isOpen = !collapsedGroups.has(typeName);
                                    const groupTotal = rows.reduce((s, c) => s + c.total_cost, 0);

                                    return (
                                        <GroupRows
                                            key={typeName}
                                            typeName={typeName}
                                            rows={rows}
                                            isOpen={isOpen}
                                            groupTotal={groupTotal}
                                            onToggle={() => toggleGroup(typeName)}
                                        />
                                    );
                                })}
                            </TableBody>

                            <TableFooter>
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={5} className="text-right text-xs font-medium text-muted-foreground">
                                        Materials
                                    </TableCell>
                                    <TableCell colSpan={2} />
                                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                                        ${fmtNum(grandMaterial)}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={5} className="text-right text-xs font-medium text-muted-foreground">
                                        Labour
                                    </TableCell>
                                    <TableCell colSpan={2} />
                                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                                        ${fmtNum(grandLabour)}
                                    </TableCell>
                                </TableRow>
                                <TableRow className="bg-muted/50 border-t-2">
                                    <TableCell colSpan={5} className="text-right text-xs font-bold">
                                        Grand Total
                                    </TableCell>
                                    <TableCell colSpan={2} />
                                    <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                                        ${fmtNum(grandTotal)}
                                    </TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </ScrollArea>
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}

// ---------- group rows sub-component ----------

function GroupRows({
    typeName,
    rows,
    isOpen,
    groupTotal,
    onToggle,
}: {
    typeName: string;
    rows: ConditionSummary[];
    isOpen: boolean;
    groupTotal: number;
    onToggle: () => void;
}) {
    return (
        <>
            {/* Group header */}
            <TableRow
                className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                onClick={onToggle}
            >
                <TableCell colSpan={7} className="py-1.5">
                    <div className="flex items-center gap-1.5">
                        {isOpen
                            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            {typeName}
                        </span>
                        <span className="rounded-sm bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                            {rows.length}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono text-xs font-semibold tabular-nums">
                    ${fmtNum(groupTotal)}
                </TableCell>
            </TableRow>

            {/* Condition rows */}
            {isOpen && rows.map((c) => {
                // Compute unit price: for detailed conditions, derive from line items
                let unitPrice = c.unit_price;
                if (c.pricing_method === 'detailed' && c.line_items?.length) {
                    unitPrice = computeDetailedRate(c.line_items, c.type, c.height);
                }

                const areaLabel = c.areas.length === 0 ? '—'
                    : c.areas.length === 1 ? c.areas[0]
                    : 'Multiple';

                return (
                    <TableRow key={c.condition_id} style={{ borderLeftWidth: 3, borderLeftColor: c.color }}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                            {c.condition_number ?? ''}
                        </TableCell>
                        <TableCell className="text-sm">{c.condition_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                            {TYPE_LABELS[c.type] ?? c.type}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground" title={c.areas.join(', ')}>
                            {areaLabel}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                            {c.type === 'linear' && c.height ? `${c.height}m` : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                            {c.type === 'count'
                                ? Math.round(c.qty)
                                : fmtNum(c.qty)}
                            <span className="ml-1 text-[10px] text-muted-foreground">{c.unit}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm tabular-nums">
                            ${fmtNum(unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                            ${fmtNum(c.total_cost)}
                        </TableCell>
                    </TableRow>
                );
            })}

            {/* Group subtotal */}
            {isOpen && rows.length > 1 && (
                <TableRow className="bg-muted/20">
                    <TableCell colSpan={7} className="py-1 text-right text-xs font-semibold text-muted-foreground">
                        Subtotal
                    </TableCell>
                    <TableCell className="py-1 text-right font-mono text-xs font-bold tabular-nums">
                        ${fmtNum(groupTotal)}
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
