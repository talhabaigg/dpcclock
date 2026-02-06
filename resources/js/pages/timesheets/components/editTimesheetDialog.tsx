import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { CheckCircle2, Clock, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type ClockEntry = {
    id: number | string;
    clock_in: string;
    clock_out: string | null;
    hours_worked: string;
    status: string;
    eh_employee_id: string | null;
    location: { external_id: string } | null;
    kiosk: { id: number; name: string; eh_kiosk_id: number };
    eh_kiosk_id: number | null;
    insulation_allowance: string | boolean;
    setout_allowance: string | boolean;
    laser_allowance: string | boolean;
    worktype?: { name: string };
};

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
    eh_location_id: number;
    locations?: string[];
};

type EditTimesheetDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    entries: ClockEntry[];
    kiosks: Kiosk[];
    locations: string[];
    date: string;
    employeeId: string;
    onSuccess?: () => void;
};

type FormEntry = {
    id: number | string;
    status: string;
    clockInHour: string;
    clockInMinute: string;
    clockOutHour: string;
    clockOutMinute: string;
    level: string;
    activity: string;
    location: string;
    eh_kiosk_id: number | '';
    hoursWorked: string;
    insulation_allowance: boolean;
    setout_allowance: boolean;
    laser_allowance: boolean;
};

export default function EditTimesheetDialog({ isOpen, onClose, entries, kiosks, locations, date, onSuccess }: EditTimesheetDialogProps) {
    const [formEntries, setFormEntries] = useState<FormEntry[]>([]);
    const [processing, setProcessing] = useState(false);

    // Split location into level and activity
    const splitLocation = (location: string): { level: string; activity: string } => {
        if (typeof location === 'string' && location.includes('-')) {
            const [level, ...activityParts] = location.split('-');
            return { level: level || '', activity: activityParts.join('-') || '' };
        }
        return { level: location || '', activity: '' };
    };

    // Group locations by level
    const groupedLocations = useMemo(() => {
        return locations.reduce((acc: Record<string, string[]>, location) => {
            const { level, activity } = splitLocation(location);
            if (!level) return acc;
            if (!acc[level]) acc[level] = [];
            if (activity && !acc[level].includes(activity)) {
                acc[level].push(activity);
            }
            return acc;
        }, {});
    }, [locations]);

    const levels = Object.keys(groupedLocations);

    // Initialize form from entries
    useEffect(() => {
        if (entries.length > 0) {
            const initialEntries: FormEntry[] = entries.map((entry) => {
                const clockIn = entry.clock_in ? new Date(entry.clock_in) : null;
                const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
                const locationId = entry.location?.external_id || '';
                const { level, activity } = splitLocation(locationId);

                return {
                    id: entry.id,
                    status: entry.status || '',
                    clockInHour: clockIn ? String(clockIn.getHours()).padStart(2, '0') : '08',
                    clockInMinute: clockIn ? String(clockIn.getMinutes()).padStart(2, '0') : '00',
                    clockOutHour: clockOut ? String(clockOut.getHours()).padStart(2, '0') : '',
                    clockOutMinute: clockOut ? String(clockOut.getMinutes()).padStart(2, '0') : '',
                    level,
                    activity,
                    location: locationId,
                    eh_kiosk_id: entry.eh_kiosk_id ? Number(entry.eh_kiosk_id) : ('' as const),
                    hoursWorked: entry.hours_worked || '0',
                    insulation_allowance: !!Number(entry.insulation_allowance),
                    setout_allowance: !!Number(entry.setout_allowance),
                    laser_allowance: !!Number(entry.laser_allowance),
                };
            });
            setFormEntries(initialEntries);
        }
    }, [entries]);

    // Get activities for the selected level
    const getActivitiesForLevel = (level: string): string[] => {
        return groupedLocations[level] || [];
    };

    // Update location when level/activity changes
    const updateEntryLocation = (index: number, level: string, activity: string) => {
        const newLocation = activity ? `${level}-${activity}` : level;
        setFormEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, level, activity, location: newLocation } : entry)));
    };

    // Calculate hours worked
    const calculateHoursWorked = (clockInHour: string, clockInMinute: string, clockOutHour: string, clockOutMinute: string): string => {
        if (!clockInHour || !clockOutHour) return '0';
        const inTime = new Date(0, 0, 0, +clockInHour, +clockInMinute);
        const outTime = new Date(0, 0, 0, +clockOutHour, +clockOutMinute);
        let diff = (outTime.getTime() - inTime.getTime()) / 3600000;
        if (diff < 0) diff += 24;
        return diff.toFixed(2);
    };

    const updateEntryField = (index: number, field: keyof FormEntry, value: string | number | boolean) => {
        setFormEntries((prev) =>
            prev.map((entry, i) => {
                if (i !== index) return entry;
                const updated = { ...entry, [field]: value };

                // Recalculate hours if time changed
                if (['clockInHour', 'clockInMinute', 'clockOutHour', 'clockOutMinute'].includes(field)) {
                    updated.hoursWorked = calculateHoursWorked(
                        updated.clockInHour,
                        updated.clockInMinute,
                        updated.clockOutHour,
                        updated.clockOutMinute,
                    );
                }

                return updated;
            }),
        );
    };

    const toggleAllowance = (index: number, type: 'insulation' | 'setout') => {
        setFormEntries((prev) =>
            prev.map((entry, i) => {
                if (i !== index) return entry;
                return {
                    ...entry,
                    insulation_allowance: type === 'insulation' ? !entry.insulation_allowance : false,
                    setout_allowance: type === 'setout' ? !entry.setout_allowance : false,
                };
            }),
        );
    };

    const toggleLaserAllowance = (index: number) => {
        const hasLaserElsewhere = formEntries.some((e, i) => i !== index && e.laser_allowance);
        if (hasLaserElsewhere && !formEntries[index].laser_allowance) {
            toast.warning('Laser Allowance can only be selected once.');
            return;
        }
        setFormEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, laser_allowance: !entry.laser_allowance } : entry)));
    };

    const addEntry = () => {
        const lastEntry = formEntries[formEntries.length - 1];
        setFormEntries((prev) => [
            ...prev,
            {
                id: `new-${Date.now()}`,
                status: '',
                clockInHour: lastEntry?.clockOutHour || '08',
                clockInMinute: lastEntry?.clockOutMinute || '00',
                clockOutHour: '',
                clockOutMinute: '',
                level: '',
                activity: '',
                location: '',
                eh_kiosk_id: lastEntry?.eh_kiosk_id || '',
                hoursWorked: '0',
                insulation_allowance: false,
                setout_allowance: false,
                laser_allowance: false,
            },
        ]);
    };

    const removeEntry = (index: number) => {
        if (formEntries.length <= 1) return;
        setFormEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        setProcessing(true);

        const clocksData = formEntries.map((entry) => ({
            id: typeof entry.id === 'string' && entry.id.startsWith('new-') ? null : entry.id,
            clockInHour: entry.clockInHour,
            clockInMinute: entry.clockInMinute,
            clockOutHour: entry.clockOutHour || null,
            clockOutMinute: entry.clockOutMinute || null,
            location: entry.location,
            eh_kiosk_id: entry.eh_kiosk_id,
            hoursWorked: entry.hoursWorked,
            insulation_allowance: entry.insulation_allowance ? '1' : '0',
            setout_allowance: entry.setout_allowance ? '1' : '0',
            laser_allowance: entry.laser_allowance ? '1' : '0',
        }));

        router.post(
            `${route('clock.edit.summary.post')}?date=${date}`,
            { clocks: clocksData },
            {
                onSuccess: () => {
                    setProcessing(false);
                    toast.success('Timesheet updated successfully');
                    onSuccess?.();
                    onClose();
                },
                onError: (errors) => {
                    setProcessing(false);
                    Object.values(errors).forEach((error) => toast.error(String(error)));
                },
            },
        );
    };

    // Time options
    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Edit Timesheet
                    </DialogTitle>
                    <DialogDescription>
                        {date} - {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                    </DialogDescription>
                </DialogHeader>

                {/* Entries Table */}
                <div className="space-y-4">
                    {formEntries.map((entry, index) => {
                        const isSynced = entry.status?.toLowerCase() === 'synced';
                        const activities = getActivitiesForLevel(entry.level);

                        return (
                            <div
                                key={entry.id}
                                className={cn(
                                    'rounded-xl border-2 p-4 transition-all',
                                    isSynced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card',
                                )}
                            >
                                {/* Row Header */}
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">Entry {index + 1}</span>
                                        {entry.status && (
                                            <Badge
                                                variant={isSynced ? 'default' : 'secondary'}
                                                className={cn('text-xs', isSynced && 'bg-emerald-600')}
                                            >
                                                {isSynced && <CheckCircle2 className="mr-1 h-3 w-3" />}
                                                {entry.status}
                                            </Badge>
                                        )}
                                        {isSynced && <span className="text-muted-foreground text-xs">(locked)</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono">
                                            {entry.hoursWorked}h
                                        </Badge>
                                        {formEntries.length > 1 && !isSynced && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeEntry(index)}
                                                className="text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Row Content */}
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {/* Start Time */}
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Start Time</Label>
                                        <div className="flex gap-1">
                                            <Select
                                                value={entry.clockInHour}
                                                onValueChange={(v) => updateEntryField(index, 'clockInHour', v)}
                                                disabled={isSynced}
                                            >
                                                <SelectTrigger className="w-[70px]">
                                                    <SelectValue placeholder="HH" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {hours.map((h) => (
                                                        <SelectItem key={h} value={h}>
                                                            {h}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <span className="flex items-center">:</span>
                                            <Select
                                                value={entry.clockInMinute}
                                                onValueChange={(v) => updateEntryField(index, 'clockInMinute', v)}
                                                disabled={isSynced}
                                            >
                                                <SelectTrigger className="w-[70px]">
                                                    <SelectValue placeholder="MM" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {minutes.map((m) => (
                                                        <SelectItem key={m} value={m}>
                                                            {m}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* End Time */}
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">End Time</Label>
                                        <div className="flex gap-1">
                                            <Select
                                                value={entry.clockOutHour}
                                                onValueChange={(v) => updateEntryField(index, 'clockOutHour', v)}
                                                disabled={isSynced}
                                            >
                                                <SelectTrigger className="w-[70px]">
                                                    <SelectValue placeholder="HH" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {hours.map((h) => (
                                                        <SelectItem key={h} value={h}>
                                                            {h}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <span className="flex items-center">:</span>
                                            <Select
                                                value={entry.clockOutMinute}
                                                onValueChange={(v) => updateEntryField(index, 'clockOutMinute', v)}
                                                disabled={isSynced}
                                            >
                                                <SelectTrigger className="w-[70px]">
                                                    <SelectValue placeholder="MM" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {minutes.map((m) => (
                                                        <SelectItem key={m} value={m}>
                                                            {m}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Level */}
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Level</Label>
                                        <Select value={entry.level} onValueChange={(v) => updateEntryLocation(index, v, '')} disabled={isSynced}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select level..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {levels.map((level) => {
                                                    const displayName = level.includes('-')
                                                        ? level.split('-').slice(1).join('-')
                                                        : level.length > 7
                                                          ? level.slice(7)
                                                          : level;
                                                    return (
                                                        <SelectItem key={level} value={level}>
                                                            {displayName}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Activity */}
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Activity</Label>
                                        <Select
                                            value={entry.activity}
                                            onValueChange={(v) => updateEntryLocation(index, entry.level, v)}
                                            disabled={isSynced || !entry.level || activities.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue
                                                    placeholder={
                                                        !entry.level
                                                            ? 'Select level first'
                                                            : activities.length === 0
                                                              ? 'No activities'
                                                              : 'Select activity...'
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {activities.map((activity) => {
                                                    const displayName = activity.length > 4 ? activity.slice(4) : activity;
                                                    return (
                                                        <SelectItem key={activity} value={activity}>
                                                            {displayName}
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Second Row: Kiosk & Allowances */}
                                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    {/* Kiosk */}
                                    <div className="space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Kiosk</Label>
                                        <Select
                                            value={entry.eh_kiosk_id ? String(entry.eh_kiosk_id) : ''}
                                            onValueChange={(v) => updateEntryField(index, 'eh_kiosk_id', Number(v))}
                                            disabled={isSynced}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select kiosk..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {kiosks.map((kiosk) => (
                                                    <SelectItem key={kiosk.eh_kiosk_id} value={String(kiosk.eh_kiosk_id)}>
                                                        {kiosk.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Allowances */}
                                    <div className="col-span-3 space-y-1.5">
                                        <Label className="text-muted-foreground text-xs">Allowances</Label>
                                        <div className="flex flex-wrap gap-4">
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <Checkbox
                                                    checked={entry.insulation_allowance}
                                                    onCheckedChange={() => toggleAllowance(index, 'insulation')}
                                                    disabled={isSynced}
                                                />
                                                <span className="text-sm">Insulation</span>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <Checkbox
                                                    checked={entry.setout_allowance}
                                                    onCheckedChange={() => toggleAllowance(index, 'setout')}
                                                    disabled={isSynced}
                                                />
                                                <span className="text-sm">SetOut</span>
                                            </label>
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <Checkbox
                                                    checked={entry.laser_allowance}
                                                    onCheckedChange={() => toggleLaserAllowance(index)}
                                                    disabled={isSynced}
                                                />
                                                <span className="text-sm">Laser</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Add Entry Button */}
                <Button variant="outline" onClick={addEntry} className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Add Entry
                </Button>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose} disabled={processing}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={processing} className="gap-2">
                        {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
