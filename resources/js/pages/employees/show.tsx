import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { AlertTriangle, Clock, LinkIcon, FolderOpen } from 'lucide-react';
import { useMemo } from 'react';

interface Worktype {
    id: number;
    eh_worktype_id: string;
    name: string;
}

interface ClockEntry {
    id: number;
    clock_in: string;
}

interface IncidentReport {
    id: number;
    report_number: string;
    incident_date: string;
    incident_type: string | null;
    project_name: string | null;
    status: string;
    location?: { external_id: string; name: string } | null;
}

interface Project {
    id: number;
    name: string;
    external_id: string;
    kiosk_id: number;
}

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    email: string;
    pin: string;
    external_id?: string;
    eh_employee_id?: string;
    employment_type?: string;
    display_name: string;
    worktypes?: Worktype[];
    clocks?: ClockEntry[];
    incident_reports?: IncidentReport[];
    created_at: string;
    updated_at: string;
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="py-3">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{label}</p>
            <div className="mt-1 text-sm">{children || <span className="text-muted-foreground italic">—</span>}</div>
        </div>
    );
}

export default function EmployeeShow() {
    const { employee: emp, projects, weekEnding } = usePage<{
        employee: Employee;
        projects: Project[];
        weekEnding: string;
    }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Employees', href: '/employees' },
        { title: emp.display_name || emp.name, href: `/employees/${emp.id}` },
    ];

    const employmentTypeLabel = emp.employment_type?.replace(/([A-Z])/g, ' $1').trim();
    const worktypeLabel = emp.worktypes?.map((wt) => wt.name).join(', ');

    // Derive unique week-ending dates (Fridays) from recent clocks, excluding current week
    const recentWeekEndings = useMemo(() => {
        if (!emp.clocks || emp.clocks.length === 0) return [];
        const seen = new Set<string>();
        seen.add(weekEnding); // exclude current week
        return emp.clocks
            .map((clock) => {
                const d = new Date(clock.clock_in);
                // Find the Friday of that week
                const day = d.getDay();
                const diff = (5 - day + 7) % 7;
                const friday = new Date(d);
                friday.setDate(d.getDate() + diff);
                const dd = String(friday.getDate()).padStart(2, '0');
                const mm = String(friday.getMonth() + 1).padStart(2, '0');
                const yyyy = friday.getFullYear();
                return `${dd}-${mm}-${yyyy}`;
            })
            .filter((we) => {
                if (seen.has(we)) return false;
                seen.add(we);
                return true;
            });
    }, [emp.clocks, weekEnding]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={emp.display_name || emp.name} />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Two-column layout */}
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-4">
                        {/* About Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                                            {getInitials(emp.name || '??')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <CardTitle className="text-base">About</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-0 pt-0">
                                <Separator />
                                <DetailItem label="Employee Type">
                                    {employmentTypeLabel ? (
                                        <Badge variant={emp.employment_type === 'FullTime' ? 'default' : emp.employment_type === 'Casual' ? 'outline' : 'secondary'} className="text-xs">
                                            {employmentTypeLabel}
                                        </Badge>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Email Address">
                                    {emp.email ? (
                                        <a href={`mailto:${emp.email}`} className="text-primary hover:underline">
                                            {emp.email}
                                        </a>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="External ID">
                                    {emp.external_id?.trim() ? (
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{emp.external_id}</code>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="EH Employee ID">
                                    {emp.eh_employee_id?.trim() ? (
                                        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{emp.eh_employee_id}</code>
                                    ) : null}
                                </DetailItem>
                                <Separator />
                                <DetailItem label="Work Types">
                                    {emp.worktypes && emp.worktypes.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5">
                                            {emp.worktypes.map((wt) => (
                                                <Badge key={wt.id} variant="secondary" className="text-xs">
                                                    {wt.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : null}
                                </DetailItem>
                            </CardContent>
                        </Card>

                        {/* Timesheets Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Clock className="h-4 w-4" />
                                    Timesheets
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 pt-0">
                                <Separator className="mb-2" />
                                <Link
                                    href={`/timesheets?employeeId=${emp.eh_employee_id}&weekEnding=${weekEnding}`}
                                    className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                                >
                                    <LinkIcon className="h-3.5 w-3.5" />
                                    This weeks timesheet
                                </Link>
                                {recentWeekEndings.length > 0 &&
                                    recentWeekEndings.map((we) => (
                                        <Link
                                            key={we}
                                            href={`/timesheets?employeeId=${emp.eh_employee_id}&weekEnding=${we}`}
                                            className="text-primary inline-flex items-center gap-1.5 text-sm hover:underline"
                                        >
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            {we}
                                        </Link>
                                    ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="flex flex-col gap-4">
                        {/* Projects Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <FolderOpen className="h-4 w-4" />
                                    Projects
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-4" />
                                {projects && projects.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {projects.map((project) => (
                                            <Link key={project.id} href={`/kiosks/${project.kiosk_id}/edit`}>
                                                <Badge variant="outline" className="text-sm hover:bg-accent cursor-pointer">
                                                    {project.external_id || project.name}
                                                </Badge>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No projects assigned</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Injury Register Card */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <AlertTriangle className="h-4 w-4" />
                                    Injury Register
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <Separator className="mb-4" />
                                {emp.incident_reports && emp.incident_reports.length > 0 ? (
                                    <div className="overflow-hidden rounded-lg border">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50">
                                                    <TableHead className="px-3 text-xs">ID</TableHead>
                                                    <TableHead className="px-3 text-xs">Occurred at</TableHead>
                                                    <TableHead className="px-3 text-xs">Project</TableHead>
                                                    <TableHead className="px-3 text-xs">Incident</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {emp.incident_reports.map((report) => (
                                                    <TableRow key={report.id}>
                                                        <TableCell className="px-3 text-xs font-medium">{report.report_number}</TableCell>
                                                        <TableCell className="px-3 text-xs">{formatDate(report.incident_date)}</TableCell>
                                                        <TableCell className="px-3 text-xs">
                                                            {report.project_name || report.location?.external_id || '—'}
                                                        </TableCell>
                                                        <TableCell className="px-3">
                                                            {report.incident_type ? (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    {report.incident_type}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm italic">No injury register records found</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
