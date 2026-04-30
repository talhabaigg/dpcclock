import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { Package } from 'lucide-react';

// ---------- types ----------

type MaterialSummary = {
    item_code: string;
    cost_code: string;
    description: string;
    qty: number;
    uom: string;
    mat_cost: number;
    per: string;
    total: number;
    waste_pct: number;
    units: number;
    price_updated: string | null;
    supplier: string | null;
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

// ---------- component ----------

export default function MaterialPage() {
    const { drawing, revisions, project, activeTab, materialSummaries } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: { id: number; name: string };
        activeTab: DrawingTab;
        materialSummaries: MaterialSummary[];
    }>().props;

    const grandTotal = materialSummaries.reduce((s, r) => s + r.total, 0);

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                {materialSummaries.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <Package className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">No material data</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                Add materials to conditions and take measurements to see the material summary here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
                            <Card className="overflow-clip !p-0 !gap-0">
                                <Table className="text-xs [&>tbody>tr:last-child]:border-b-0">
                                    <TableHeader className="sticky top-0 z-10 bg-background">
                                        <TableRow>
                                            <TableHead className="h-8 w-[110px] text-xs">Item Code</TableHead>
                                            <TableHead className="h-8 w-[90px] text-xs">Cost Code</TableHead>
                                            <TableHead className="h-8 text-xs">Description</TableHead>
                                            <TableHead className="h-8 w-[80px] text-right text-xs">Qty</TableHead>
                                            <TableHead className="h-8 w-[45px] text-xs">UOM</TableHead>
                                            <TableHead className="h-8 w-[80px] text-right text-xs">Mat. Cost</TableHead>
                                            <TableHead className="h-8 w-[70px] text-xs">Per</TableHead>
                                            <TableHead className="h-8 w-[100px] text-right text-xs">Total ($)</TableHead>
                                            <TableHead className="h-8 w-[60px] text-right text-xs">Waste%</TableHead>
                                            <TableHead className="h-8 w-[70px] text-right text-xs">Units</TableHead>
                                            <TableHead className="h-8 w-[90px] text-xs">Updated</TableHead>
                                            <TableHead className="h-8 w-[110px] text-xs">Supplier</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {materialSummaries.map((row, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="py-1.5 font-mono text-xs">
                                                    {row.item_code}
                                                </TableCell>
                                                <TableCell className="py-1.5 font-mono text-xs text-muted-foreground">
                                                    {row.cost_code}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs">
                                                    {row.description}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtInt(row.qty)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">
                                                    {row.uom}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtNum(row.mat_cost)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">
                                                    {row.per}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                    {fmtNum(row.total)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                                                    {row.waste_pct > 0 ? `${fmtNum(row.waste_pct, 0)}%` : '—'}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtNum(row.units, 0)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">
                                                    {row.price_updated ?? '—'}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">
                                                    {row.supplier ?? '—'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>

                                    <TableFooter>
                                        <TableRow className="bg-muted/50 border-t-2">
                                            <TableCell colSpan={7} className="py-1.5 text-right text-xs font-semibold">
                                                Grand Total
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                {fmtNum(grandTotal)}
                                            </TableCell>
                                            <TableCell colSpan={4} />
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
