import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Head, Link, usePage } from '@inertiajs/react';
import { FileText, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/' },
    { title: 'Safety Dashboard', href: '/reports/safety-dashboard' },
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

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0 }).format(value);
}

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-AU').format(value);
}

export default function SafetyDashboard() {
    const { currentMonth, currentYear, totalRecords } = usePage<{ props: PageProps }>().props as unknown as PageProps;

    // Monthly state
    const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
    const [monthlyTotals, setMonthlyTotals] = useState<Totals | null>(null);
    const [monthlyLoading, setMonthlyLoading] = useState(false);

    // FY state
    const [fyRows, setFyRows] = useState<FYRow[]>([]);
    const [fyTotals, setFyTotals] = useState<Totals | null>(null);
    const [fyLabel, setFyLabel] = useState('');
    const [fyLoading, setFyLoading] = useState(false);

    const years = Array.from({ length: 10 }, (_, i) => String(currentYear - 5 + i));

    const fetchMonthlyData = useCallback(async (month: string, year: string) => {
        setMonthlyLoading(true);
        try {
            const params = new URLSearchParams({ year, month });
            const res = await fetch(`/reports/safety-dashboard/monthly-data?${params}`);
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
            const res = await fetch(`/reports/safety-dashboard/fy-data?${params}`);
            const data = await res.json();
            if (data.success) {
                setFyRows(data.rows);
                setFyTotals(data.totals);
                setFyLabel(data.fy_label);
            }
        } catch {
            setFyRows([]);
            setFyTotals(null);
        } finally {
            setFyLoading(false);
        }
    }, []);

    // Load both on mount
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

    const monthLabel = months.find((m) => m.value === selectedMonth)?.label ?? '';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Safety Dashboard" />
            <div className="flex flex-col gap-6 p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                            {formatNumber(totalRecords)} injury records
                        </span>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/reports/whs-report?year=${selectedYear}&month=${selectedMonth}`}>
                            <FileText className="mr-1 h-4 w-4" />
                            WHS Report
                        </Link>
                    </Button>
                </div>

                {/* Monthly Overview */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <h2 className="text-base font-semibold">Monthly Project Overview: {monthLabel} {selectedYear}</h2>
                            <div className="flex gap-2">
                                <Select value={selectedMonth} onValueChange={(v) => handleFilterChange(v, selectedYear)}>
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {months.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedYear} onValueChange={(v) => handleFilterChange(selectedMonth, v)}>
                                    <SelectTrigger className="w-[100px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {years.map((y) => (
                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {monthlyLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        )}

                        {!monthlyLoading && monthlyRows.length > 0 && (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="min-w-[140px]">Project</TableHead>
                                            <TableHead className="text-center">Reported Injuries</TableHead>
                                            <TableHead className="min-w-[200px]">Type of Injury(s)</TableHead>
                                            <TableHead className="text-center">WCQ Claims</TableHead>
                                            <TableHead className="text-center">LTI</TableHead>
                                            <TableHead className="text-center">Total Days Lost</TableHead>
                                            <TableHead className="text-center">MTI</TableHead>
                                            <TableHead className="text-center">Days on Suitable Duties</TableHead>
                                            <TableHead className="text-center">First Aid</TableHead>
                                            <TableHead className="text-center">Near Miss</TableHead>
                                            <TableHead className="text-right">Medical Expenses (Non-WC)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {monthlyRows.map((row) => (
                                            <TableRow key={row.project}>
                                                <TableCell className="font-medium">{row.project}</TableCell>
                                                <TableCell className="text-center">
                                                    {row.reported_injuries > 0 ? (
                                                        <a href={`/injury-register?year=${selectedYear}&month=${selectedMonth}&project=${encodeURIComponent(row.project)}`} className="text-primary underline hover:text-primary/80">{row.reported_injuries}</a>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">{row.type_of_injuries}</TableCell>
                                                <TableCell className="text-center">{row.wcq_claims}</TableCell>
                                                <TableCell className="text-center">{row.lti_count}</TableCell>
                                                <TableCell className="text-center">{row.total_days_lost}</TableCell>
                                                <TableCell className="text-center">{row.mti_count}</TableCell>
                                                <TableCell className="text-center">{row.days_suitable_duties}</TableCell>
                                                <TableCell className="text-center">{row.first_aid_count}</TableCell>
                                                <TableCell className="text-center">{row.near_miss_count}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.medical_expenses)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {monthlyTotals && (
                                            <TableRow className="bg-muted/50 font-bold">
                                                <TableCell>TOTAL</TableCell>
                                                <TableCell className="text-center">
                                                    {monthlyTotals.reported_injuries > 0 ? (
                                                        <a href={`/injury-register?year=${selectedYear}&month=${selectedMonth}`} className="text-primary underline hover:text-primary/80">{monthlyTotals.reported_injuries}</a>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell></TableCell>
                                                <TableCell className="text-center">{monthlyTotals.wcq_claims}</TableCell>
                                                <TableCell className="text-center">{monthlyTotals.lti_count}</TableCell>
                                                <TableCell className="text-center">{monthlyTotals.total_days_lost}</TableCell>
                                                <TableCell className="text-center">{monthlyTotals.mti_count}</TableCell>
                                                <TableCell className="text-center">{monthlyTotals.days_suitable_duties}</TableCell>
                                                <TableCell className="text-center">{monthlyTotals.first_aid_count}</TableCell>
                                                <TableCell className="text-center">{monthlyTotals.near_miss_count}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(monthlyTotals.medical_expenses)}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {!monthlyLoading && monthlyRows.length === 0 && monthlyTotals !== null && (
                            <p className="py-8 text-center text-muted-foreground">No incidents found for {monthLabel} {selectedYear}.</p>
                        )}
                    </CardContent>
                </Card>

                {/* WHS Performance FY */}
                <Card>
                    <CardContent className="pt-6">
                        {fyLabel && (
                            <h2 className="mb-4 text-base font-semibold">WHS Performance: {fyLabel} (July {fyLabel.slice(2, 6)} &ndash; {monthLabel} {selectedYear})</h2>
                        )}

                        {fyLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        )}

                        {!fyLoading && fyRows.length > 0 && (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="min-w-[140px]">Project</TableHead>
                                            <TableHead className="text-center">Reported Injuries</TableHead>
                                            <TableHead className="text-center">WCQ Claims</TableHead>
                                            <TableHead className="text-center">LTI</TableHead>
                                            <TableHead className="text-center">Total Days Lost</TableHead>
                                            <TableHead className="text-center">MTI</TableHead>
                                            <TableHead className="text-center">Days on Suitable Duties</TableHead>
                                            <TableHead className="text-center">First Aid</TableHead>
                                            <TableHead className="text-center">Report Only</TableHead>
                                            <TableHead className="text-center">Near Miss</TableHead>
                                            <TableHead className="text-right">Medical Expenses (Non-WC)</TableHead>
                                            <TableHead className="text-right">Man Hours</TableHead>
                                            <TableHead className="text-right">LTIFR</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {fyRows.map((row) => (
                                            <TableRow key={row.project}>
                                                <TableCell className="font-medium">{row.project}</TableCell>
                                                <TableCell className="text-center">
                                                    {row.reported_injuries > 0 ? (
                                                        <a href={`/injury-register?fy=${fyLabel.slice(2, 6)}&fy_month=${selectedMonth}&fy_year=${selectedYear}&project=${encodeURIComponent(row.project)}`} className="text-primary underline hover:text-primary/80">{row.reported_injuries}</a>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">{row.wcq_claims}</TableCell>
                                                <TableCell className="text-center">{row.lti_count}</TableCell>
                                                <TableCell className="text-center">{row.total_days_lost}</TableCell>
                                                <TableCell className="text-center">{row.mti_count}</TableCell>
                                                <TableCell className="text-center">{row.days_suitable_duties}</TableCell>
                                                <TableCell className="text-center">{row.first_aid_count}</TableCell>
                                                <TableCell className="text-center">{row.report_only_count}</TableCell>
                                                <TableCell className="text-center">{row.near_miss_count}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.medical_expenses)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(row.man_hours)}</TableCell>
                                                <TableCell className="text-right">{row.ltifr !== null ? row.ltifr.toFixed(2) : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {fyTotals && (
                                            <TableRow className="bg-muted/50 font-bold">
                                                <TableCell>TOTAL</TableCell>
                                                <TableCell className="text-center">
                                                    {fyTotals.reported_injuries > 0 ? (
                                                        <a href={`/injury-register?fy=${fyLabel.slice(2, 6)}&fy_month=${selectedMonth}&fy_year=${selectedYear}`} className="text-primary underline hover:text-primary/80">{fyTotals.reported_injuries}</a>
                                                    ) : (
                                                        <span className="text-muted-foreground">0</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">{fyTotals.wcq_claims}</TableCell>
                                                <TableCell className="text-center">{fyTotals.lti_count}</TableCell>
                                                <TableCell className="text-center">{fyTotals.total_days_lost}</TableCell>
                                                <TableCell className="text-center">{fyTotals.mti_count}</TableCell>
                                                <TableCell className="text-center">{fyTotals.days_suitable_duties}</TableCell>
                                                <TableCell className="text-center">{fyTotals.first_aid_count}</TableCell>
                                                <TableCell className="text-center">{fyTotals.report_only_count}</TableCell>
                                                <TableCell className="text-center">{fyTotals.near_miss_count}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(fyTotals.medical_expenses)}</TableCell>
                                                <TableCell className="text-right">{formatNumber(fyTotals.man_hours ?? 0)}</TableCell>
                                                <TableCell className="text-right">{fyTotals.ltifr !== null && fyTotals.ltifr !== undefined ? fyTotals.ltifr.toFixed(2) : '-'}</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {!fyLoading && fyRows.length === 0 && !fyLabel && (
                            <p className="py-8 text-center text-muted-foreground">No incidents found for the current financial year.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
