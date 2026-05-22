import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { api, ApiError } from '@/lib/api';
import { usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, TableProperties } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

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
    description: string | null;
    manual_qty: number | null;
    areas: string[];
    qty: number;
    unit: string;
    unit_price: number;
    sell_rate: number | null;
    material_cost: number;
    labour_cost: number;
    total_cost: number;
    sell_total: number | null;
    line_items: LineItemSummary[] | null;
};

type ConditionAreaRow = {
    condition_id: number;
    condition_number: number | null;
    condition_name: string;
    condition_type: string;
    type: 'linear' | 'area' | 'count';
    pricing_method: string;
    color: string;
    height: number | null;
    description: string | null;
    manual_qty: number | null;
    area_id: number | null;
    area_name: string;
    qty: number;
    unit: string;
    unit_price: number;
    sell_rate: number | null;
    material_cost: number;
    labour_cost: number;
    total_cost: number;
    sell_total: number | null;
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
};

type ViewMode = 'cost' | 'sell';
type GroupBy = 'none' | 'type' | 'area';

// Shape used inside the table; same fields exist on both ConditionSummary
// and ConditionAreaRow so the renderer can stay unified.
type Row = {
    key: string;
    condition_id: number;
    condition_number: number | null;
    condition_name: string;
    color: string;
    description: string | null;
    manual_qty: number | null;
    qty: number;
    unit: string;
    unit_price: number;
    sell_rate: number | null;
    total_cost: number;
    sell_total: number | null;
    pricing_method: string;
    type: 'linear' | 'area' | 'count';
    height: number | null;
    line_items: LineItemSummary[] | null;
};

// ---------- helpers ----------

function fmtNum(val: number, decimals = 2): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

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
    const { drawing, revisions, project, activeTab, conditionSummaries, conditionAreaRows, auth } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: { id: number; name: string };
        activeTab: DrawingTab;
        conditionSummaries: ConditionSummary[];
        conditionAreaRows: ConditionAreaRow[];
        auth?: { permissions?: string[] };
    }>().props;

    const canEdit = auth?.permissions?.includes('takeoff.edit') ?? false;
    const locationId = project?.id ?? drawing.project_id;

    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<ViewMode>('cost');
    const [groupBy, setGroupBy] = useState<GroupBy>('none');

    // Local override: condition_id -> manual_qty (or null to clear).
    // Lets us reflect inline edits immediately without re-fetching the page.
    const [manualQtyOverrides, setManualQtyOverrides] = useState<Record<number, number | null>>({});

    // Reset overrides whenever fresh server data arrives (Inertia prop update).
    useEffect(() => {
        setManualQtyOverrides({});
    }, [conditionSummaries, conditionAreaRows]);

    const isSell = viewMode === 'sell';

    // Apply any local manual_qty overrides to the row, recomputing qty
    // and totals from the row's unit_price / sell_rate so the change is
    // reflected immediately without a server round-trip on the qty itself.
    const applyOverride = (row: Row): Row => {
        if (!(row.condition_id in manualQtyOverrides)) return row;
        const override = manualQtyOverrides[row.condition_id];
        const nextQty = override ?? 0;
        return {
            ...row,
            manual_qty: override,
            qty: nextQty,
            total_cost: nextQty * row.unit_price,
            sell_total: row.sell_rate !== null ? nextQty * row.sell_rate : null,
        };
    };

    // Build groups based on current groupBy mode.
    // 'none' = single ungrouped list of conditions.
    // 'type' = per-condition rows grouped by condition_type.
    // 'area' = per-(condition,area) rows grouped by area_name.
    const { grouped, groupNames } = useMemo(() => {
        const map: Record<string, Row[]> = {};
        const names: string[] = [];

        if (groupBy === 'area') {
            for (const r of conditionAreaRows) {
                const g = r.area_name;
                if (!map[g]) {
                    map[g] = [];
                    names.push(g);
                }
                map[g].push(applyOverride({
                    key: `r-${r.condition_id}-${r.area_id ?? 'null'}`,
                    condition_id: r.condition_id,
                    condition_number: r.condition_number,
                    condition_name: r.condition_name,
                    color: r.color,
                    description: r.description,
                    manual_qty: r.manual_qty,
                    qty: r.qty,
                    unit: r.unit,
                    unit_price: r.unit_price,
                    sell_rate: r.sell_rate,
                    total_cost: r.total_cost,
                    sell_total: r.sell_total,
                    pricing_method: r.pricing_method,
                    type: r.type,
                    height: r.height,
                    line_items: r.line_items,
                }));
            }
            names.sort((a, b) => a.localeCompare(b));
        } else {
            // 'none' and 'type' both render per-condition rows; 'none' uses a
            // single sentinel bucket so the renderer stays unified.
            for (const c of conditionSummaries) {
                const g = groupBy === 'type' ? c.condition_type : '__all__';
                if (!map[g]) {
                    map[g] = [];
                    names.push(g);
                }
                map[g].push(applyOverride({
                    key: `c-${c.condition_id}`,
                    condition_id: c.condition_id,
                    condition_number: c.condition_number,
                    condition_name: c.condition_name,
                    color: c.color,
                    description: c.description,
                    manual_qty: c.manual_qty,
                    qty: c.qty,
                    unit: c.unit,
                    unit_price: c.unit_price,
                    sell_rate: c.sell_rate,
                    total_cost: c.total_cost,
                    sell_total: c.sell_total,
                    pricing_method: c.pricing_method,
                    type: c.type,
                    height: c.height,
                    line_items: c.line_items,
                }));
            }
        }

        return { grouped: map, groupNames: names };
        // applyOverride closes over manualQtyOverrides; rebuild when it changes.
         
    }, [conditionSummaries, conditionAreaRows, groupBy, manualQtyOverrides]);

    const handleManualQtyChange = async (conditionId: number, value: number | null) => {
        // Optimistic update first
        setManualQtyOverrides((prev) => ({ ...prev, [conditionId]: value }));
        try {
            await api.patch(`/locations/${locationId}/takeoff-conditions/${conditionId}/manual-qty`, {
                manual_qty: value,
            });
        } catch (err) {
            const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
            toast.error(`Failed to save qty. ${msg}`);
            // Revert
            setManualQtyOverrides((prev) => {
                const next = { ...prev };
                delete next[conditionId];
                return next;
            });
        }
    };

    // Grand totals — derived from the rows currently being displayed.
    const grandCost = useMemo(
        () => Object.values(grouped).flat().reduce((s, r) => s + r.total_cost, 0),
        [grouped],
    );
    const grandSell = useMemo(
        () => Object.values(grouped).flat().reduce((s, r) => s + (r.sell_total ?? 0), 0),
        [grouped],
    );
    const grandTotal = isSell ? grandSell : grandCost;
    const hasUnpricedSell = useMemo(
        () => isSell && Object.values(grouped).flat().some((r) => r.sell_rate === null),
        [grouped, isSell],
    );

    const isEmpty = (groupBy === 'area' ? conditionAreaRows.length : conditionSummaries.length) === 0;

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
                {isEmpty ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <TableProperties className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">No conditions defined</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                Add conditions for this project, then enter quantities here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">View</span>
                                    <ToggleGroup
                                        variant="outline"
                                        size="sm"
                                        value={[viewMode]}
                                        onValueChange={(next) => {
                                            const v = next[0];
                                            if (v) setViewMode(v as ViewMode);
                                        }}
                                        aria-label="View mode"
                                    >
                                        <ToggleGroupItem value="cost" className="text-xs px-3">Cost BOQ</ToggleGroupItem>
                                        <ToggleGroupItem value="sell" className="text-xs px-3">Sell BOQ</ToggleGroupItem>
                                    </ToggleGroup>
                                    {hasUnpricedSell ? (
                                        <span className="text-xs text-muted-foreground">
                                            Detailed conditions are excluded — variation pricing not yet supported.
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Group by</span>
                                    <ToggleGroup
                                        variant="outline"
                                        size="sm"
                                        value={[groupBy]}
                                        onValueChange={(next) => {
                                            const v = next[0];
                                            if (v) setGroupBy(v as GroupBy);
                                        }}
                                        aria-label="Group by"
                                    >
                                        <ToggleGroupItem value="none" className="text-xs px-3">None</ToggleGroupItem>
                                        <ToggleGroupItem value="type" className="text-xs px-3">Condition Type</ToggleGroupItem>
                                        <ToggleGroupItem value="area" className="text-xs px-3">Area</ToggleGroupItem>
                                    </ToggleGroup>
                                </div>
                            </div>

                            <Card className="overflow-clip !p-0 !gap-0">
                                <Table className="text-xs [&>tbody>tr:last-child]:border-b-0">
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            <TableHead className="h-8 w-[60px] text-xs">No.</TableHead>
                                            <TableHead className="h-8 w-[260px] text-xs">Notes</TableHead>
                                            <TableHead className="h-8 w-[180px] text-xs">Name</TableHead>
                                            <TableHead className="h-8 w-[110px] text-right text-xs">Qty</TableHead>
                                            <TableHead className="h-8 w-[80px] text-xs">UoM</TableHead>
                                            <TableHead className="h-8 w-[110px] text-right text-xs">
                                                {isSell ? 'Sell Rate' : 'Rate'}
                                            </TableHead>
                                            <TableHead className="h-8 w-[120px] text-right text-xs">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {groupBy === 'none'
                                            ? (grouped['__all__'] ?? []).map((r) => (
                                                <ConditionRow
                                                    key={r.key}
                                                    r={r}
                                                    isSell={isSell}
                                                    canEdit={canEdit}
                                                    onManualQtyChange={handleManualQtyChange}
                                                />
                                            ))
                                            : groupNames.map((groupName) => {
                                                const rows = grouped[groupName];
                                                const isOpen = !collapsedGroups.has(groupName);
                                                const groupTotal = rows.reduce(
                                                    (s, r) => s + (isSell ? (r.sell_total ?? 0) : r.total_cost),
                                                    0,
                                                );

                                                return (
                                                    <GroupRows
                                                        key={groupName}
                                                        groupName={groupName}
                                                        rows={rows}
                                                        isOpen={isOpen}
                                                        groupTotal={groupTotal}
                                                        isSell={isSell}
                                                        canEdit={canEdit}
                                                        onManualQtyChange={handleManualQtyChange}
                                                        onToggle={() => toggleGroup(groupName)}
                                                    />
                                                );
                                            })}
                                    </TableBody>

                                    <TableFooter>
                                        <TableRow className="bg-muted/50 border-t-2">
                                            <TableCell colSpan={6} className="py-1.5 text-right text-xs font-semibold">
                                                Grand Total ({isSell ? 'Sell BOQ' : 'Cost BOQ'})
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                ${fmtNum(grandTotal)}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </Card>
                        </div>
                    </ScrollArea>
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}

// ---------- row sub-components ----------

function ConditionRow({
    r,
    isSell,
    canEdit,
    onManualQtyChange,
}: {
    r: Row;
    isSell: boolean;
    canEdit: boolean;
    onManualQtyChange: (conditionId: number, value: number | null) => void;
}) {
    // For detailed-priced conditions in Cost BOQ mode, derive rate from
    // line items (matches old behaviour). Sell rate is computed server-side.
    let costRate = r.unit_price;
    if (!isSell && r.pricing_method === 'detailed' && r.line_items?.length) {
        costRate = computeDetailedRate(r.line_items, r.type, r.height);
    }
    const rateNum: number | null = isSell ? r.sell_rate : costRate;
    const totalNum: number | null = isSell ? r.sell_total : r.total_cost;

    return (
        <TableRow style={{ borderLeftWidth: 3, borderLeftColor: r.color }}>
            <TableCell className="py-1.5 align-top text-xs text-muted-foreground tabular-nums">
                {r.condition_number ?? ''}
            </TableCell>
            <TableCell className="py-1.5 align-top text-xs whitespace-normal break-words text-muted-foreground">
                {r.description ?? ''}
            </TableCell>
            <TableCell className="py-1.5 align-top text-xs font-medium">
                {r.condition_name}
            </TableCell>
            <TableCell className="py-1.5 align-top text-right text-xs tabular-nums">
                {canEdit
                    ? <QtyInput row={r} onChange={onManualQtyChange} />
                    : (r.type === 'count' ? Math.round(r.qty) : fmtNum(r.qty))}
            </TableCell>
            <TableCell className="py-1.5 align-top text-xs text-muted-foreground">{r.unit}</TableCell>
            <TableCell className="py-1.5 align-top text-right text-xs tabular-nums">
                {rateNum === null ? '—' : `$${fmtNum(rateNum)}`}
            </TableCell>
            <TableCell className="py-1.5 align-top text-right text-xs font-semibold tabular-nums">
                {totalNum === null ? '—' : `$${fmtNum(totalNum)}`}
            </TableCell>
        </TableRow>
    );
}

/**
 * Inline qty editor. Shows the current effective qty (manual_qty when set,
 * else measurement-derived). Commits on blur or Enter. Empty input clears
 * the manual_qty (falls back to measurements).
 */
function QtyInput({
    row,
    onChange,
}: {
    row: Row;
    onChange: (conditionId: number, value: number | null) => void;
}) {
    const initial = row.manual_qty !== null
        ? String(row.manual_qty)
        : row.qty === 0
            ? ''
            : (row.type === 'count' ? String(Math.round(row.qty)) : String(row.qty));
    const [text, setText] = useState<string>(initial);

    // Re-sync when the row's underlying values change (e.g. server refresh
    // or override applied elsewhere).
    useEffect(() => {
        setText(initial);
         
    }, [row.manual_qty, row.qty]);

    const commit = () => {
        const trimmed = text.trim();
        if (trimmed === '') {
            // Clear override -> back to measurement-derived qty
            if (row.manual_qty !== null) onChange(row.condition_id, null);
            return;
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || parsed < 0) {
            setText(initial);
            return;
        }
        if (parsed === row.manual_qty) return;
        onChange(row.condition_id, parsed);
    };

    return (
        <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                    setText(initial);
                    e.currentTarget.blur();
                }
            }}
            inputMode="decimal"
            placeholder="0"
            className="h-7 w-[90px] ml-auto px-2 py-1 text-right text-xs tabular-nums"
        />
    );
}

function GroupRows({
    groupName,
    rows,
    isOpen,
    groupTotal,
    isSell,
    canEdit,
    onManualQtyChange,
    onToggle,
}: {
    groupName: string;
    rows: Row[];
    isOpen: boolean;
    groupTotal: number;
    isSell: boolean;
    canEdit: boolean;
    onManualQtyChange: (conditionId: number, value: number | null) => void;
    onToggle: () => void;
}) {
    return (
        <>
            {/* Group header */}
            <TableRow
                className="cursor-pointer bg-muted/40 hover:bg-muted/60"
                onClick={onToggle}
            >
                <TableCell colSpan={6} className="py-1.5">
                    <div className="flex items-center gap-1.5">
                        {isOpen
                            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-xs font-semibold text-muted-foreground">
                            {groupName}
                        </span>
                        <span className="rounded-sm bg-muted px-1 py-px text-xs text-muted-foreground tabular-nums">
                            {rows.length}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                    ${fmtNum(groupTotal)}
                </TableCell>
            </TableRow>

            {/* Condition rows */}
            {isOpen && rows.map((r) => (
                <ConditionRow
                    key={r.key}
                    r={r}
                    isSell={isSell}
                    canEdit={canEdit}
                    onManualQtyChange={onManualQtyChange}
                />
            ))}

            {/* Group subtotal */}
            {isOpen && rows.length > 1 && (
                <TableRow className="bg-muted/20">
                    <TableCell colSpan={6} className="py-1 text-right text-xs font-semibold text-muted-foreground">
                        Subtotal
                    </TableCell>
                    <TableCell className="py-1 text-right text-xs font-semibold tabular-nums">
                        ${fmtNum(groupTotal)}
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}
