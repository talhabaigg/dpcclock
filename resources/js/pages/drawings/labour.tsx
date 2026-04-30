import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { HardHat } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

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

const getCsrfToken = (): string =>
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';

const getXsrfToken = (): string => {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
};

// ---------- component ----------

export default function LabourPage() {
    const { drawing, revisions, project, activeTab, labourSummaries, masterHourlyRate } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: { id: number; name: string };
        activeTab: DrawingTab;
        labourSummaries: LabourSummary[];
        masterHourlyRate: number | null;
    }>().props;

    const [rate, setRate] = useState<number | null>(masterHourlyRate);
    const [rateInput, setRateInput] = useState(masterHourlyRate != null ? String(masterHourlyRate) : '');
    const [savingRate, setSavingRate] = useState(false);

    const grandTotal = labourSummaries.reduce((s, r) => s + r.total_cost, 0);
    const grandHours = labourSummaries.reduce((s, r) => s + (r.hours ?? 0), 0);

    const saveRate = async () => {
        const trimmed = rateInput.trim();
        const parsed = trimmed === '' ? null : parseFloat(trimmed);
        if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) return;
        if (parsed === rate) return;
        if (!project?.id) return;
        setSavingRate(true);
        try {
            const res = await fetch(`/locations/${project.id}/master-hourly-rate`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({ master_hourly_rate: parsed }),
            });
            if (!res.ok) throw new Error(`Server error (${res.status})`);
            const data = await res.json();
            setRate(data.master_hourly_rate ?? null);
            toast.success('Crew rate updated. Refresh totals to see new labour costs.');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to save crew rate.');
            setRateInput(rate != null ? String(rate) : '');
        } finally {
            setSavingRate(false);
        }
    };

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
                        {/* Toolbar — project crew rate. Lives here because labour cost is what it drives. */}
                        <div className="flex items-center gap-3">
                            <Label htmlFor="crew-rate" className="text-xs text-muted-foreground whitespace-nowrap">
                                Project crew rate
                            </Label>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">$</span>
                                <Input
                                    id="crew-rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={rateInput}
                                    onChange={(e) => setRateInput(e.target.value)}
                                    onBlur={saveRate}
                                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                    placeholder="0.00"
                                    className="h-7 w-28 pl-5 pr-10 tabular-nums text-xs"
                                    disabled={savingRate}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">/hr</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                Drives all labour line $/unit costs across the project.
                            </span>
                        </div>

                        {labourSummaries.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 text-center py-16">
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
                        )}
                    </div>
                </ScrollArea>
            </div>
        </DrawingWorkspaceLayout>
    );
}
