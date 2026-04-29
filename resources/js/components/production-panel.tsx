import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { addDays, format, parseISO } from 'date-fns';
import { CalendarIcon, CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';

export type LccSummary = {
    labour_cost_code_id: number;
    code: string;
    name: string;
    unit: string;
    total_qty: number;
    budget_hours: number;
    earned_hours: number;
    weighted_percent: number;
    measurement_count: number;
};

type ProductionPanelProps = {
    lccSummary: LccSummary[];
    selectedLccId: number | null;
    onSelectLcc: (lccId: number | null) => void;
    onSelectAll?: () => void;
    hideComplete?: boolean;
    onToggleHideComplete?: () => void;
    workDate: string;
    onWorkDateChange: (date: string) => void;
    loadingDate?: boolean;
    /** Inline status hint shown under controls (e.g., "Click areas to set %") */
    statusHint?: string;
};

function getPercentColor(percent: number): string {
    if (percent >= 100) return '#16a34a'; // green-600 — complete
    if (percent >= 90) return '#22c55e';  // green-500 — nearly done
    if (percent >= 50) return '#f59e0b';  // amber-500 — in progress
    return '#3b82f6';                     // blue-500 — early stage
}

/** Source LCC names tend to be ALL CAPS in the DB; render as sentence case. */
function toSentenceCase(s: string): string {
    if (!s) return s;
    const lower = s.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function ProductionPanel({
    lccSummary,
    selectedLccId,
    onSelectLcc,
    onSelectAll,
    hideComplete,
    onToggleHideComplete,
    workDate,
    onWorkDateChange,
    loadingDate,
    statusHint,
}: ProductionPanelProps) {
    const totalBudgetHours = lccSummary.reduce((s, c) => s + c.budget_hours, 0);
    const totalEarnedHours = lccSummary.reduce((s, c) => s + c.earned_hours, 0);
    const totalQty = lccSummary.reduce((s, c) => s + c.total_qty, 0);
    const overallPercent = totalQty > 0
        ? lccSummary.reduce((s, c) => s + c.total_qty * c.weighted_percent, 0) / totalQty
        : 0;

    return (
        <div className="flex h-full w-[320px] flex-col border-l bg-background">
            {/* Work date picker — prev | popover | next */}
            <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 rounded-sm p-0"
                    onClick={() => {
                        if (workDate) onWorkDateChange(format(addDays(parseISO(workDate), -1), 'yyyy-MM-dd'));
                    }}
                    title="Previous day"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 flex-1 justify-center gap-1.5 rounded-sm px-2 text-xs font-normal"
                        >
                            <CalendarIcon className="h-3 w-3" />
                            {workDate ? format(parseISO(workDate), 'd MMM yyyy') : 'Pick a date'}
                            {loadingDate && (
                                <span className="ml-1 h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            mode="single"
                            selected={workDate ? parseISO(workDate) : undefined}
                            onSelect={(d) => {
                                if (d) onWorkDateChange(format(d, 'yyyy-MM-dd'));
                            }}
                        />
                    </PopoverContent>
                </Popover>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 shrink-0 rounded-sm p-0"
                    onClick={() => {
                        if (workDate) onWorkDateChange(format(addDays(parseISO(workDate), 1), 'yyyy-MM-dd'));
                    }}
                    title="Next day"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Production controls — visible only when an LCC is selected (scoped to that LCC) */}
            {selectedLccId && (
                <div className="flex shrink-0 items-center gap-1 px-2 pb-1.5">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 gap-1 px-1.5 text-xs"
                        onClick={onSelectAll}
                        title="Select all measurements in this LCC"
                    >
                        <CheckSquare className="h-3 w-3" />
                        Select all
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={hideComplete ? 'secondary' : 'ghost'}
                        className="h-5 gap-1 px-1.5 text-xs"
                        onClick={onToggleHideComplete}
                        title={hideComplete ? 'Show completed items' : 'Hide completed items'}
                    >
                        {hideComplete ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {hideComplete ? 'Show done' : 'Hide done'}
                    </Button>
                    {statusHint && (
                        <span className="ml-auto truncate text-xs text-muted-foreground" title={statusHint}>
                            {statusHint}
                        </span>
                    )}
                </div>
            )}

            {/* LCC List */}
            <ScrollArea className="flex-1">
                <div className="space-y-px p-1">
                    {lccSummary.length === 0 && (
                        <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                            No labour cost codes found.
                            <br />
                            <span className="text-xs text-muted-foreground/70">
                                Add LCCs to conditions in the condition manager.
                            </span>
                        </div>
                    )}
                    {lccSummary.map((lcc) => {
                        const isSelected = selectedLccId === lcc.labour_cost_code_id;
                        const color = getPercentColor(lcc.weighted_percent);

                        return (
                            <button
                                key={lcc.labour_cost_code_id}
                                type="button"
                                onClick={() => onSelectLcc(isSelected ? null : lcc.labour_cost_code_id)}
                                className={cn(
                                    'group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors duration-150',
                                    isSelected
                                        ? 'bg-primary/8'
                                        : 'hover:bg-muted/40',
                                )}
                            >
                                {/* Code + description (two lines) */}
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium tabular-nums">{lcc.code}</div>
                                    <div className="truncate text-xs text-muted-foreground">{toSentenceCase(lcc.name)}</div>
                                </div>

                                {/* Percent label — colored, right-aligned */}
                                <div
                                    className="shrink-0 text-xs font-medium tabular-nums"
                                    style={{ color }}
                                >
                                    {Math.round(lcc.weighted_percent)}%
                                </div>
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>

            {/* Budget Summary */}
            <div className="shrink-0 space-y-1.5 border-t px-2 py-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Overall</span>
                    <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: getPercentColor(overallPercent) }}
                    >
                        {Math.round(overallPercent)}%
                    </span>
                </div>

                {/* Overall progress bar */}
                <div className="h-0.5 w-full rounded-full bg-muted">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${Math.min(overallPercent, 100)}%`,
                            backgroundColor: getPercentColor(overallPercent),
                        }}
                    />
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                        Budget <span className="font-medium tabular-nums text-foreground">{totalBudgetHours.toFixed(1)}h</span>
                    </span>
                    <span>
                        Earned <span className="font-medium tabular-nums text-foreground">{totalEarnedHours.toFixed(1)}h</span>
                    </span>
                    <span>
                        Items <span className="font-medium tabular-nums text-foreground">{lccSummary.reduce((s, c) => s + c.measurement_count, 0)}</span>
                    </span>
                </div>
            </div>
        </div>
    );
}

export { getPercentColor, toSentenceCase };
