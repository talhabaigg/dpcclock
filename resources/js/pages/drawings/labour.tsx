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
    wage_type: string | null;
    qty_per_hr: number;
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
    drawing_number?: string;
    drawing_title?: string;
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
                            <p className="text-sm font-medium text-muted-foreground">No labour data</p>
                            <p className="mt-1 text-xs text-muted-foreground/70">
                                Add labour cost codes to conditions and take measurements to see the labour summary here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead className="w-[160px]">Cost Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="w-[110px] text-right">Quantity</TableHead>
                                    <TableHead className="w-[60px]">UOM</TableHead>
                                    <TableHead className="w-[100px] text-right">Cost</TableHead>
                                    <TableHead className="w-[110px]">Wage Type</TableHead>
                                    <TableHead className="w-[80px] text-right">Qty/Hr</TableHead>
                                    <TableHead className="w-[120px] text-right">Total Cost</TableHead>
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {labourSummaries.map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-mono text-xs">
                                            {row.code}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {row.name}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm tabular-nums">
                                            {fmtInt(row.qty)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {row.unit}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm tabular-nums">
                                            {fmtNum(row.cost)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {row.wage_type ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm tabular-nums">
                                            {fmtInt(row.qty_per_hr)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                                            {fmtNum(row.total_cost)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>

                            <TableFooter>
                                <TableRow className="bg-muted/50 border-t-2">
                                    <TableCell colSpan={7} className="text-right text-xs font-bold">
                                        Grand Total
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-sm font-bold tabular-nums">
                                        {fmtNum(grandTotal)}
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
