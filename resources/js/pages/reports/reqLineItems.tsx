import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { format, subDays } from 'date-fns';
import { CalendarIcon, Download, FileWarning, Search } from 'lucide-react';
import Papa from 'papaparse';
import { useState } from 'react';
import { DateRange } from 'react-day-picker';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '/' },
    { title: 'PO Missing Codes', href: '/reports/req-line-items-desc' },
];

type LineItem = {
    id: number;
    code: string;
    description: string;
    unit_cost: number;
    requisition: {
        id: number;
        supplier: { id: number; name: string };
        po_number: string;
        created_at: string;
    };
};

type Filters = { from: string | null; to: string | null };

const fmtCurrency = (v: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(v);

export default function POMissingCodesReport() {
    const { lineItems, filters } = usePage<{ lineItems: LineItem[]; filters: Filters }>().props;
    const hasFilters = !!(filters.from || filters.to);

    const [date, setDate] = useState<DateRange | undefined>(() => {
        if (filters.from || filters.to) {
            return {
                from: filters.from ? new Date(filters.from) : undefined,
                to: filters.to ? new Date(filters.to) : undefined,
            };
        }
        return undefined;
    });

    const applyFilter = (range: DateRange | undefined) => {
        setDate(range);
        router.get(
            '/reports/req-line-items-desc',
            {
                from: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
                to: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
            },
            { preserveState: true },
        );
    };

    const applyPreset = (days: number) => {
        const range = { from: subDays(new Date(), days), to: new Date() };
        applyFilter(range);
    };

    const generateCSV = () => {
        if (!lineItems.length) return;
        const csv = Papa.unparse(
            lineItems.map((item) => ({
                ID: item.id,
                Code: item.code || 'No Code',
                Description: item.description,
                'Unit Cost': item.unit_cost,
                'Requisition ID': item.requisition.id,
                'Created At': new Date(item.requisition.created_at).toLocaleDateString(),
                'PO Number': item.requisition.po_number || 'Not Generated',
                Supplier: item.requisition.supplier?.name ?? '',
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `po-missing-codes${date?.from ? '-' + format(date.from, 'dd-MM-yyyy') : ''}${date?.to ? '-to-' + format(date.to, 'dd-MM-yyyy') : ''}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Initial state — no filters applied yet
    if (!hasFilters) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="PO Missing Codes" />
                <div className="flex flex-col items-center justify-center gap-6 p-8 pt-24">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Search className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-lg font-semibold">PO Missing Codes</h2>
                        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                            Find requisition line items that are missing a cost code. Select a date range to get started.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => applyPreset(7)}>Last 7 days</Button>
                        <Button variant="outline" size="sm" onClick={() => applyPreset(30)}>Last 30 days</Button>
                        <Button variant="outline" size="sm" onClick={() => applyPreset(90)}>Last 90 days</Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                                    Custom range
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="center">
                                <Calendar
                                    mode="range"
                                    selected={date}
                                    onSelect={(range) => {
                                        if (range?.from && range?.to) {
                                            applyFilter(range);
                                        } else {
                                            setDate(range);
                                        }
                                    }}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="PO Missing Codes" />

            <div className="flex flex-col gap-4 p-4 md:p-6">
                {/* Toolbar */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                            variant="outline" size="sm"
                            className={cn('h-8 text-xs', !date && 'text-muted-foreground')}
                            onClick={() => applyPreset(7)}
                        >
                            7d
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            className="h-8 text-xs"
                            onClick={() => applyPreset(30)}
                        >
                            30d
                        </Button>
                        <Button
                            variant="outline" size="sm"
                            className="h-8 text-xs"
                            onClick={() => applyPreset(90)}
                        >
                            90d
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                                    <CalendarIcon className="h-3.5 w-3.5" />
                                    {date?.from && date?.to ? (
                                        <>
                                            {format(date.from, 'dd MMM')} – {format(date.to, 'dd MMM yyyy')}
                                        </>
                                    ) : (
                                        'Custom'
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="range"
                                    selected={date}
                                    onSelect={(range) => {
                                        if (range?.from && range?.to) {
                                            applyFilter(range);
                                        } else {
                                            setDate(range);
                                        }
                                    }}
                                    numberOfMonths={2}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs tabular-nums">
                            {lineItems.length} result{lineItems.length !== 1 ? 's' : ''}
                        </span>
                        {lineItems.length > 0 && (
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={generateCSV}>
                                <Download className="h-3.5 w-3.5" />
                                CSV
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table or empty */}
                {lineItems.length > 0 ? (
                    <div className="overflow-hidden rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">Description</TableHead>
                                    <TableHead className="text-xs text-right">Unit Cost</TableHead>
                                    <TableHead className="text-xs">PO Number</TableHead>
                                    <TableHead className="text-xs">Supplier</TableHead>
                                    <TableHead className="text-xs">Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lineItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-sm max-w-[350px] truncate">{item.description}</TableCell>
                                        <TableCell className="text-sm text-right tabular-nums">{fmtCurrency(item.unit_cost)}</TableCell>
                                        <TableCell className="text-sm tabular-nums">{item.requisition.po_number || '—'}</TableCell>
                                        <TableCell className="text-sm">{item.requisition.supplier?.name ?? '—'}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {new Date(item.requisition.created_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                            <FileWarning className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No line items with missing codes in this period.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
