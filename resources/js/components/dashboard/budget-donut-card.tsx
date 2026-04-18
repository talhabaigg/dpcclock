import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { useHttp } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Cell, Label, Pie, PieChart } from 'recharts';
import { toast } from 'sonner';

export interface ProductionCostCode {
    cost_code: string;
    code_description: string;
    est_hours: number;
    used_hours: number;
    remaining_hours: number;
    actual_variance: number;
}

interface BudgetDonutCardProps {
    title: string;
    locationId: number;
    costCodes: ProductionCostCode[];
    savedCostCode?: string | null;
    settingKey: string; // e.g. 'safety_cost_code' or 'weather_cost_code'
    isEditing?: boolean;
}

// Neutral by default, warn only when it matters
function getSemanticColor(percent: number) {
    if (percent > 100) return { used: 'hsl(0, 72%, 51%)', text: 'text-red-600 dark:text-red-400' };       // over budget
    if (percent >= 90) return { used: 'hsl(38, 92%, 50%)', text: 'text-amber-600 dark:text-amber-400' };  // approaching limit
    return { used: 'hsl(217, 91%, 60%)', text: 'text-muted-foreground' };                                 // normal
}

const TRACK_COLOR = 'hsl(var(--muted))';

function getChartConfig(usedColor: string): ChartConfig {
    return {
        used: { label: 'Used Hrs', color: usedColor },
        remaining: { label: 'Remaining', color: TRACK_COLOR },
    };
}

function fmt(val: number): string {
    return val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export default function BudgetDonutCard({ title, locationId, costCodes, savedCostCode, settingKey, isEditing }: BudgetDonutCardProps) {
    const [selectedCode, setSelectedCode] = useState<string>(savedCostCode ?? '');
    const [pickerOpen, setPickerOpen] = useState(false);

    const http = useHttp({});

    const selected = useMemo(() => costCodes.find((c) => c.cost_code === selectedCode), [costCodes, selectedCode]);

    const pieData = useMemo(() => {
        if (!selected) return [];
        return [
            { name: 'Used Hrs', value: selected.used_hours, key: 'used' },
            { name: 'Remaining', value: selected.remaining_hours, key: 'remaining' },
        ];
    }, [selected]);

    const handleSelect = async (code: string) => {
        setSelectedCode(code);
        setPickerOpen(false);
        http.setData({ [settingKey]: code });
        http.put(`/locations/${locationId}/dashboard-settings`, {
            onError: () => {
                toast.error('Failed to save setting.');
            },
        });
    };

    const hasData = selected && selected.est_hours > 0;
    const usedPercent = hasData ? Math.round((selected.used_hours / selected.est_hours) * 100) : 0;
    const semantic = getSemanticColor(usedPercent);
    const chartConfig = getChartConfig(semantic.used);

    // Narrative context line
    const contextLine = hasData
        ? selected.remaining_hours >= 0
            ? `${fmt(selected.remaining_hours)} hrs left`
            : `${fmt(Math.abs(selected.remaining_hours))} hrs over`
        : '';

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">{title}</CardTitle>
                    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'rounded p-0.5 transition-colors hover:bg-muted',
                                    http.processing && 'animate-pulse',
                                )}
                                title="Select cost code"
                            >
                                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[260px] p-0" align="end">
                            <Command>
                                <CommandInput placeholder="Search cost code..." />
                                <CommandList>
                                    <CommandEmpty>No cost codes found</CommandEmpty>
                                    <CommandGroup>
                                        {costCodes.map((cc) => (
                                            <CommandItem
                                                key={cc.cost_code}
                                                value={`${cc.cost_code} ${cc.code_description}`}
                                                onSelect={() => handleSelect(cc.cost_code)}
                                            >
                                                <Check
                                                    className={cn(
                                                        'mr-2 h-3.5 w-3.5',
                                                        selectedCode === cc.cost_code ? 'opacity-100' : 'opacity-0',
                                                    )}
                                                />
                                                <span className="font-mono text-xs">{cc.cost_code}</span>
                                                <span className="ml-1.5 text-xs text-muted-foreground truncate">{cc.code_description}</span>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center">
                {costCodes.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground">No DPC data</span>
                ) : !selectedCode ? (
                    <span className="text-[11px] text-muted-foreground px-2 text-center">
                        Click <Settings2 className="inline h-3 w-3" /> to select a cost code
                    </span>
                ) : !hasData ? (
                    <span className="text-[11px] text-muted-foreground">No hours for this code</span>
                ) : (
                    <div className="w-full flex-1 min-h-0 flex flex-col">
                        <ChartContainer config={chartConfig} className="flex-1 min-h-0 w-full aspect-auto">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="50%"
                                        outerRadius="85%"
                                        paddingAngle={0}
                                        strokeWidth={0}
                                        startAngle={90}
                                        endAngle={-270}
                                    >
                                        <Cell key="used" fill={semantic.used} />
                                        <Cell key="remaining" fill={TRACK_COLOR} />
                                        <Label
                                            content={({ viewBox }) => {
                                                if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                                    return (
                                                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="central">
                                                            <tspan className="fill-foreground text-lg font-bold">{usedPercent}%</tspan>
                                                        </text>
                                                    );
                                                }
                                            }}
                                        />
                                    </Pie>
                                    <ChartTooltip
                                        content={({ active, payload }) => {
                                            if (!active || !payload?.length) return null;
                                            const d = payload[0];
                                            return (
                                                <div className="rounded-md border bg-background p-1.5 shadow-sm text-xs">
                                                    <span className="font-medium">{d.name}: </span>
                                                    <span className="tabular-nums">{fmt(d.value as number)}</span>
                                                </div>
                                            );
                                        }}
                                    />
                                </PieChart>
                        </ChartContainer>
                        <p className={cn('text-[10px] tabular-nums text-center pb-1.5 leading-none', semantic.text)}>
                            {fmt(selected.used_hours)} hrs used · {contextLine}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
