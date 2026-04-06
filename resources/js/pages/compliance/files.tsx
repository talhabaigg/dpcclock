import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle, Clock, Filter, Minus, Users, X, XCircle } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Compliance', href: '/compliance/files' }, { title: 'Employee Files', href: '/compliance/files' }];

interface FileTypeRef {
    id: number;
    name: string;
}

interface EmployeeRow {
    id: number;
    name: string;
    employment_type: string | null;
    statuses: Record<number, string>;
    overall: 'compliant' | 'non_compliant' | 'expiring';
}

interface Summary {
    total: number;
    compliant: number;
    non_compliant: number;
    expiring: number;
}

interface PageProps {
    employees: EmployeeRow[];
    fileTypes: FileTypeRef[];
    summary: Summary;
    filters: { employment_type?: string; compliance_status?: string };
    employmentTypes: string[];
}

function StatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'valid':
            return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
        case 'expiring_soon':
            return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
        case 'expired':
            return <XCircle className="h-3.5 w-3.5 text-red-500" />;
        case 'missing':
            return <Minus className="h-3.5 w-3.5 text-gray-400" />;
        default:
            return <span className="text-muted-foreground text-xs">—</span>;
    }
}

function OverallBadge({ overall }: { overall: string }) {
    switch (overall) {
        case 'compliant':
            return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Compliant</Badge>;
        case 'non_compliant':
            return <Badge variant="destructive" className="text-[10px]">Non-Compliant</Badge>;
        case 'expiring':
            return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]">Expiring</Badge>;
        default:
            return null;
    }
}

export default function ComplianceFilesIndex() {
    const { employees, fileTypes, summary, filters, employmentTypes } = usePage<{ props: PageProps }>().props as unknown as PageProps;

    const applyFilter = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value || undefined };
        Object.keys(newFilters).forEach((k) => {
            if (!newFilters[k as keyof typeof newFilters]) delete newFilters[k as keyof typeof newFilters];
        });
        router.get('/compliance/files', newFilters, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        router.get('/compliance/files', {}, { preserveState: true, preserveScroll: true });
    };

    const hasFilters = !!(filters.employment_type || filters.compliance_status);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="File Compliance" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Card>
                        <CardContent className="flex flex-col items-center p-4">
                            <Users className="text-muted-foreground mb-1 h-5 w-5" />
                            <span className="text-2xl font-bold">{summary.total}</span>
                            <span className="text-muted-foreground text-xs">Total Employees</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex flex-col items-center p-4">
                            <CheckCircle className="mb-1 h-5 w-5 text-green-500" />
                            <span className="text-2xl font-bold text-green-600">{summary.compliant}</span>
                            <span className="text-muted-foreground text-xs">Compliant</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex flex-col items-center p-4">
                            <XCircle className="mb-1 h-5 w-5 text-red-500" />
                            <span className="text-2xl font-bold text-red-600">{summary.non_compliant}</span>
                            <span className="text-muted-foreground text-xs">Non-Compliant</span>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex flex-col items-center p-4">
                            <AlertTriangle className="mb-1 h-5 w-5 text-yellow-500" />
                            <span className="text-2xl font-bold text-yellow-600">{summary.expiring}</span>
                            <span className="text-muted-foreground text-xs">Expiring Soon</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <Filter size={14} className="text-muted-foreground" />
                    <Select value={filters.employment_type ?? ''} onValueChange={(v) => applyFilter('employment_type', v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue placeholder="Employment Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {employmentTypes.map((t) => (
                                <SelectItem key={t} value={t}>
                                    {t}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={filters.compliance_status ?? ''} onValueChange={(v) => applyFilter('compliance_status', v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                            <SelectValue placeholder="Compliance Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="compliant">Compliant</SelectItem>
                            <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                            <SelectItem value="expiring">Expiring Soon</SelectItem>
                        </SelectContent>
                    </Select>
                    {hasFilters && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearFilters}>
                            <X size={14} />
                            Clear
                        </Button>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="sticky left-0 bg-muted/50 px-3 text-xs">Employee</TableHead>
                                <TableHead className="px-3 text-xs">Type</TableHead>
                                {fileTypes.map((ft) => (
                                    <TableHead key={ft.id} className="px-3 text-center text-xs whitespace-nowrap">
                                        {ft.name}
                                    </TableHead>
                                ))}
                                <TableHead className="px-3 text-xs">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={fileTypes.length + 3} className="text-muted-foreground py-8 text-center">
                                        No employees found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {employees.map((emp) => (
                                <TableRow key={emp.id}>
                                    <TableCell className="sticky left-0 bg-background px-3 text-sm font-medium">
                                        <Link href={`/employees/${emp.id}`} className="text-primary hover:underline">
                                            {emp.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="px-3 text-xs">
                                        {emp.employment_type ? (
                                            <Badge variant="outline" className="text-[10px]">
                                                {emp.employment_type}
                                            </Badge>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    {fileTypes.map((ft) => (
                                        <TableCell key={ft.id} className="px-3 text-center">
                                            {emp.statuses[ft.id] ? (
                                                <div className="flex justify-center">
                                                    <StatusIcon status={emp.statuses[ft.id]} />
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </TableCell>
                                    ))}
                                    <TableCell className="px-3">
                                        <OverallBadge overall={emp.overall} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
