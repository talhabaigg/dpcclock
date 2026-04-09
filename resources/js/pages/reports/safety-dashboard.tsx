import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertTriangle, ChevronLeft, ChevronRight, FileText, Loader2, ShieldAlert, Activity, Flame } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Safety Dashboard', href: '/safety-dashboard' },
];

const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
];

type MonthlyRow = {
    project: string;
    reported_injuries: number;
    type_of_injuries: string;
    wcq_claims: number;
    lti_count: number;
    total_days_lost: number;
    mti_count: number;
    days_suitable_duties: number;
    first_aid_count: number;
    report_only_count: number;
    near_miss_count: number;
    medical_expenses: number;
};

type FYRow = MonthlyRow & {
    man_hours: number;
    ltifr: number | null;
};

type Totals = {
    reported_injuries: number;
    wcq_claims: number;
    lti_count: number;
    total_days_lost: number;
    mti_count: number;
    days_suitable_duties: number;
    first_aid_count: number;
    report_only_count: number;
    near_miss_count: number;
    medical_expenses: number;
    man_hours?: number;
    ltifr?: number | null;
};

type PageProps = {
    currentMonth: number;
    currentYear: number;
    totalRecords: number;
};

const INCIDENT_COLORS = {
    lti: '#ef4444',
    mti: '#f97316',
    firstAid: '#eab308',
    nearMiss: '#3b82f6',
    reportOnly: '#6b7280',
} as const;

const incidentBreakdownConfig = {
    lti: { label: 'LTI', color: INCIDENT_COLORS.lti },
    mti: { label: 'MTI', color: INCIDENT_COLORS.mti },
    firstAid: { label: 'First Aid', color: INCIDENT_COLORS.firstAid },
    nearMiss: { label: 'Near Miss', color: INCIDENT_COLORS.nearMiss },
    reportOnly: { label: 'Report Only', color: INCIDENT_COLORS.reportOnly },
} satisfies ChartConfig;

const projectBarConfig = {
    injuries: { label: 'Injuries', color: '#3b82f6' },
} satisfies ChartConfig;

const trendConfig = {
    injuries: { label: 'Injuries', color: '#3b82f6' },
    lti: { label: 'LTI', color: '#ef4444' },
    near_miss: { label: 'Near Miss', color: '#6b7280' },
} satisfies ChartConfig;

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-AU').format(value);
}

function StatCard({ label, value, icon: Icon, href }: { label: string; value: string | number; icon: typeof AlertTriangle; href?: string }) {
    const content = (
        <div className={`rounded-md border border-input shadow-xs px-4 py-3 flex items-center gap-3 transition-colors ${href ? 'hover:bg-muted/30 cursor-pointer' : ''}`}>
            <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
                <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
        </div>
    );
    return href ? <a href={href}>{content}</a> : content;
}

export default function SafetyDashboard() {
    const { currentMonth, currentYear } = usePage<{ props: PageProps }>().props as unknown as PageProps;

    const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
    const [monthlyTotals, setMonthlyTotals] = useState<Totals | null>(null);
    const [monthlyLoading, setMonthlyLoading] = useState(false);
    const [fyRows, setFyRows] = useState<FYRow[]>([]);
    const [fyTotals, setFyTotals] = useState<Totals | null>(null);
    const [fyLabel, setFyLabel] = useState('');
    const [fyLoading, setFyLoading] = useState(false);
    const [fyTrend, setFyTrend] = useState<{ month: string; injuries: number; lti: number; near_miss: number }[]>([]);

    const years = useMemo(() => Array.from({ length: 10 }, (_, i) => String(currentYear - 5 + i)), [currentYear]);

    const fetchMonthlyData = useCallback(async (month: string, year: string) => {
        setMonthlyLoading(true);
        try {
            const params = new URLSearchParams({ year, month });
            const res = await fetch(`/safety-dashboard/monthly-data?${params}`);
            const data = await res.json();
            if (data.success) {
                setMonthlyRows(data.rows);
                setMonthlyTotals(data.totals);
            }
        } catch {
            setMonthlyRows([]);
            setMonthlyTotals(null);
        } finally {
            setMonthlyLoading(false);
        }
    }, []);

    const fetchFYData = useCallback(async (month: string, year: string) => {
        setFyLoading(true);
        try {
            const params = new URLSearchParams({ year, month });
            const res = await fetch(`/safety-dashboard/fy-data?${params}`);
            const data = await res.json();
            if (data.success) {
                setFyRows(data.rows);
                setFyTotals(data.totals);
                setFyLabel(data.fy_label);
                setFyTrend(data.monthly_trend ?? []);
            }
        } catch {
            setFyRows([]);
            setFyTotals(null);
        } finally {
            setFyLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMonthlyData(String(currentMonth), String(currentYear));
        fetchFYData(String(currentMonth), String(currentYear));
    }, [currentMonth, currentYear, fetchMonthlyData, fetchFYData]);

    const handleFilterChange = (month: string, year: string) => {
        setSelectedMonth(month);
        setSelectedYear(year);
        fetchMonthlyData(month, year);
        fetchFYData(month, year);
        const url = new URL(window.location.href);
        url.searchParams.set('month', month);
        url.searchParams.set('year', year);
        window.history.replaceState({}, '', url.toString());
    };

    const goMonth = (dir: -1 | 1) => {
        let m = Number(selectedMonth) + dir;
        let y = Number(selectedYear);
        if (m < 1) { m = 12; y--; }
        if (m > 12) { m = 1; y++; }
        handleFilterChange(String(m), String(y));
    };

    const monthLabel = months.find((m) => m.value === selectedMonth)?.label ?? '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Safety Dashboard" />
            <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 p-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(-1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Select value={selectedMonth} onValueChange={(v) => handleFilterChange(v, selectedYear)}>
                            <SelectTrigger className="w-[130px] h-9 border-0 shadow-none text-base font-semibold px-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedYear} onValueChange={(v) => handleFilterChange(selectedMonth, v)}>
                            <SelectTrigger className="w-[80px] h-9 border-0 shadow-none text-base font-semibold px-1">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {years.map((y) => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goMonth(1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/reports/whs-report?year=${selectedYear}&month=${selectedMonth}`}>
                            <FileText className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline">WHS Report</span>
                            <span className="sm:hidden">Report</span>
                        </Link>
                    </Button>
                </div>

                {/* Summary stat cards */}
                {monthlyTotals && !monthlyLoading && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label="Reported Injuries"
                            value={monthlyTotals.reported_injuries}
                            icon={AlertTriangle}
                            href={monthlyTotals.reported_injuries > 0 ? `/injury-register?year=${selectedYear}&month=${selectedMonth}` : undefined}
                        />
                        <StatCard label="LTIs" value={monthlyTotals.lti_count} icon={ShieldAlert} />
                        <StatCard label="Near Misses" value={monthlyTotals.near_miss_count} icon={Activity} />
                        <StatCard label="First Aid" value={monthlyTotals.first_aid_count} icon={Flame} />
                    </div>
                )}

                {/* Charts */}
                {!monthlyLoading && !fyLoading && monthlyTotals && (() => {
                    const shortName = (p: string) => p.split(' - ')[0] || p;
                    const monthProjectsWithInjuries = monthlyRows.filter(r => r.reported_injuries > 0).sort((a, b) => b.reported_injuries - a.reported_injuries).map(r => ({ ...r, label: shortName(r.project) }));
                    const fyProjectsWithInjuries = fyRows.filter(r => r.reported_injuries > 0).sort((a, b) => b.reported_injuries - a.reported_injuries).map(r => ({ ...r, label: shortName(r.project) }));
                    const barChartHeight = Math.max(80, Math.max(monthProjectsWithInjuries.length, fyProjectsWithInjuries.length) * 36 + 16);

                    const buildBreakdown = (t: Totals) => [
                        { name: 'LTI', value: t.lti_count, fill: INCIDENT_COLORS.lti },
                        { name: 'MTI', value: t.mti_count, fill: INCIDENT_COLORS.mti },
                        { name: 'First Aid', value: t.first_aid_count, fill: INCIDENT_COLORS.firstAid },
                        { name: 'Near Miss', value: t.near_miss_count, fill: INCIDENT_COLORS.nearMiss },
                        { name: 'Report Only', value: t.report_only_count, fill: INCIDENT_COLORS.reportOnly },
                    ].filter(d => d.value > 0);

                    const monthBreakdown = buildBreakdown(monthlyTotals);
                    const fyBreakdown = fyTotals ? buildBreakdown(fyTotals) : [];

                    // Donut mini-component
                    const DonutWithLegend = ({ data, label }: { data: typeof monthBreakdown; label: string }) => {
                        const total = data.reduce((s, d) => s + d.value, 0);
                        if (data.length === 0) return (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                                <p className="text-sm text-muted-foreground text-center py-4">No incidents.</p>
                            </div>
                        );
                        return (
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
                                <div className="flex items-center gap-4">
                                    <ChartContainer config={incidentBreakdownConfig} className="shrink-0" style={{ width: 110, height: 110 }}>
                                        <PieChart>
                                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                                            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={32} outerRadius={50} strokeWidth={2} stroke="var(--background)" paddingAngle={2}>
                                                {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                            </Pie>
                                            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-foreground text-lg font-bold">{total}</text>
                                        </PieChart>
                                    </ChartContainer>
                                    <div className="flex flex-col gap-1 text-xs min-w-0">
                                        {data.map((d) => (
                                            <div key={d.name} className="flex items-center gap-1.5">
                                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                                                <span className="text-muted-foreground truncate">{d.name}</span>
                                                <span className="font-semibold ml-auto tabular-nums">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Injuries by Project — Monthly + FY side by side */}
                            <div className="flex flex-col">
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Injuries by Project</h3>
                                <div className="rounded-md border border-input shadow-xs px-4 py-3 flex flex-col sm:flex-row gap-4 flex-1">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-muted-foreground mb-2">{monthLabel}</p>
                                        {monthProjectsWithInjuries.length > 0 ? (
                                            <ChartContainer config={projectBarConfig} className="w-full" style={{ height: barChartHeight }}>
                                                <BarChart data={monthProjectsWithInjuries} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                                                    <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10 }} />
                                                    <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={80} tick={{ fontSize: 10 }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="reported_injuries" name="Injuries" fill="var(--color-injuries)" radius={[0, 4, 4, 0]} barSize={16} />
                                                </BarChart>
                                            </ChartContainer>
                                        ) : (
                                            <p className="text-xs text-muted-foreground text-center py-4">No injuries.</p>
                                        )}
                                    </div>
                                    {fyRows.length > 0 && (
                                        <>
                                            <div className="hidden sm:block w-px bg-border shrink-0 self-stretch" />
                                            <hr className="sm:hidden border-border" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-muted-foreground mb-2">{fyLabel ? `FY ${fyLabel.slice(2)}` : 'FY to date'}</p>
                                                {fyProjectsWithInjuries.length > 0 ? (
                                                    <ChartContainer config={projectBarConfig} className="w-full" style={{ height: barChartHeight }}>
                                                        <BarChart data={fyProjectsWithInjuries} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                                                            <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 10 }} />
                                                            <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={80} tick={{ fontSize: 10 }} />
                                                            <ChartTooltip content={<ChartTooltipContent />} />
                                                            <Bar dataKey="reported_injuries" name="Injuries" fill="var(--color-injuries)" radius={[0, 4, 4, 0]} barSize={16} />
                                                        </BarChart>
                                                    </ChartContainer>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground text-center py-4">No injuries.</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Incident Breakdown — Monthly + FY side by side */}
                            <div className="flex flex-col">
                                <h3 className="text-sm font-medium text-muted-foreground mb-2">Incident Breakdown</h3>
                                <div className="rounded-md border border-input shadow-xs px-4 py-3 flex flex-col sm:flex-row items-center gap-4 flex-1">
                                    <DonutWithLegend data={monthBreakdown} label={monthLabel} />
                                    {fyTotals && (
                                        <>
                                            <div className="hidden sm:block w-px bg-border shrink-0 self-stretch" />
                                            <hr className="sm:hidden border-border" />
                                            <DonutWithLegend data={fyBreakdown} label={fyLabel ? `FY ${fyLabel.slice(2)}` : 'FY to date'} />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Injury Trend */}
                {!fyLoading && fyTrend.length > 1 && (
                    <div>
                        <div className="flex items-baseline justify-between mb-2">
                            <h3 className="text-sm font-medium text-muted-foreground">Injury Trend</h3>
                            {fyLabel && <span className="text-xs text-muted-foreground">{fyLabel}</span>}
                        </div>
                        <div className="rounded-md border border-input shadow-xs px-4 py-3">
                            <ChartContainer config={trendConfig} className="w-full" style={{ height: 200 }}>
                                <AreaChart data={fyTrend} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="fillInjuries" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="var(--color-injuries)" stopOpacity={0.2} />
                                            <stop offset="100%" stopColor="var(--color-injuries)" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} tick={{ fontSize: 11 }} />
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                    <Area dataKey="injuries" name="Injuries" type="monotone" stroke="var(--color-injuries)" fill="url(#fillInjuries)" strokeWidth={2} />
                                    <Area dataKey="lti" name="LTI" type="monotone" stroke="var(--color-lti)" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
                                </AreaChart>
                            </ChartContainer>
                        </div>
                    </div>
                )}

                {/* Monthly Overview */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="text-base font-semibold">Monthly Overview</h3>
                        <span className="text-xs text-muted-foreground">{monthLabel} {selectedYear}</span>
                    </div>

                    {monthlyLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!monthlyLoading && monthlyRows.length > 0 && (
                        <div className="rounded-md border border-input shadow-xs overflow-x-auto">
                            <table className="w-full text-sm min-w-[900px]">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Project</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Injuries</th>
                                        <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[160px]">Type</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">WCQ</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">LTI</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Days Lost</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">MTI</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Suitable Duties</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">First Aid</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Near Miss</th>
                                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Medical $</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyRows.map((row) => (
                                        <tr key={row.project} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-2.5 font-medium">{row.project}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {row.reported_injuries > 0 ? (
                                                    <a href={`/injury-register?year=${selectedYear}&month=${selectedMonth}&project=${encodeURIComponent(row.project)}`} className="text-primary font-medium hover:underline">{row.reported_injuries}</a>
                                                ) : (
                                                    <span className="text-muted-foreground">0</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-sm text-muted-foreground">{row.type_of_injuries}</td>
                                            <td className="px-3 py-2.5 text-center">{row.wcq_claims || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.lti_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.total_days_lost || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.mti_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.days_suitable_duties || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.first_aid_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.near_miss_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-right">{row.medical_expenses ? formatCurrency(row.medical_expenses) : <span className="text-muted-foreground">$0</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {monthlyTotals && (
                                    <tfoot>
                                        <tr className="bg-muted/40 font-semibold">
                                            <td className="px-4 py-2.5">Total</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {monthlyTotals.reported_injuries > 0 ? (
                                                    <a href={`/injury-register?year=${selectedYear}&month=${selectedMonth}`} className="text-primary hover:underline">{monthlyTotals.reported_injuries}</a>
                                                ) : '0'}
                                            </td>
                                            <td className="px-3 py-2.5"></td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.wcq_claims}</td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.lti_count}</td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.total_days_lost}</td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.mti_count}</td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.days_suitable_duties}</td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.first_aid_count}</td>
                                            <td className="px-3 py-2.5 text-center">{monthlyTotals.near_miss_count}</td>
                                            <td className="px-3 py-2.5 text-right">{formatCurrency(monthlyTotals.medical_expenses)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}

                    {!monthlyLoading && monthlyRows.length === 0 && monthlyTotals !== null && (
                        <p className="py-8 text-center text-sm text-muted-foreground">No incidents found for {monthLabel} {selectedYear}.</p>
                    )}
                </div>

                {/* WHS Performance FY */}
                <div>
                    <div className="flex items-baseline justify-between mb-3">
                        <h3 className="text-base font-semibold">WHS Performance</h3>
                        {fyLabel && <span className="text-xs text-muted-foreground">{fyLabel} (Jul {fyLabel.slice(2, 6)} – {monthLabel} {selectedYear})</span>}
                    </div>

                    {fyLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!fyLoading && fyRows.length > 0 && (
                        <div className="rounded-md border border-input shadow-xs overflow-x-auto">
                            <table className="w-full text-sm min-w-[1100px]">
                                <thead>
                                    <tr className="border-b bg-muted/40">
                                        <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Project</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Injuries</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">WCQ</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">LTI</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Days Lost</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">MTI</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Suitable Duties</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">First Aid</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Report Only</th>
                                        <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Near Miss</th>
                                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Medical $</th>
                                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Man Hours</th>
                                        <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">LTIFR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fyRows.map((row) => (
                                        <tr key={row.project} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-2.5 font-medium">{row.project}</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {row.reported_injuries > 0 ? (
                                                    <a href={`/injury-register?fy=${fyLabel.slice(2, 6)}&fy_month=${selectedMonth}&fy_year=${selectedYear}&project=${encodeURIComponent(row.project)}`} className="text-primary font-medium hover:underline">{row.reported_injuries}</a>
                                                ) : (
                                                    <span className="text-muted-foreground">0</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">{row.wcq_claims || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.lti_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.total_days_lost || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.mti_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.days_suitable_duties || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.first_aid_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.report_only_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-center">{row.near_miss_count || <span className="text-muted-foreground">0</span>}</td>
                                            <td className="px-3 py-2.5 text-right">{row.medical_expenses ? formatCurrency(row.medical_expenses) : <span className="text-muted-foreground">$0</span>}</td>
                                            <td className="px-3 py-2.5 text-right">{formatNumber(row.man_hours)}</td>
                                            <td className="px-3 py-2.5 text-right">{row.ltifr !== null ? row.ltifr.toFixed(2) : <span className="text-muted-foreground">-</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                {fyTotals && (
                                    <tfoot>
                                        <tr className="bg-muted/40 font-semibold">
                                            <td className="px-4 py-2.5">Total</td>
                                            <td className="px-3 py-2.5 text-center">
                                                {fyTotals.reported_injuries > 0 ? (
                                                    <a href={`/injury-register?fy=${fyLabel.slice(2, 6)}&fy_month=${selectedMonth}&fy_year=${selectedYear}`} className="text-primary hover:underline">{fyTotals.reported_injuries}</a>
                                                ) : '0'}
                                            </td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.wcq_claims}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.lti_count}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.total_days_lost}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.mti_count}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.days_suitable_duties}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.first_aid_count}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.report_only_count}</td>
                                            <td className="px-3 py-2.5 text-center">{fyTotals.near_miss_count}</td>
                                            <td className="px-3 py-2.5 text-right">{formatCurrency(fyTotals.medical_expenses)}</td>
                                            <td className="px-3 py-2.5 text-right">{formatNumber(fyTotals.man_hours ?? 0)}</td>
                                            <td className="px-3 py-2.5 text-right">{fyTotals.ltifr !== null && fyTotals.ltifr !== undefined ? fyTotals.ltifr.toFixed(2) : '-'}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}

                    {!fyLoading && fyRows.length === 0 && !fyLabel && (
                        <p className="py-8 text-center text-sm text-muted-foreground">No incidents found for the current financial year.</p>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
