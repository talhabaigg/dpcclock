import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserInfo } from '@/components/user-info';
import { router } from '@inertiajs/react';
import { AlertTriangle, Calendar, ChevronDown, ChevronsDownUp, ChevronsUpDown, Hammer, MapPin, Trash, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import StatusBadge from './statusBadge';

type Clock = {
    id: number | string;
    clock_in: string;
    status: string;
    clock_out: string | null;
    hours_worked: number;
    eh_location_id: string | number;
    eh_worktype_id: number | null;
    location?: { parentLocation: { eh_location_id: string | number }; external_id: string };
    work_type?: { eh_worktype_id: number; name: string };
    created_at: string;
    updated_at: string;
};

export type EmployeeRow = {
    id: number | string;
    name: string;
    eh_employee_id: string | number;
    email: string;
    timesheet?: {
        days: Record<string, Clock[]>;
    } | null;
    total_hours_week: number;
};

interface ReviewTimesheetGridProps {
    days: string[];
    employees: EmployeeRow[];
}

type GroupByMode = 'employee' | 'date' | 'worktype' | 'location';

function parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(datetime: string): string {
    return new Date(datetime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const OVERTIME_DAY_THRESHOLD = 10;
const totalColumns = (dayCount: number) => dayCount + 4;

function getEmployeeWorkTypes(emp: EmployeeRow): string[] {
    if (!emp.timesheet?.days) return [];
    const types = new Set<string>();
    Object.values(emp.timesheet.days).forEach((clocks) => {
        clocks.forEach((c) => {
            types.add(c.work_type?.name || 'Standard');
        });
    });
    return Array.from(types);
}

/** Expanded detail panel shown below an employee row */
function ExpandedDetail({ emp, days, onDelete }: { emp: EmployeeRow; days: string[]; onDelete: (id: number | string) => void }) {
    const daysWithClocks = days.filter((day) => {
        const clocks = emp.timesheet?.days?.[day] ?? [];
        return clocks.length > 0;
    });

    return (
        <div className="divide-y px-2 py-1.5 sm:px-4 sm:py-2">
            {daysWithClocks.length === 0 ? (
                <p className="py-2 text-center text-xs text-muted-foreground">No entries this week</p>
            ) : (
                daysWithClocks.map((day) => {
                    const d = parseLocalDate(day);
                    const clocks: Clock[] = emp.timesheet?.days?.[day] ?? [];
                    const dayTotal = clocks.reduce((sum, c) => sum + Number(c.hours_worked), 0);

                    return (
                        <div key={day} className="flex gap-2 py-2 first:pt-0 last:pb-0 sm:gap-4">
                            <div className="w-14 shrink-0 pt-0.5 sm:w-20">
                                <div className="text-xs font-semibold">{d.toLocaleDateString('en-AU', { weekday: 'short' })}</div>
                                <div className="text-[11px] text-muted-foreground">
                                    {d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })}
                                </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                {clocks.map((c) => (
                                    <ClockEntryRow key={c.id} clock={c} onDelete={onDelete} />
                                ))}
                            </div>
                            <div className="w-12 shrink-0 pt-0.5 text-right sm:w-14">
                                <span
                                    className={`text-xs font-semibold tabular-nums ${dayTotal > OVERTIME_DAY_THRESHOLD ? 'text-amber-700 dark:text-amber-400' : ''}`}
                                >
                                    {dayTotal.toFixed(2)}h
                                </span>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}

/** Single clock entry row inside the expanded detail */
function ClockEntryRow({ clock, onDelete }: { clock: Clock; onDelete: (id: number | string) => void }) {
    const timeIn = formatTime(clock.clock_in);
    const timeOut = clock.clock_out ? formatTime(clock.clock_out) : null;

    const level = (() => {
        if (!clock.location?.external_id) return '';
        const parts = clock.location.external_id.split('::');
        return parts[1]?.split('-')[0] || '';
    })();

    const task = (() => {
        if (!clock.location?.external_id) return '';
        const parts = clock.location.external_id.split('::');
        const after = parts[1] || '';
        const hp = after.split('-');
        return (hp[1] || '').slice(4);
    })();

    return (
        <div className="group flex items-start gap-1.5 rounded-md bg-muted/40 px-1.5 py-1.5 text-xs sm:gap-2 sm:px-2">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                    {!timeOut ? (
                        <>
                            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                            <span className="tabular-nums text-amber-800 dark:text-amber-300">{timeIn} &rarr; ?</span>
                        </>
                    ) : (
                        <>
                            <span className="tabular-nums">
                                {timeIn} &ndash; {timeOut}
                            </span>
                            <span className="font-semibold tabular-nums">{clock.hours_worked}h</span>
                        </>
                    )}
                    <StatusBadge status={clock.status} />
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground sm:gap-2">
                    {clock.work_type && <span>{clock.work_type.name}</span>}
                    {level && (
                        <>
                            {clock.work_type && <span>&middot;</span>}
                            <span>{level}</span>
                        </>
                    )}
                    {task && (
                        <>
                            <span>&middot;</span>
                            <span>{task}</span>
                        </>
                    )}
                </div>
            </div>
            <button
                onClick={() => onDelete(clock.id)}
                className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
                <Trash className="h-3 w-3" />
            </button>
        </div>
    );
}

/** Grouped-by-date view: each date is a section with all employees under it */
function GroupedByDateView({
    days,
    employees,
    onDelete,
}: {
    days: string[];
    employees: EmployeeRow[];
    onDelete: (id: number | string) => void;
}) {
    const today = useMemo(() => new Date(), []);

    const daysWithData = days.filter((day) =>
        employees.some((emp) => {
            const clocks = emp.timesheet?.days?.[day] ?? [];
            return clocks.length > 0;
        }),
    );

    if (daysWithData.length === 0) {
        return <p className="py-8 text-center text-sm text-muted-foreground">No entries this week</p>;
    }

    return (
        <div className="divide-y">
            {daysWithData.map((day) => {
                const d = parseLocalDate(day);
                const isToday = isSameDay(d, today);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const empsWithClocks = employees.filter((emp) => (emp.timesheet?.days?.[day] ?? []).length > 0);
                const dayGrandTotal = empsWithClocks.reduce((sum, emp) => {
                    const clocks = emp.timesheet?.days?.[day] ?? [];
                    return sum + clocks.reduce((s, c) => s + Number(c.hours_worked), 0);
                }, 0);

                return (
                    <div key={day} className="py-2 sm:py-3">
                        <div
                            className={`mx-2 mb-2 flex flex-col gap-1 rounded-md px-2.5 py-2 sm:mx-4 sm:flex-row sm:items-center sm:justify-between sm:px-3 ${
                                isToday
                                    ? 'bg-blue-50 dark:bg-blue-950/40'
                                    : isWeekend
                                      ? 'bg-muted/60'
                                      : 'bg-muted/30'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${isToday ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                    {d.toLocaleDateString('en-AU', { weekday: 'long' })}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                {isToday && <Badge className="bg-blue-500 text-[10px] text-white">Today</Badge>}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{empsWithClocks.length} employees</span>
                                <Badge variant="secondary" className="font-semibold">
                                    {dayGrandTotal.toFixed(2)}h
                                </Badge>
                            </div>
                        </div>
                        <div className="space-y-1 px-2 sm:px-4">
                            {empsWithClocks.map((emp) => {
                                const clocks = emp.timesheet?.days?.[day] ?? [];
                                const empDayTotal = clocks.reduce((s, c) => s + Number(c.hours_worked), 0);
                                return (
                                    <div key={emp.id} className="rounded-md border bg-card p-2 sm:p-3">
                                        <div className="mb-1.5 flex items-center justify-between sm:mb-2">
                                            <div className="min-w-0 flex-1">
                                                <span className="truncate text-sm font-medium">{emp.name}</span>
                                                <span className="ml-1.5 text-xs text-muted-foreground">#{emp.eh_employee_id}</span>
                                            </div>
                                            <span className="shrink-0 text-sm font-semibold tabular-nums">{empDayTotal.toFixed(2)}h</span>
                                        </div>
                                        <div className="space-y-1">
                                            {clocks.map((c) => (
                                                <ClockEntryRow key={c.id} clock={c} onDelete={onDelete} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Grouped-by-work-type view: worktype -> employee -> date -> clocks */
function GroupedByWorkTypeView({
    employees,
    onDelete,
}: {
    employees: EmployeeRow[];
    onDelete: (id: number | string) => void;
}) {
    type DayClocks = { day: string; clocks: Clock[] };
    type EmpEntry = { emp: EmployeeRow; days: DayClocks[]; total: number };

    const grouped = useMemo(() => {
        const map = new Map<string, Map<number | string, { emp: EmployeeRow; byDay: Map<string, Clock[]> }>>();

        employees.forEach((emp) => {
            if (!emp.timesheet?.days) return;
            Object.entries(emp.timesheet.days).forEach(([day, clocks]) => {
                clocks.forEach((c) => {
                    const typeName = c.work_type?.name || 'Standard';
                    if (!map.has(typeName)) map.set(typeName, new Map());
                    const empMap = map.get(typeName)!;
                    if (!empMap.has(emp.id)) empMap.set(emp.id, { emp, byDay: new Map() });
                    const entry = empMap.get(emp.id)!;
                    if (!entry.byDay.has(day)) entry.byDay.set(day, []);
                    entry.byDay.get(day)!.push(c);
                });
            });
        });

        const result: [string, EmpEntry[]][] = [];
        Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([typeName, empMap]) => {
                const empEntries: EmpEntry[] = Array.from(empMap.values()).map(({ emp, byDay }) => {
                    const days = Array.from(byDay.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([day, clocks]) => ({ day, clocks }));
                    const total = days.reduce((sum, d) => sum + d.clocks.reduce((s, c) => s + Number(c.hours_worked), 0), 0);
                    return { emp, days, total };
                });
                result.push([typeName, empEntries]);
            });

        return result;
    }, [employees]);

    if (grouped.length === 0) {
        return <p className="py-8 text-center text-sm text-muted-foreground">No entries this week</p>;
    }

    return (
        <div className="divide-y">
            {grouped.map(([typeName, empEntries]) => {
                const typeTotal = empEntries.reduce((sum, e) => sum + e.total, 0);

                return (
                    <div key={typeName} className="py-2 sm:py-3">
                        <div className="mx-2 mb-2 flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-2 sm:mx-4 sm:px-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs font-medium">
                                    {typeName}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{empEntries.length} employees</span>
                            </div>
                            <Badge variant="secondary" className="font-semibold">
                                {typeTotal.toFixed(2)}h
                            </Badge>
                        </div>
                        <div className="space-y-1.5 px-2 sm:px-4">
                            {empEntries.map(({ emp, days, total }) => (
                                <div key={`${typeName}-${emp.id}`} className="rounded-md border bg-card p-2 sm:p-3">
                                    <div className="mb-1.5 flex items-center justify-between sm:mb-2">
                                        <div className="min-w-0 flex-1">
                                            <span className="truncate text-sm font-medium">{emp.name}</span>
                                            <span className="ml-1.5 text-xs text-muted-foreground">#{emp.eh_employee_id}</span>
                                        </div>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums">{total.toFixed(2)}h</span>
                                    </div>
                                    <div className="divide-y">
                                        {days.map(({ day, clocks }) => {
                                            const d = parseLocalDate(day);
                                            const dayTotal = clocks.reduce((s, c) => s + Number(c.hours_worked), 0);
                                            return (
                                                <div key={day} className="flex gap-2 py-1.5 first:pt-0 last:pb-0 sm:gap-3">
                                                    <div className="w-14 shrink-0 pt-0.5 sm:w-16">
                                                        <div className="text-xs font-medium">
                                                            {d.toLocaleDateString('en-AU', { weekday: 'short' })}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground">
                                                            {d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })}
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0 flex-1 space-y-1">
                                                        {clocks.map((c) => (
                                                            <ClockEntryRow key={c.id} clock={c} onDelete={onDelete} />
                                                        ))}
                                                    </div>
                                                    <div className="w-10 shrink-0 pt-0.5 text-right sm:w-12">
                                                        <span className="text-xs font-semibold tabular-nums">{dayTotal.toFixed(2)}h</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Parse location external_id into a display label */
function parseLocationLabel(externalId: string): string {
    if (!externalId) return 'Unknown';
    const parts = externalId.split('::');
    const project = parts[0] || '';
    const rest = parts[1] || '';
    if (!rest) return project || 'Unknown';
    const level = rest.split('-')[0] || '';
    const hp = rest.split('-');
    const task = (hp[1] || '').slice(4);
    const pieces = [level, task].filter(Boolean);
    return pieces.length > 0 ? pieces.join(' - ') : project || 'Unknown';
}

/** Grouped-by-location view: collapsible location -> employee -> date -> clocks */
function GroupedByLocationView({
    employees,
    onDelete,
}: {
    employees: EmployeeRow[];
    onDelete: (id: number | string) => void;
}) {
    type DayClocks = { day: string; clocks: Clock[] };
    type EmpEntry = { emp: EmployeeRow; days: DayClocks[]; total: number };
    type LocGroup = { locKey: string; label: string; empEntries: EmpEntry[]; total: number };

    const [expandedLocs, setExpandedLocs] = useState<Set<string>>(new Set());
    const [expandedEmps, setExpandedEmps] = useState<Set<string>>(new Set());

    const toggleLoc = (locKey: string) => {
        setExpandedLocs((prev) => {
            const next = new Set(prev);
            if (next.has(locKey)) next.delete(locKey);
            else next.add(locKey);
            return next;
        });
    };

    const toggleEmp = (key: string) => {
        setExpandedEmps((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const grouped: LocGroup[] = useMemo(() => {
        const map = new Map<string, Map<number | string, { emp: EmployeeRow; byDay: Map<string, Clock[]> }>>();

        employees.forEach((emp) => {
            if (!emp.timesheet?.days) return;
            Object.entries(emp.timesheet.days).forEach(([day, clocks]) => {
                clocks.forEach((c) => {
                    const locKey = c.location?.external_id || 'unknown';
                    if (!map.has(locKey)) map.set(locKey, new Map());
                    const empMap = map.get(locKey)!;
                    if (!empMap.has(emp.id)) empMap.set(emp.id, { emp, byDay: new Map() });
                    const entry = empMap.get(emp.id)!;
                    if (!entry.byDay.has(day)) entry.byDay.set(day, []);
                    entry.byDay.get(day)!.push(c);
                });
            });
        });

        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([locKey, empMap]) => {
                const label = parseLocationLabel(locKey);
                const empEntries: EmpEntry[] = Array.from(empMap.values()).map(({ emp, byDay }) => {
                    const days = Array.from(byDay.entries())
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([day, clocks]) => ({ day, clocks }));
                    const total = days.reduce((sum, d) => sum + d.clocks.reduce((s, c) => s + Number(c.hours_worked), 0), 0);
                    return { emp, days, total };
                });
                const total = empEntries.reduce((sum, e) => sum + e.total, 0);
                return { locKey, label, empEntries, total };
            });
    }, [employees]);

    if (grouped.length === 0) {
        return <p className="py-8 text-center text-sm text-muted-foreground">No entries this week</p>;
    }

    return (
        <div className="divide-y">
            {grouped.map(({ locKey, label, empEntries, total: locTotal }) => {
                const isLocOpen = expandedLocs.has(locKey);

                return (
                    <div key={locKey}>
                        {/* Location row */}
                        <button
                            onClick={() => toggleLoc(locKey)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30 active:bg-muted/40 sm:px-4"
                        >
                            <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isLocOpen ? 'rotate-0' : '-rotate-90'}`}
                            />
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium">{label}</span>
                                <span className="ml-2 text-xs text-muted-foreground">{empEntries.length} employees</span>
                            </div>
                            <Badge variant="secondary" className="shrink-0 font-semibold">
                                {locTotal.toFixed(2)}h
                            </Badge>
                        </button>

                        {/* Employees under location */}
                        {isLocOpen && (
                            <div className="border-t bg-muted/5">
                                {empEntries.map(({ emp, days, total: empTotal }) => {
                                    const empKey = `${locKey}::${emp.id}`;
                                    const isEmpOpen = expandedEmps.has(empKey);

                                    return (
                                        <div key={empKey} className="border-b last:border-b-0">
                                            {/* Employee row */}
                                            <button
                                                onClick={() => toggleEmp(empKey)}
                                                className="flex w-full items-center gap-2 py-2 pl-9 pr-3 text-left transition-colors hover:bg-muted/30 active:bg-muted/40 sm:pl-12 sm:pr-4"
                                            >
                                                <ChevronDown
                                                    className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isEmpOpen ? 'rotate-0' : '-rotate-90'}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <span className="text-sm font-medium">{emp.name}</span>
                                                    <span className="ml-1.5 text-xs text-muted-foreground">#{emp.eh_employee_id}</span>
                                                </div>
                                                <span className="shrink-0 text-sm font-semibold tabular-nums">{empTotal.toFixed(2)}h</span>
                                            </button>

                                            {/* Date rows under employee */}
                                            {isEmpOpen && (
                                                <div className="border-t bg-muted/10 py-1 pl-14 pr-3 sm:pl-20 sm:pr-4">
                                                    <div className="divide-y">
                                                        {days.map(({ day, clocks }) => {
                                                            const d = parseLocalDate(day);
                                                            const dayTotal = clocks.reduce(
                                                                (s, c) => s + Number(c.hours_worked),
                                                                0,
                                                            );
                                                            return (
                                                                <div
                                                                    key={day}
                                                                    className="flex gap-2 py-1.5 first:pt-0 last:pb-0 sm:gap-3"
                                                                >
                                                                    <div className="w-14 shrink-0 pt-0.5 sm:w-16">
                                                                        <div className="text-xs font-medium">
                                                                            {d.toLocaleDateString('en-AU', {
                                                                                weekday: 'short',
                                                                            })}
                                                                        </div>
                                                                        <div className="text-[11px] text-muted-foreground">
                                                                            {d.toLocaleDateString('en-AU', {
                                                                                day: '2-digit',
                                                                                month: '2-digit',
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                        {clocks.map((c) => (
                                                                            <ClockEntryRow
                                                                                key={c.id}
                                                                                clock={c}
                                                                                onDelete={onDelete}
                                                                            />
                                                                        ))}
                                                                    </div>
                                                                    <div className="w-10 shrink-0 pt-0.5 text-right sm:w-12">
                                                                        <span className="text-xs font-semibold tabular-nums">
                                                                            {dayTotal.toFixed(2)}h
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Mobile card list for employee view — avoids table overflow issues */
function MobileEmployeeList({
    days,
    employees,
    expandedRows,
    toggleRow,
    onDelete,
}: {
    days: string[];
    employees: EmployeeRow[];
    expandedRows: Set<number | string>;
    toggleRow: (id: number | string) => void;
    onDelete: (id: number | string) => void;
}) {
    return (
        <div className="divide-y">
            {employees.map((emp) => {
                const isExpanded = expandedRows.has(emp.id);
                const hasMissing = Object.values(emp.timesheet?.days ?? {}).some((clocks) => clocks.some((c) => !c.clock_out));
                return (
                    <div key={emp.id}>
                        <button onClick={() => toggleRow(emp.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-muted/40">
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{emp.name}</div>
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>#{emp.eh_employee_id}</span>
                                    {getEmployeeWorkTypes(emp).map((wt) => (
                                        <span key={wt}>{wt}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {hasMissing && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                <Badge
                                    variant="secondary"
                                    className={`font-semibold ${emp.total_hours_week > 40 ? 'border border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' : ''}`}
                                >
                                    {Number(emp.total_hours_week).toFixed(2)}h
                                </Badge>
                            </div>
                        </button>
                        {isExpanded && (
                            <div className="border-t bg-muted/10 px-1 py-1">
                                <ExpandedDetail emp={emp} days={days} onDelete={onDelete} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** Desktop table grid for employee view */
function DesktopEmployeeTable({
    days,
    employees,
    expandedRows,
    toggleRow,
    onDelete,
}: {
    days: string[];
    employees: EmployeeRow[];
    expandedRows: Set<number | string>;
    toggleRow: (id: number | string) => void;
    onDelete: (id: number | string) => void;
}) {
    const today = useMemo(() => new Date(), []);
    const colSpan = totalColumns(days.length);

    return (
        <div className="overflow-auto">
            <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="min-w-[180px]">Employee</TableHead>
                        <TableHead className="text-muted-foreground min-w-[80px] text-xs font-normal">ID</TableHead>
                        <TableHead className="text-muted-foreground min-w-[80px] text-xs font-normal">Work Type</TableHead>
                        {days.map((day) => {
                            const d = parseLocalDate(day);
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = isSameDay(d, today);
                            return (
                                <TableHead
                                    key={day}
                                    className={`text-center ${isWeekend ? 'bg-muted/80' : ''} ${isToday ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                                >
                                    <div className={`text-xs font-medium ${isToday ? 'text-blue-700 dark:text-blue-400' : ''}`}>
                                        {d.toLocaleDateString('en-AU', { weekday: 'short' })}
                                    </div>
                                    <div
                                        className={`text-[11px] ${isToday ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}
                                    >
                                        {d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })}
                                    </div>
                                    {isToday && <div className="mx-auto mt-0.5 h-0.5 w-4 rounded-full bg-blue-500" />}
                                </TableHead>
                            );
                        })}
                        <TableHead className="bg-muted/60 text-center font-semibold">Total</TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {employees.map((emp) => {
                        const isExpanded = expandedRows.has(emp.id);
                        return (
                            <>
                                <TableRow key={emp.id} className="transition-colors hover:bg-muted/30">
                                    <TableCell className="align-top">
                                        <div className="flex items-center gap-1 pt-0.5">
                                            <button
                                                onClick={() => toggleRow(emp.id)}
                                                className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                            >
                                                <ChevronDown
                                                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                                                />
                                            </button>
                                            <UserInfo
                                                user={{
                                                    ...emp,
                                                    id: Number(emp.id),
                                                    email: emp.email,
                                                    email_verified_at: '',
                                                    created_at: '',
                                                    updated_at: '',
                                                    phone: '',
                                                }}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground align-top text-xs">
                                        {emp.eh_employee_id}
                                    </TableCell>
                                    <TableCell className="align-top">
                                        <div className="flex flex-wrap gap-1">
                                            {getEmployeeWorkTypes(emp).map((wt) => (
                                                <Badge key={wt} variant="outline" className="text-[10px] font-normal">
                                                    {wt}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>

                                    {isExpanded ? (
                                        <TableCell colSpan={days.length + 1} className="align-top">
                                            <span className="text-xs text-muted-foreground">
                                                {Number(emp.total_hours_week).toFixed(2)}h total &mdash; see details below
                                            </span>
                                        </TableCell>
                                    ) : (
                                        <>
                                            {days.map((day) => {
                                                const clocks: Clock[] = emp.timesheet?.days?.[day] ?? [];
                                                const d = parseLocalDate(day);
                                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                const isToday = isSameDay(d, today);
                                                const dayTotal = clocks.reduce((sum, c) => sum + Number(c.hours_worked), 0);
                                                const isOvertimeDay = dayTotal > OVERTIME_DAY_THRESHOLD;

                                                let cellBg = '';
                                                if (isOvertimeDay) cellBg = 'bg-amber-50/70 dark:bg-amber-950/20';
                                                else if (isToday) cellBg = 'bg-blue-50/40 dark:bg-blue-950/20';
                                                else if (isWeekend) cellBg = 'bg-muted/30';

                                                const hasMissing = clocks.some((c) => !c.clock_out);
                                                const hasLeave = clocks.some(
                                                    (c) => c.eh_worktype_id === 2471108 || c.eh_worktype_id === 2471109,
                                                );

                                                return (
                                                    <TableCell key={day} className={`text-center ${cellBg}`}>
                                                        {clocks.length === 0 ? (
                                                            <span className="text-muted-foreground/30 text-xs">-</span>
                                                        ) : (
                                                            <div className="flex flex-col items-center">
                                                                <span
                                                                    className={`text-sm font-semibold tabular-nums ${
                                                                        hasMissing
                                                                            ? 'text-amber-700 dark:text-amber-400'
                                                                            : isOvertimeDay
                                                                              ? 'text-red-600 dark:text-red-400'
                                                                              : hasLeave
                                                                                ? 'text-blue-700 dark:text-blue-400'
                                                                                : ''
                                                                    }`}
                                                                >
                                                                    {dayTotal.toFixed(2)}
                                                                </span>
                                                                {hasMissing && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className="bg-muted/20 align-top text-center">
                                                <Badge
                                                    variant="secondary"
                                                    className={`mx-auto font-semibold ${emp.total_hours_week > 40 ? 'border border-red-600 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400' : ''}`}
                                                >
                                                    {Number(emp.total_hours_week).toFixed(2)}
                                                </Badge>
                                            </TableCell>
                                        </>
                                    )}
                                </TableRow>

                                {isExpanded && (
                                    <TableRow key={`${emp.id}-detail`} className="bg-muted/10 hover:bg-muted/10">
                                        <TableCell colSpan={colSpan} className="p-0">
                                            <ExpandedDetail emp={emp} days={days} onDelete={onDelete} />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

/** Employee grid — mobile card list / desktop table */
function EmployeeGridView({
    days,
    employees,
    expandedRows,
    toggleRow,
    onDelete,
}: {
    days: string[];
    employees: EmployeeRow[];
    expandedRows: Set<number | string>;
    toggleRow: (id: number | string) => void;
    onDelete: (id: number | string) => void;
}) {
    return (
        <>
            {/* Mobile: card list */}
            <div className="md:hidden">
                <MobileEmployeeList days={days} employees={employees} expandedRows={expandedRows} toggleRow={toggleRow} onDelete={onDelete} />
            </div>
            {/* Desktop: full table */}
            <div className="hidden md:block">
                <DesktopEmployeeTable days={days} employees={employees} expandedRows={expandedRows} toggleRow={toggleRow} onDelete={onDelete} />
            </div>
        </>
    );
}

const ReviewTimesheetGrid = ({ days, employees }: ReviewTimesheetGridProps) => {
    const [deleteTarget, setDeleteTarget] = useState<{ id: number | string } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<number | string>>(new Set());
    const [groupBy, setGroupBy] = useState<GroupByMode>('employee');

    const allExpanded = employees.length > 0 && expandedRows.size === employees.length;

    const toggleRow = (empId: number | string) => {
        setExpandedRows((prev) => {
            const next = new Set(prev);
            if (next.has(empId)) next.delete(empId);
            else next.add(empId);
            return next;
        });
    };

    const toggleAll = () => {
        if (allExpanded) {
            setExpandedRows(new Set());
        } else {
            setExpandedRows(new Set(employees.map((e) => e.id)));
        }
    };

    const handleDelete = (id: number | string) => setDeleteTarget({ id });

    return (
        <Card className="mx-4 overflow-hidden p-0">
            {employees.length === 0 ? (
                <div className="text-muted-foreground flex items-center justify-center p-12 text-sm">
                    No timesheets found for this period.
                </div>
            ) : (
                <>
                    {/* Grid toolbar */}
                    <div className="flex items-center justify-between border-b px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Group by</span>
                            <Select value={groupBy} onValueChange={(val) => setGroupBy(val as GroupByMode)}>
                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employee">
                                        <Users className="h-3.5 w-3.5" />
                                        Employee
                                    </SelectItem>
                                    <SelectItem value="date">
                                        <Calendar className="h-3.5 w-3.5" />
                                        Date
                                    </SelectItem>
                                    <SelectItem value="worktype">
                                        <Hammer className="h-3.5 w-3.5" />
                                        Work Type
                                    </SelectItem>
                                    <SelectItem value="location">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Location
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {groupBy === 'employee' && (
                            <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 gap-1.5 text-xs text-muted-foreground">
                                {allExpanded ? (
                                    <>
                                        <ChevronsDownUp className="h-3.5 w-3.5" />
                                        Collapse All
                                    </>
                                ) : (
                                    <>
                                        <ChevronsUpDown className="h-3.5 w-3.5" />
                                        Expand All
                                    </>
                                )}
                            </Button>
                        )}
                    </div>

                    {/* View content */}
                    {groupBy === 'employee' && (
                        <EmployeeGridView
                            days={days}
                            employees={employees}
                            expandedRows={expandedRows}
                            toggleRow={toggleRow}
                            onDelete={handleDelete}
                        />
                    )}
                    {groupBy === 'date' && <GroupedByDateView days={days} employees={employees} onDelete={handleDelete} />}
                    {groupBy === 'worktype' && <GroupedByWorkTypeView employees={employees} onDelete={handleDelete} />}
                    {groupBy === 'location' && <GroupedByLocationView employees={employees} onDelete={handleDelete} />}
                </>
            )}

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete clock entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete this clock entry.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                if (deleteTarget) {
                                    router.delete(`/clocks/${deleteTarget.id}/delete`);
                                }
                                setDeleteTarget(null);
                            }}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};

export default ReviewTimesheetGrid;
