import { SuccessAlertFlash } from '@/components/alert-flash';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Absentees', href: '/absent' }];

interface Location {
    id: number;
    name: string;
}

interface Absentee {
    employee_id: number;
    employee_name: string;
    reason: string | null;
    notes: string | null;
    updated_at: string | null;
    updated_by_name: string | null;
}

interface Prestart {
    id: string;
    work_date: string;
    work_date_formatted: string;
    location: Location | null;
}

interface Props {
    absentees: Absentee[];
    prestart: Prestart | null;
    filters: { project_id?: string; work_day?: string; reason?: string; employee?: string };
    locations: Location[];
    workDates: { value: string; label: string }[];
    reasonOptions: Record<string, string>;
    employeeOptions: { value: string; label: string }[];
}

export default function AbsenteesIndex({ absentees, prestart, filters, locations, workDates, reasonOptions, employeeOptions }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [locationOpen, setLocationOpen] = useState(false);
    const [employeeOpen, setEmployeeOpen] = useState(false);

    const applyFilter = (key: string, value: string) => {
        router.get('/absent', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const resetFilters = () => {
        router.get('/absent', {}, { preserveState: true, replace: true });
    };

    const selectedLocation = locations.find((l) => String(l.id) === String(filters.project_id));
    const hasSelection = filters.project_id && filters.work_day;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Absentees" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4">
                    <div className="w-48">
                        <Label>Work Day</Label>
                        <Select
                            value={filters.work_day ?? 'none'}
                            onValueChange={(val) => applyFilter('work_day', val === 'none' ? '' : val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select date" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">Select date</SelectItem>
                                {workDates.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-64">
                        <Label>Project</Label>
                        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                    {selectedLocation?.name ?? 'Select project'}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0">
                                <Command>
                                    <CommandInput placeholder="Search projects..." />
                                    <CommandList>
                                        <CommandEmpty>No projects found.</CommandEmpty>
                                        <CommandGroup>
                                            {locations.map((loc) => (
                                                <CommandItem
                                                    key={loc.id}
                                                    onSelect={() => {
                                                        applyFilter('project_id', String(loc.id));
                                                        setLocationOpen(false);
                                                    }}
                                                >
                                                    <Check className={`mr-2 h-4 w-4 ${String(loc.id) === String(filters.project_id) ? 'opacity-100' : 'opacity-0'}`} />
                                                    {loc.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    {hasSelection && (
                        <div className="w-48">
                            <Label>Filter by Reason</Label>
                            <Select
                                value={filters.reason ?? 'all'}
                                onValueChange={(val) => applyFilter('reason', val === 'all' ? '' : val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="All reasons" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All reasons</SelectItem>
                                    <SelectItem value="unset">No reason set</SelectItem>
                                    {Object.entries(reasonOptions).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {hasSelection && (
                        <div className="w-48">
                            <Label>Employee</Label>
                            <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                        {employeeOptions.find((e) => e.value === filters.employee)?.label ?? 'All employees'}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-0">
                                    <Command>
                                        <CommandInput placeholder="Search employee..." />
                                        <CommandList>
                                            <CommandEmpty>No employees found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => { applyFilter('employee', ''); setEmployeeOpen(false); }}>
                                                    All employees
                                                </CommandItem>
                                                {employeeOptions.map((emp) => (
                                                    <CommandItem
                                                        key={emp.value}
                                                        onSelect={() => { applyFilter('employee', emp.value); setEmployeeOpen(false); }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${emp.value === filters.employee ? 'opacity-100' : 'opacity-0'}`} />
                                                        {emp.label}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    )}
                    {(filters.project_id || filters.work_day || filters.reason || filters.employee) && (
                        <Button variant="ghost" size="sm" onClick={resetFilters}>
                            Reset
                        </Button>
                    )}
                    {hasSelection && prestart && can('prestarts.edit') && filters.work_day === new Date().toISOString().slice(0, 10) && (
                        <Button asChild className="ml-auto">
                            <Link href={`/absent/${prestart.id}/manage`}>Manage Absentees</Link>
                        </Button>
                    )}
                </div>

                {/* Content */}
                {!hasSelection && (
                    <p className="py-8 text-center text-muted-foreground">Select a project and work day to view absentees.</p>
                )}

                {hasSelection && !prestart && (
                    <p className="py-8 text-center text-muted-foreground">No prestart found for the selected project and date.</p>
                )}

                {hasSelection && prestart && (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {absentees.length} absentee{absentees.length !== 1 ? 's' : ''} for{' '}
                            <span className="font-medium text-foreground">{prestart.location?.name}</span> on{' '}
                            <span className="font-medium text-foreground">{prestart.work_date_formatted}</span>
                        </p>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Project</TableHead>
                                        <TableHead>Reason</TableHead>
                                        <TableHead>Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {absentees.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                                No absentees — all employees have signed the prestart.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {absentees.map((a) => (
                                        <TableRow key={a.employee_id}>
                                            <TableCell className="font-medium">{a.employee_name}</TableCell>
                                            <TableCell>
                                                {prestart?.location ? (
                                                    <Link href={`/locations/${prestart.location.id}`}>
                                                        <Badge variant="outline">{prestart.location.name.split(' - ')[0]}</Badge>
                                                    </Link>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>{a.reason ? (reasonOptions[a.reason] ?? a.reason) : '-'}</TableCell>
                                            <TableCell>
                                                {a.notes && <div>{a.notes}</div>}
                                                {a.updated_at && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {a.updated_by_name ? `Updated by ${a.updated_by_name}` : 'Updated'} on {a.updated_at}
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
