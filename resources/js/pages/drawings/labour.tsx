import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { HardHat } from 'lucide-react';

// ---------- types ----------

type LabourSummary = {
    code: string;
    name: string;
    qty: number;
    unit: string;
    cost: number;
    qty_per_hr: number;
    hours: number;
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

// ---------- component ----------

export default function LabourPage() {
    const { drawing, revisions, project, activeTab, labourSummaries } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: { id: number; name: string };
        activeTab: DrawingTab;
        labourSummaries: LabourSummary[];
    }>().props;

    const grandTotal = labourSummaries.reduce((s, r) => s + r.total_cost, 0);
    const grandHours = labourSummaries.reduce((s, r) => s + (r.hours ?? 0), 0);

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                {labourSummaries.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                            <HardHat className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">No labour data</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                Add labour cost codes to conditions and take measurements to see the labour summary here.
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
                                            <TableHead className="h-8 w-[160px] text-xs">Cost Code</TableHead>
                                            <TableHead className="h-8 text-xs">Description</TableHead>
                                            <TableHead className="h-8 w-[110px] text-right text-xs">Quantity</TableHead>
                                            <TableHead className="h-8 w-[60px] text-xs">UOM</TableHead>
                                            <TableHead className="h-8 w-[100px] text-right text-xs">Cost</TableHead>
                                            <TableHead className="h-8 w-[80px] text-right text-xs">Qty/Hr</TableHead>
                                            <TableHead className="h-8 w-[90px] text-right text-xs">Hours</TableHead>
                                            <TableHead className="h-8 w-[120px] text-right text-xs">Total Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {labourSummaries.map((row, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="py-1.5 text-xs tabular-nums">
                                                    {row.code}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs">
                                                    {row.name}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtInt(row.qty)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-xs text-muted-foreground">
                                                    {row.unit}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtNum(row.cost)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtInt(row.qty_per_hr)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs tabular-nums">
                                                    {fmtNum(row.hours ?? 0)}
                                                </TableCell>
                                                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                    {fmtNum(row.total_cost)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>

                                    <TableFooter>
                                        <TableRow className="bg-muted/50 border-t-2">
                                            <TableCell colSpan={6} className="py-1.5 text-right text-xs font-semibold">
                                                Grand Total
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                {fmtNum(grandHours)}
                                            </TableCell>
                                            <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                                                {fmtNum(grandTotal)}
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
