import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CheckCircle2, Clock, FileQuestion, PenLine, ShieldCheck, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

interface KioskOption {
    id: number;
    eh_kiosk_id: string;
    name: string;
    location_name: string | null;
}

interface FileType {
    id: number;
    name: string;
}

interface FileTypeBreakdown {
    id: number;
    name: string;
    category: string[];
    expired: number;
    expiring_soon: number;
    missing: number;
}

type RequirementLevel = 'mandatory' | 'preferred' | 'optional';
type FileStatus = 'valid' | 'expired' | 'expiring_soon' | 'missing';

interface FileStatusEntry {
    status: FileStatus;
    level: RequirementLevel;
}

interface EmployeeCompliance {
    id: number;
    name: string;
    employment_type: string | null;
    statuses: Record<number, FileStatusEntry>;
    expired_count: number;
    expiring_soon_count: number;
    missing_count: number;
    unsigned_count: number;
    overall: 'non_compliant' | 'warning' | 'compliant';
}

interface Summary {
    expired: number;
    expiring_soon: number;
    missing: number;
    unsigned: number;
    total_workers: number;
    compliant: number;
}

interface ComplianceDashboardProps {
    kiosks: KioskOption[];
    selectedKioskId: string | null;
    employees: EmployeeCompliance[];
    fileTypes: FileType[];
    summary: Summary;
    fileTypeBreakdown: FileTypeBreakdown[];
}

type FilterStatus = 'all' | 'non_compliant' | 'warning' | 'compliant';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Compliance Dashboard', href: '/compliance-dashboard' }];

export default function ComplianceDashboard({ kiosks, selectedKioskId, employees, fileTypes, summary, fileTypeBreakdown }: ComplianceDashboardProps) {
    const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
    const [expandedFileType, setExpandedFileType] = useState<number | null>(null);

    const filteredEmployees = useMemo(() => {
        if (statusFilter === 'all') return employees;
        return employees.filter((e) => e.overall === statusFilter);
    }, [employees, statusFilter]);

    const handleKioskChange = (value: string) => {
        router.get('/compliance-dashboard', { kiosk_id: value }, { preserveState: false });
    };

    const hasIssues = summary.expired > 0 || summary.expiring_soon > 0 || summary.missing > 0 || summary.unsigned > 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Compliance Dashboard" />
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6">
                {/* Header row: title + kiosk selector */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">Compliance Dashboard</h1>
                        <p className="text-sm text-muted-foreground">Site worker file compliance overview</p>
                    </div>

                    {kiosks.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Site</span>
                            <Select value={selectedKioskId ?? undefined} onValueChange={handleKioskChange}>
                                <SelectTrigger className="w-[260px]">
                                    <SelectValue placeholder="Select a site..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {kiosks.map((kiosk) => (
                                        <SelectItem key={kiosk.eh_kiosk_id} value={kiosk.eh_kiosk_id}>
                                            {kiosk.location_name ?? kiosk.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* No kiosks state */}
                {kiosks.length === 0 && (
                    <Empty className="border py-16">
                        <EmptyHeader>
                            <EmptyMedia variant="icon">
                                <ShieldCheck />
                            </EmptyMedia>
                            <EmptyTitle>No sites assigned</EmptyTitle>
                            <EmptyDescription>You don't have any kiosk assignments. Contact your administrator to get access.</EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                )}

                {/* Dashboard content */}
                {kiosks.length > 0 && selectedKioskId && (
                    <>
                        {/* Summary strip */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                            <SummaryMetric
                                label="Total Workers"
                                value={summary.total_workers}
                                variant="neutral"
                            />
                            <SummaryMetric
                                label="Expired"
                                value={summary.expired}
                                variant={summary.expired > 0 ? 'danger' : 'success'}
                                icon={<XCircle className="size-3.5" />}
                            />
                            <SummaryMetric
                                label="Expiring Soon"
                                value={summary.expiring_soon}
                                sublabel="within 30 days"
                                variant={summary.expiring_soon > 0 ? 'warning' : 'success'}
                                icon={<Clock className="size-3.5" />}
                            />
                            <SummaryMetric
                                label="Missing"
                                value={summary.missing}
                                variant={summary.missing > 0 ? 'danger' : 'success'}
                                icon={<FileQuestion className="size-3.5" />}
                            />
                            <SummaryMetric
                                label="Unsigned Docs"
                                value={summary.unsigned}
                                variant={summary.unsigned > 0 ? 'warning' : 'success'}
                                icon={<PenLine className="size-3.5" />}
                                className="col-span-2 sm:col-span-1"
                            />
                        </div>

                        {/* All compliant state */}
                        {!hasIssues && employees.length > 0 && (
                            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
                                <CheckCircle2 className="size-4 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    All {summary.total_workers} workers at this site are up to date.
                                </p>
                            </div>
                        )}

                        {/* No workers state */}
                        {employees.length === 0 && (
                            <Empty className="border py-16">
                                <EmptyHeader>
                                    <EmptyMedia variant="icon">
                                        <ShieldCheck />
                                    </EmptyMedia>
                                    <EmptyTitle>No site workers</EmptyTitle>
                                    <EmptyDescription>No site workers are assigned to this kiosk.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}

                        {/* Workers table + file type breakdown */}
                        {employees.length > 0 && (
                            <div className="flex flex-col gap-6 xl:flex-row">
                                {/* Workers table */}
                                <div className="min-w-0 flex-1">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h2 className="text-sm font-medium">Workers</h2>
                                        <Select value={statusFilter} onValueChange={(v: FilterStatus) => setStatusFilter(v)}>
                                            <SelectTrigger className="w-[160px]" size="sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Workers</SelectItem>
                                                <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                                                <SelectItem value="warning">Warning</SelectItem>
                                                <SelectItem value="compliant">Compliant</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="rounded-lg border">
                                        <TooltipProvider delay={200}>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Worker</TableHead>
                                                        <TableHead>Type</TableHead>
                                                        <TableHead className="text-center">Status</TableHead>
                                                        <TableHead className="text-center">Files</TableHead>
                                                        <TableHead className="text-center">Unsigned</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredEmployees.map((employee) => (
                                                        <TableRow key={employee.id}>
                                                            <TableCell>
                                                                <Link
                                                                    href={`/employees/${employee.id}`}
                                                                    className="font-medium hover:underline"
                                                                >
                                                                    {employee.name}
                                                                </Link>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground">{employee.employment_type ?? '-'}</TableCell>
                                                            <TableCell className="text-center">
                                                                <OverallBadge status={employee.overall} />
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <FileStatusDots statuses={employee.statuses} fileTypes={fileTypes} />
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                {employee.unsigned_count > 0 ? (
                                                                    <span className="text-sm tabular-nums">
                                                                        {employee.unsigned_count}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {filteredEmployees.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                                                No workers match the selected filter.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </TooltipProvider>
                                    </div>
                                </div>

                                {/* File type breakdown grouped by category */}
                                {fileTypeBreakdown.length > 0 && (
                                    <div className="w-full xl:w-80 xl:shrink-0">
                                        <h2 className="mb-3 text-sm font-medium">Issues by File Type</h2>
                                        <FileTypeBreakdownPanel
                                            items={fileTypeBreakdown}
                                            expandedId={expandedFileType}
                                            onToggle={(id) => setExpandedFileType(expandedFileType === id ? null : id)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}

// --- Supporting components ---

function SummaryMetric({
    label,
    value,
    sublabel,
    variant,
    icon,
    className,
}: {
    label: string;
    value: number;
    sublabel?: string;
    variant: 'neutral' | 'danger' | 'warning' | 'success';
    icon?: React.ReactNode;
    className?: string;
}) {
    const colors = {
        neutral: 'text-foreground',
        danger: 'text-red-600/80 dark:text-red-400/80',
        warning: 'text-amber-600/80 dark:text-amber-400/80',
        success: 'text-muted-foreground',
    };

    return (
        <div className={cn('rounded-lg border px-4 py-3', className)}>
            <div className="flex items-center gap-1.5">
                {icon && <span className={cn(colors[variant])}>{icon}</span>}
                <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={cn('mt-1 text-xl font-medium tabular-nums tracking-tight', colors[variant])}>
                {value}
            </p>
            {sublabel && <p className="mt-0.5 text-[11px] leading-none text-muted-foreground">{sublabel}</p>}
        </div>
    );
}

function OverallBadge({ status }: { status: 'non_compliant' | 'warning' | 'compliant' }) {
    if (status === 'compliant') {
        return <Badge variant="secondary" className="font-normal">Compliant</Badge>;
    }
    if (status === 'warning') {
        return <Badge variant="outline" className="text-amber-700/80 dark:text-amber-400/70">Warning</Badge>;
    }
    return <Badge variant="outline" className="text-red-700/80 dark:text-red-400/70">Non-Compliant</Badge>;
}

const LEVEL_LABEL: Record<RequirementLevel, string> = {
    mandatory: 'Mandatory',
    preferred: 'Preferred',
    optional: 'Optional',
};

const STATUS_LABEL: Record<FileStatus, string> = {
    valid: 'Valid',
    expired: 'Expired',
    expiring_soon: 'Expiring soon',
    missing: 'Missing',
};

function FileStatusDots({ statuses, fileTypes }: { statuses: Record<number, FileStatusEntry>; fileTypes: FileType[] }) {
    const fileTypeMap = useMemo(() => {
        const map = new Map<number, string>();
        fileTypes.forEach((ft) => map.set(ft.id, ft.name));
        return map;
    }, [fileTypes]);

    const entries = Object.entries(statuses);
    if (entries.length === 0) return <span className="text-muted-foreground">-</span>;

    return (
        <div className="flex flex-wrap items-center justify-center gap-0.5">
            {entries.map(([typeId, entry]) => {
                const name = fileTypeMap.get(Number(typeId)) ?? `File #${typeId}`;
                const { status, level } = entry;

                // Status drives color, level drives intensity/treatment.
                const statusColor =
                    status === 'valid' ? 'bg-emerald-400/60 dark:bg-emerald-500/40' :
                    status === 'expired' ? 'bg-red-400/80 dark:bg-red-500/60' :
                    status === 'expiring_soon' ? 'bg-amber-400/80 dark:bg-amber-500/60' :
                    'bg-red-300/70 dark:bg-red-500/40'; // missing

                // Optional gaps fade to muted grey instead of red — they're informational.
                const optionalMuted = level === 'optional' && status !== 'valid';
                const dotClass = cn(
                    'block size-2 rounded-full',
                    optionalMuted ? 'bg-muted-foreground/40' : statusColor,
                    // Preferred items get a ring outline to flag "amber severity"
                    level === 'preferred' && status !== 'valid' && 'ring-1 ring-amber-500/60 ring-offset-1 ring-offset-background',
                );

                return (
                    <Tooltip key={typeId}>
                        <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center p-1">
                                <span className={dotClass} />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p className="text-xs font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">
                                <span className="capitalize">{LEVEL_LABEL[level]}</span>
                                <span className="mx-1">·</span>
                                {STATUS_LABEL[status]}
                            </p>
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
}

function FileTypeBreakdownPanel({
    items,
    expandedId,
    onToggle,
}: {
    items: FileTypeBreakdown[];
    expandedId: number | null;
    onToggle: (id: number) => void;
}) {
    const grouped = useMemo(() => {
        const categoryMap = new Map<string, FileTypeBreakdown[]>();

        for (const item of items) {
            const categories = item.category.length > 0 ? item.category : ['Uncategorised'];
            for (const cat of categories) {
                const existing = categoryMap.get(cat) ?? [];
                existing.push(item);
                categoryMap.set(cat, existing);
            }
        }

        return Array.from(categoryMap.entries())
            .sort(([a], [b]) => a.localeCompare(b));
    }, [items]);

    return (
        <div className="flex flex-col gap-4">
            {grouped.map(([category, fileTypes]) => (
                <div key={category}>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">{category}</p>
                    <div className="flex flex-col gap-1.5">
                        {fileTypes.map((ft) => {
                            const total = ft.expired + ft.expiring_soon + ft.missing;
                            const isExpanded = expandedId === ft.id;
                            return (
                                <button
                                    key={ft.id}
                                    type="button"
                                    onClick={() => onToggle(ft.id)}
                                    className={cn(
                                        'w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50',
                                        isExpanded && 'bg-muted/50',
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">{ft.name}</span>
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                            {total} issue{total !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    {isExpanded && (
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            {ft.expired > 0 && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="size-1.5 rounded-full bg-red-400/70 dark:bg-red-500/50" />
                                                    {ft.expired} expired
                                                </span>
                                            )}
                                            {ft.expiring_soon > 0 && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="size-1.5 rounded-full bg-amber-400/70 dark:bg-amber-500/50" />
                                                    {ft.expiring_soon} expiring
                                                </span>
                                            )}
                                            {ft.missing > 0 && (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <span className="size-1.5 rounded-full bg-red-300/60 dark:bg-red-500/30" />
                                                    {ft.missing} missing
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
