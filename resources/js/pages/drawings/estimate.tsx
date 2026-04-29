import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { Calculator, ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

// ---------- types ----------

type EstimateRow = {
    condition_id: number;
    condition_number: number | null;
    name: string;
    condition_type: string;
    color: string;
    qty1: number;
    uom1: string;
    qty2: number | null;
    uom2: string | null;
    material_cost: number;
    labour_cost: number;
    sub_cost: number;
    total_cost: number;
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

// ---------- helpers ----------

function fmtNum(val: number, decimals = 2): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtInt(val: number): string {
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ColorSwatch({ color }: { color: string }) {
    return (
        <span
            className="inline-block h-3 w-3 shrink-0 rounded-[2px] border border-black/20"
            style={{ backgroundColor: color }}
        />
    );
}

// ---------- component ----------

export default function EstimatePage() {
    const { drawing, revisions, project, activeTab, estimateRows } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: { id: number; name: string };
        activeTab: DrawingTab;
        estimateRows: EstimateRow[];
    }>().props;

    const [hideEmpty, setHideEmpty] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Filter rows based on hideEmpty checkbox
    const filteredRows = useMemo(
        () => (hideEmpty ? estimateRows.filter((r) => r.qty1 > 0) : estimateRows),
        [estimateRows, hideEmpty],
    );

    // Group by condition_type, preserving first-seen order
    const { grouped, typeNames } = useMemo(() => {
        const map: Record<string, EstimateRow[]> = {};
        const names: string[] = [];
        for (const r of filteredRows) {
            const t = r.condition_type;
            if (!map[t]) {
                map[t] = [];
                names.push(t);
            }
            map[t].push(r);
        }
        return { grouped: map, typeNames: names };
    }, [filteredRows]);

    // Grand totals
    const grandMat = filteredRows.reduce((s, r) => s + r.material_cost, 0);
    const grandLab = filteredRows.reduce((s, r) => s + r.labour_cost, 0);
    const grandSub = filteredRows.reduce((s, r) => s + r.sub_cost, 0);
    const grandTotal = filteredRows.reduce((s, r) => s + r.total_cost, 0);

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
                {filteredRows.length === 0 && estimateRows.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <Calculator className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">No conditions</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                Create conditions and take measurements to see the estimate here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
                            {/* Toolbar */}
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Checkbox
                                        checked={hideEmpty}
                                        onCheckedChange={(v) => setHideEmpty(v === true)}
                                        className="h-3.5 w-3.5"
                                    />
                                    Hide conditions with no quantities
                                </label>
                            </div>

                            <Card className="overflow-clip !p-0 !gap-0">
                                <Table className="text-xs [&>tbody>tr:last-child]:border-b-0">
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            <TableHead className="h-8 w-[70px] text-xs">No.</TableHead>
                                            <TableHead className="h-8 text-xs">Name</TableHead>
                                            <TableHead className="h-8 w-[90px] text-right text-xs">Qty1</TableHead>
                                            <TableHead className="h-8 w-[45px] text-xs">UOM</TableHead>
                                            <TableHead className="h-8 w-[90px] text-right text-xs">Qty2</TableHead>
                                            <TableHead className="h-8 w-[45px] text-xs">UOM</TableHead>
                                            <TableHead className="h-8 w-[100px] text-right text-xs">Mat. ($)</TableHead>
                                            <TableHead className="h-8 w-[100px] text-right text-xs">Labor ($)</TableHead>
                                            <TableHead className="h-8 w-[100px] text-right text-xs">Sub ($)</TableHead>
                                            <TableHead className="h-8 w-[110px] text-right text-xs">Total ($)</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {filteredRows.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">
                                                    No conditions with quantities.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            typeNames.map((typeName) => {
                                                const rows = grouped[typeName];
                                                const isOpen = !collapsedGroups.has(typeName);
                                                const gMat = rows.reduce((s, r) => s + r.material_cost, 0);
                                                const gLab = rows.reduce((s, r) => s + r.labour_cost, 0);
                                                const gSub = rows.reduce((s, r) => s + r.sub_cost, 0);
                                                const gTot = rows.reduce((s, r) => s + r.total_cost, 0);

                                                return (
                                                    <GroupSection
                                                        key={typeName}
                                                        typeName={typeName}
                                                        rows={rows}
                                                        isOpen={isOpen}
                                                        groupMat={gMat}
                                                        groupLab={gLab}
                                                        groupSub={gSub}
                                                        groupTotal={gTot}
                                                        onToggle={() => toggleGroup(typeName)}
                                                    />
                                                );
                                            })
                                        )}
                                    </TableBody>

                                    {filteredRows.length > 0 && (
                                        <TableFooter>
                                            <TableRow className="bg-muted/50 border-t-2">
                                                <TableCell colSpan={6} className="py-1.5 text-right text-xs font-semibold">
                                                    Grand Total
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                    {fmtNum(grandMat)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                    {fmtNum(grandLab)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                    {fmtNum(grandSub)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                    {fmtNum(grandTotal)}
                                                </TableCell>
                                            </TableRow>
                                        </TableFooter>
                                    )}
                                </Table>
                            </Card>
                        </div>
                    </ScrollArea>
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}

// ---------- group section sub-component ----------

function GroupSection({
    typeName,
    rows,
    isOpen,
    groupMat,
    groupLab,
    groupSub,
    groupTotal,
    onToggle,
}: {
    typeName: string;
    rows: EstimateRow[];
    isOpen: boolean;
    groupMat: number;
    groupLab: number;
    groupSub: number;
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
                <TableCell colSpan={6} className="py-1.5">
                    <div className="flex items-center gap-1.5">
                        {isOpen
                            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="text-xs font-semibold text-muted-foreground">
                            {typeName}
                        </span>
                        <span className="rounded-sm bg-muted px-1 py-px text-xs text-muted-foreground tabular-nums">
                            {rows.length}
                        </span>
                    </div>
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                    {fmtNum(groupMat)}
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                    {fmtNum(groupLab)}
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                    {fmtNum(groupSub)}
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                    {fmtNum(groupTotal)}
                </TableCell>
            </TableRow>

            {/* Condition rows */}
            {isOpen && rows.map((r) => (
                <TableRow key={r.condition_id}>
                    <TableCell className="py-1.5">
                        <div className="flex items-center gap-1.5">
                            <ColorSwatch color={r.color} />
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {r.condition_number ?? ''}
                            </span>
                        </div>
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">{r.name}</TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                        {r.qty1 > 0 ? fmtInt(r.qty1) : ''}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {r.qty1 > 0 ? r.uom1 : ''}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                        {r.qty2 != null && r.qty2 > 0 ? fmtInt(r.qty2) : ''}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {r.qty2 != null && r.qty2 > 0 ? r.uom2 : ''}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                        {fmtNum(r.material_cost)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                        {fmtNum(r.labour_cost)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                        {fmtNum(r.sub_cost)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                        {fmtNum(r.total_cost)}
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
}
