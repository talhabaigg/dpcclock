import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Bar, BarChart, LabelList, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Filter, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LabourBudgetRow {
    cost_item: string;
    label: string;
    budget: number;
    spent: number;
    percent: number;
}

interface LabourBudgetCardProps {
    data: LabourBudgetRow[];
    isEditing?: boolean;
}

const DEFAULT_COST_ITEMS = ['01-01', '03-01', '05-01', '07-01'];

const chartConfig = {
    budget: { label: 'Budget', color: 'hsl(217, 91%, 60%)' },
    spent: { label: 'Spent', color: 'hsl(224, 76%, 30%)' },
} satisfies ChartConfig;

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

export default function LabourBudgetCard({ data, isEditing }: LabourBudgetCardProps) {
    const [selectedItems, setSelectedItems] = useState<Set<string>>(
        new Set(DEFAULT_COST_ITEMS.filter((item) => data.some((d) => d.cost_item === item)))
    );
    const [search, setSearch] = useState('');

    const sortedData = useMemo(
        () => [...data].sort((a, b) => a.cost_item.localeCompare(b.cost_item)),
        [data],
    );

    const searchFilteredList = useMemo(() => {
        if (!search.trim()) return sortedData;
        const term = search.toLowerCase();
        return sortedData.filter(
            (row) => row.cost_item.toLowerCase().includes(term) || row.label.toLowerCase().includes(term),
        );
    }, [sortedData, search]);

    const toggleItem = (costItem: string) => {
        setSelectedItems((prev) => {
            const next = new Set(prev);
            if (next.has(costItem)) {
                next.delete(costItem);
            } else {
                next.add(costItem);
            }
            return next;
        });
    };

    const selectAll = () => setSelectedItems(new Set(data.map((d) => d.cost_item)));
    const selectNone = () => setSelectedItems(new Set());

    const filteredData = sortedData.filter((row) => selectedItems.has(row.cost_item));

    const chartData = filteredData;

    return (
        <Card className="p-0 gap-0 h-full flex flex-col">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">
                        Budget Utilization by Type
                    </CardTitle>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <Filter className="h-3.5 w-3.5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="end">
                            <div className="flex items-center justify-between border-b px-3 py-2">
                                <span className="text-xs font-medium">Cost Items</span>
                                <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={selectAll}>
                                        All
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={selectNone}>
                                        None
                                    </Button>
                                </div>
                            </div>
                            <div className="border-b px-2 py-1.5">
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search code or description..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="h-7 pl-7 text-xs"
                                    />
                                </div>
                            </div>
                            <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                                {searchFilteredList.length === 0 ? (
                                    <p className="text-xs text-muted-foreground px-2 py-1">No matches</p>
                                ) : (
                                    searchFilteredList.map((row) => (
                                        <label
                                            key={row.cost_item}
                                            className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer text-xs"
                                        >
                                            <Checkbox
                                                checked={selectedItems.has(row.cost_item)}
                                                onCheckedChange={() => toggleItem(row.cost_item)}
                                            />
                                            <span className="font-mono text-muted-foreground shrink-0">{row.cost_item}</span>
                                            <span className="truncate">{row.label}</span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent className="p-1 flex-1 min-h-0">
                {chartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cost items selected.</p>
                ) : (
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 160, top: 5, bottom: 5 }}>
                            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                            <XAxis
                                type="number"
                                domain={[0, 'dataMax']}
                                tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`}
                                fontSize={11}
                            />
                            <YAxis
                                type="category"
                                dataKey="label"
                                width={180}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                            />
                            <ChartTooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const row = payload[0].payload as LabourBudgetRow;
                                    return (
                                        <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-xl">
                                            <p className="font-medium mb-1">{row.label}</p>
                                            <div className="grid gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-sm" style={{ background: chartConfig.budget.color }} />
                                                    <span className="text-muted-foreground">Budget:</span>
                                                    <span className="font-mono font-medium">{formatCurrency(row.budget)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-sm" style={{ background: chartConfig.spent.color }} />
                                                    <span className="text-muted-foreground">Spent:</span>
                                                    <span className="font-mono font-medium">{formatCurrency(row.spent)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 pt-0.5 border-t mt-0.5">
                                                    <span className="text-muted-foreground">Utilization:</span>
                                                    <span className="font-mono font-medium">{row.percent}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="budget" fill="var(--color-budget)" radius={[0, 4, 4, 0]} barSize={16}>
                                <LabelList
                                    dataKey="budget"
                                    position="right"
                                    fontSize={11}
                                    formatter={(v: number) => formatCurrency(v)}
                                    className="fill-foreground"
                                />
                            </Bar>
                            <Bar dataKey="spent" fill="var(--color-spent)" radius={[0, 4, 4, 0]} barSize={16}>
                                <LabelList
                                    position="right"
                                    fontSize={11}
                                    className="fill-foreground"
                                    content={({ x, y, width, height, index }) => {
                                        const row = chartData[index as number];
                                        if (!row) return null;
                                        return (
                                            <text
                                                x={(x as number) + (width as number) + 4}
                                                y={(y as number) + (height as number) / 2}
                                                dominantBaseline="central"
                                                fontSize={11}
                                                className="fill-muted-foreground"
                                            >
                                                {formatCurrency(row.spent)} ({row.percent}%)
                                            </text>
                                        );
                                    }}
                                />
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
}
