import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Check, CircleHelp, Loader2, Pencil, Plus, ShieldAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
    eh_location_id: number;
    locations?: string[];
};

type InlineTimesheetEditProps = {
    entries: any[];
    kiosks: Kiosk[];
    locations: string[];
    date: string;
};

type EditState = {
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

export default function InlineTimesheetEdit({ entries, kiosks, locations, date }: InlineTimesheetEditProps) {
    const [editingId, setEditingId] = useState<number | string | null>(null);
    const [editState, setEditState] = useState<EditState | null>(null);
    const [processing, setProcessing] = useState(false);
    const [newEntries, setNewEntries] = useState<any[]>([]);
    const [newEditState, setNewEditState] = useState<EditState | null>(null);

    const splitLocation = (location: string): { level: string; activity: string } => {
        if (typeof location === 'string' && location.includes('-')) {
            const [level, ...activityParts] = location.split('-');
            return { level: level || '', activity: activityParts.join('-') || '' };
        }
        return { level: location || '', activity: '' };
    };

    const groupedLocations = useMemo(() => {
        return locations.reduce((acc: Record<string, string[]>, loc) => {
            const { level, activity } = splitLocation(loc);
            if (!level) return acc;
            if (!acc[level]) acc[level] = [];
            if (activity && !acc[level].includes(activity)) acc[level].push(activity);
            return acc;
        }, {});
    }, [locations]);

    const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    const calcHours = (inH: string, inM: string, outH: string, outM: string): string => {
        if (!inH || !outH) return '0';
        const inTime = new Date(0, 0, 0, +inH, +inM);
        const outTime = new Date(0, 0, 0, +outH, +outM);
        let diff = (outTime.getTime() - inTime.getTime()) / 3600000;
        if (diff < 0) diff += 24;
        return diff.toFixed(2);
    };

    const startEditing = (entry: any) => {
        const clockIn = entry.clock_in ? new Date(entry.clock_in) : null;
        const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;
        const locationId = entry.location?.external_id || '';
        const { level, activity } = splitLocation(locationId);

        setEditingId(entry.id);
        setEditState({
            clockInHour: clockIn ? String(clockIn.getHours()).padStart(2, '0') : '08',
            clockInMinute: clockIn ? String(clockIn.getMinutes()).padStart(2, '0') : '00',
            clockOutHour: clockOut ? String(clockOut.getHours()).padStart(2, '0') : '',
            clockOutMinute: clockOut ? String(clockOut.getMinutes()).padStart(2, '0') : '',
            level,
            activity,
            location: locationId,
            eh_kiosk_id: entry.eh_kiosk_id ? Number(entry.eh_kiosk_id) : '',
            hoursWorked: entry.hours_worked || '0',
            insulation_allowance: !!entry.insulation_allowance,
            setout_allowance: !!entry.setout_allowance,
            laser_allowance: !!entry.laser_allowance,
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditState(null);
    };

    const updateField = (field: keyof EditState, value: string | number | boolean) => {
        if (!editState) return;
        const updated = { ...editState, [field]: value };
        if (['clockInHour', 'clockInMinute', 'clockOutHour', 'clockOutMinute'].includes(field)) {
            updated.hoursWorked = calcHours(updated.clockInHour, updated.clockInMinute, updated.clockOutHour, updated.clockOutMinute);
        }
        if (field === 'eh_kiosk_id') {
            updated.level = '';
            updated.activity = '';
            updated.location = '';
        }
        setEditState(updated);
    };

    const updateNewField = (field: keyof EditState, value: string | number | boolean) => {
        if (!newEditState) return;
        const updated = { ...newEditState, [field]: value };
        if (['clockInHour', 'clockInMinute', 'clockOutHour', 'clockOutMinute'].includes(field)) {
            updated.hoursWorked = calcHours(updated.clockInHour, updated.clockInMinute, updated.clockOutHour, updated.clockOutMinute);
        }
        if (field === 'eh_kiosk_id') {
            updated.level = '';
            updated.activity = '';
            updated.location = '';
        }
        setNewEditState(updated);
    };

    const updateLocation = (level: string, activity: string) => {
        if (!editState) return;
        setEditState({ ...editState, level, activity, location: activity ? `${level}-${activity}` : level });
    };

    const updateNewLocation = (level: string, activity: string) => {
        if (!newEditState) return;
        setNewEditState({ ...newEditState, level, activity, location: activity ? `${level}-${activity}` : level });
    };

    const toggleAllowance = (type: 'insulation' | 'setout', state: EditState, setter: (s: EditState) => void) => {
        setter({
            ...state,
            insulation_allowance: type === 'insulation' ? !state.insulation_allowance : false,
            setout_allowance: type === 'setout' ? !state.setout_allowance : false,
        });
    };

    const toggleLaser = (state: EditState, setter: (s: EditState) => void) => {
        const hasLaserElsewhere = entries.some((e) => e.id !== editingId && !!e.laser_allowance);
        if (hasLaserElsewhere && !state.laser_allowance) {
            toast.warning('Laser Allowance can only be selected once.');
            return;
        }
        setter({ ...state, laser_allowance: !state.laser_allowance });
    };

    const saveEntry = (entryId: number | string) => {
        if (!editState) return;
        setProcessing(true);

        const allClocks = entries.map((entry) => {
            if (entry.id === entryId) {
                return {
                    id: entry.id,
                    clockInHour: editState.clockInHour,
                    clockInMinute: editState.clockInMinute,
                    clockOutHour: editState.clockOutHour || null,
                    clockOutMinute: editState.clockOutMinute || null,
                    location: editState.location,
                    eh_kiosk_id: editState.eh_kiosk_id,
                    hoursWorked: editState.hoursWorked,
                    insulation_allowance: editState.insulation_allowance ? '1' : '0',
                    setout_allowance: editState.setout_allowance ? '1' : '0',
                    laser_allowance: editState.laser_allowance ? '1' : '0',
                };
            }
            const ci = entry.clock_in ? new Date(entry.clock_in) : null;
            const co = entry.clock_out ? new Date(entry.clock_out) : null;
            return {
                id: entry.id,
                clockInHour: ci ? String(ci.getHours()).padStart(2, '0') : '08',
                clockInMinute: ci ? String(ci.getMinutes()).padStart(2, '0') : '00',
                clockOutHour: co ? String(co.getHours()).padStart(2, '0') : null,
                clockOutMinute: co ? String(co.getMinutes()).padStart(2, '0') : null,
                location: entry.location?.external_id || '',
                eh_kiosk_id: entry.eh_kiosk_id ?? '',
                hoursWorked: entry.hours_worked || '0',
                insulation_allowance: entry.insulation_allowance ? '1' : '0',
                setout_allowance: entry.setout_allowance ? '1' : '0',
                laser_allowance: entry.laser_allowance ? '1' : '0',
            };
        });

        router.post(
            `${route('clock.edit.summary.post')}?date=${date}`,
            { clocks: allClocks },
            {
                onSuccess: () => {
                    setProcessing(false);
                    setEditingId(null);
                    setEditState(null);
                    toast.success('Entry updated');
                },
                onError: (errors) => {
                    setProcessing(false);
                    Object.values(errors).forEach((e) => toast.error(String(e)));
                },
            },
        );
    };

    const addEntry = () => {
        const lastEntry = entries[entries.length - 1];
        const co = lastEntry?.clock_out ? new Date(lastEntry.clock_out) : null;
        setNewEditState({
            clockInHour: co ? String(co.getHours()).padStart(2, '0') : '08',
            clockInMinute: co ? String(co.getMinutes()).padStart(2, '0') : '00',
            clockOutHour: '',
            clockOutMinute: '',
            level: '',
            activity: '',
            location: '',
            eh_kiosk_id: lastEntry?.eh_kiosk_id ? Number(lastEntry.eh_kiosk_id) : '',
            hoursWorked: '0',
            insulation_allowance: false,
            setout_allowance: false,
            laser_allowance: false,
        });
    };

    const saveNewEntry = () => {
        if (!newEditState) return;
        setProcessing(true);

        const existingClocks = entries.map((entry) => {
            const ci = entry.clock_in ? new Date(entry.clock_in) : null;
            const co = entry.clock_out ? new Date(entry.clock_out) : null;
            return {
                id: entry.id,
                clockInHour: ci ? String(ci.getHours()).padStart(2, '0') : '08',
                clockInMinute: ci ? String(ci.getMinutes()).padStart(2, '0') : '00',
                clockOutHour: co ? String(co.getHours()).padStart(2, '0') : null,
                clockOutMinute: co ? String(co.getMinutes()).padStart(2, '0') : null,
                location: entry.location?.external_id || '',
                eh_kiosk_id: entry.eh_kiosk_id ?? '',
                hoursWorked: entry.hours_worked || '0',
                insulation_allowance: entry.insulation_allowance ? '1' : '0',
                setout_allowance: entry.setout_allowance ? '1' : '0',
                laser_allowance: entry.laser_allowance ? '1' : '0',
            };
        });

        const newClock = {
            id: `new-${Date.now()}`,
            clockInHour: newEditState.clockInHour,
            clockInMinute: newEditState.clockInMinute,
            clockOutHour: newEditState.clockOutHour || null,
            clockOutMinute: newEditState.clockOutMinute || null,
            location: newEditState.location,
            eh_kiosk_id: newEditState.eh_kiosk_id,
            hoursWorked: newEditState.hoursWorked,
            insulation_allowance: newEditState.insulation_allowance ? '1' : '0',
            setout_allowance: newEditState.setout_allowance ? '1' : '0',
            laser_allowance: newEditState.laser_allowance ? '1' : '0',
        };

        router.post(
            `${route('clock.edit.summary.post')}?date=${date}`,
            { clocks: [...existingClocks, newClock] },
            {
                onSuccess: () => {
                    setProcessing(false);
                    setNewEditState(null);
                    toast.success('Entry added');
                },
                onError: (errors) => {
                    setProcessing(false);
                    Object.values(errors).forEach((e) => toast.error(String(e)));
                },
            },
        );
    };

    const getKioskLocations = (kioskId: number | ''): { levels: string[]; grouped: Record<string, string[]> } => {
        if (!kioskId) return { levels: Object.keys(groupedLocations), grouped: groupedLocations };
        const kiosk = kiosks.find((k) => Number(k.eh_kiosk_id) === Number(kioskId));
        if (!kiosk?.locations?.length) return { levels: Object.keys(groupedLocations), grouped: groupedLocations };
        const filtered = kiosk.locations.reduce((acc: Record<string, string[]>, loc) => {
            const { level, activity } = splitLocation(loc);
            if (!level) return acc;
            if (!acc[level]) acc[level] = [];
            if (activity && !acc[level].includes(activity)) acc[level].push(activity);
            return acc;
        }, {});
        return { levels: Object.keys(filtered), grouped: filtered };
    };

    // ── Render helpers ──

    const renderTimeSelectors = (
        state: EditState,
        updater: (field: keyof EditState, value: string | number | boolean) => void,
        prefix: 'clockIn' | 'clockOut',
    ) => (
        <div className="flex gap-0.5">
            <Select value={state[`${prefix}Hour`]} onValueChange={(v) => updater(`${prefix}Hour`, v)}>
                <SelectTrigger className="h-7 w-[52px] px-1 text-xs"><SelectValue placeholder="HH" /></SelectTrigger>
                <SelectContent>{hours.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
            </Select>
            <span className="flex items-center text-xs">:</span>
            <Select value={state[`${prefix}Minute`]} onValueChange={(v) => updater(`${prefix}Minute`, v)}>
                <SelectTrigger className="h-7 w-[52px] px-1 text-xs"><SelectValue placeholder="MM" /></SelectTrigger>
                <SelectContent>{minutes.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
        </div>
    );

    const renderLocationSelectors = (
        state: EditState,
        locationUpdater: (level: string, activity: string) => void,
    ) => {
        const { levels: kioskLevels, grouped: kioskGrouped } = getKioskLocations(state.eh_kiosk_id);
        const activities = kioskGrouped[state.level] || [];
        return (
            <div className="flex gap-1">
                <Select value={state.level} onValueChange={(v) => locationUpdater(v, '')}>
                    <SelectTrigger className="h-7 w-[90px] px-1 text-xs"><SelectValue placeholder="Level" /></SelectTrigger>
                    <SelectContent>
                        {kioskLevels.map((l) => {
                            const d = l.includes('-') ? l.split('-').slice(1).join('-') : l.length > 7 ? l.slice(7) : l;
                            return <SelectItem key={l} value={l}>{d}</SelectItem>;
                        })}
                    </SelectContent>
                </Select>
                <Select value={state.activity} onValueChange={(v) => locationUpdater(state.level, v)} disabled={!state.level || activities.length === 0}>
                    <SelectTrigger className="hidden h-7 w-[90px] px-1 text-xs md:flex"><SelectValue placeholder={!state.level ? '-' : 'Activity'} /></SelectTrigger>
                    <SelectContent>
                        {activities.map((a) => {
                            const d = a.length > 4 ? a.slice(4) : a;
                            return <SelectItem key={a} value={a}>{d}</SelectItem>;
                        })}
                    </SelectContent>
                </Select>
            </div>
        );
    };

    const renderKioskSelector = (state: EditState, updater: (field: keyof EditState, value: string | number | boolean) => void) => (
        <Select value={state.eh_kiosk_id ? String(state.eh_kiosk_id) : ''} onValueChange={(v) => updater('eh_kiosk_id', Number(v))}>
            <SelectTrigger className="h-7 w-[120px] px-1 text-xs"><SelectValue placeholder="Kiosk" /></SelectTrigger>
            <SelectContent>
                {kiosks.map((k) => <SelectItem key={k.eh_kiosk_id} value={String(k.eh_kiosk_id)}>{k.name}</SelectItem>)}
            </SelectContent>
        </Select>
    );

    const renderAllowances = (
        state: EditState,
        setter: (s: EditState) => void,
    ) => (
        <div className="flex items-center gap-3">
            <label className="flex items-center gap-1">
                <Checkbox className="h-3.5 w-3.5" checked={state.insulation_allowance} onCheckedChange={() => toggleAllowance('insulation', state, setter)} />
                <span className="text-[10px] text-muted-foreground">Ins</span>
            </label>
            <label className="flex items-center gap-1">
                <Checkbox className="h-3.5 w-3.5" checked={state.setout_allowance} onCheckedChange={() => toggleAllowance('setout', state, setter)} />
                <span className="text-[10px] text-muted-foreground">Set</span>
            </label>
            <label className="flex items-center gap-1">
                <Checkbox className="h-3.5 w-3.5" checked={state.laser_allowance} onCheckedChange={() => toggleLaser(state, setter)} />
                <span className="text-[10px] text-muted-foreground">Las</span>
            </label>
        </div>
    );

    const renderReadOnlyAllowances = (entry: any) => {
        const tags: string[] = [];
        if (entry.insulation_allowance) tags.push('Insulation');
        if (entry.setout_allowance) tags.push('Setout');
        if (entry.laser_allowance) tags.push('Laser');
        if (tags.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
            <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">{t}</Badge>
                ))}
            </div>
        );
    };

    const renderSafety = (safetyConcern: boolean | null | undefined) => {
        if (safetyConcern === true) return <ShieldAlert className="h-4 w-4 text-red-500" />;
        if (safetyConcern === false) return <span className="text-muted-foreground text-xs">No</span>;
        return <span className="text-muted-foreground text-xs">-</span>;
    };

    // Column layout: Status | Start | End | Kiosk | Location | Hrs | Safety | Allowances | Action
    // This is 9 columns, much more balanced than 12.

    return (
        <div className="px-2 py-1.5">
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                            <th className="w-[70px] px-2 py-1.5 font-medium">Status</th>
                            <th className="w-[80px] px-2 py-1.5 font-medium">Start</th>
                            <th className="w-[80px] px-2 py-1.5 font-medium">End</th>
                            <th className="hidden w-[130px] px-2 py-1.5 font-medium md:table-cell">Kiosk</th>
                            <th className="px-2 py-1.5 font-medium">Location</th>
                            <th className="w-[50px] px-2 py-1.5 text-right font-medium">Hrs</th>
                            <th className="w-[55px] px-2 py-1.5 text-center font-medium">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="inline-flex cursor-help items-center gap-0.5">
                                                Safety <CircleHelp className="h-3 w-3" />
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[250px] text-sm">
                                            <p>Do you have any injuries or safety concerns to report from today?</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </th>
                            <th className="hidden w-[160px] px-2 py-1.5 font-medium md:table-cell">Allowances</th>
                            <th className="w-[60px] px-2 py-1.5"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {entries.map((entry, i) => {
                            const isSynced = entry.status?.toLowerCase() === 'synced';
                            const isEditing = editingId === entry.id;

                            if (isEditing && editState) {
                                return (
                                    <tr key={entry.id} className="border-b bg-blue-50/60 dark:bg-blue-950/20">
                                        <td className="px-2 py-1.5">
                                            <span className="text-blue-600">Editing</span>
                                        </td>
                                        <td className="px-2 py-1.5">{renderTimeSelectors(editState, updateField, 'clockIn')}</td>
                                        <td className="px-2 py-1.5">{renderTimeSelectors(editState, updateField, 'clockOut')}</td>
                                        <td className="hidden px-2 py-1.5 md:table-cell">{renderKioskSelector(editState, updateField)}</td>
                                        <td className="px-2 py-1.5">{renderLocationSelectors(editState, updateLocation)}</td>
                                        <td className="px-2 py-1.5 text-right">
                                            <span className="font-mono">{editState.hoursWorked}</span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">{renderSafety(entry.safety_concern)}</td>
                                        <td className="hidden px-2 py-1.5 md:table-cell">{renderAllowances(editState, (s) => setEditState(s))}</td>
                                        <td className="px-2 py-1.5">
                                            <div className="flex gap-0.5">
                                                <Button variant="ghost" size="sm" onClick={() => saveEntry(entry.id)} disabled={processing} className="h-6 w-6 p-0 text-green-600 hover:text-green-700">
                                                    {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={processing} className="h-6 w-6 p-0 hover:text-red-600">
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }

                            return (
                                <tr key={entry.id ?? i} className={cn('border-b transition-colors hover:bg-muted/30', isSynced && 'opacity-60')}>
                                    <td className="px-2 py-1.5">
                                        {entry.status === 'synced' ? (
                                            <span className="text-green-600">Synced</span>
                                        ) : entry.status ? (
                                            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{entry.status}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">Pending</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums">
                                        {new Date(entry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums">
                                        {entry.clock_out ? (
                                            new Date(entry.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                        ) : (
                                            <span className="text-yellow-600">Clocked in</span>
                                        )}
                                    </td>
                                    <td className="hidden px-2 py-1.5 md:table-cell">{entry.kiosk?.name}</td>
                                    <td className="px-2 py-1.5">{entry.location?.external_id}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{entry.hours_worked}</td>
                                    <td className="px-2 py-1.5 text-center">{renderSafety(entry.safety_concern)}</td>
                                    <td className="hidden px-2 py-1.5 md:table-cell">{renderReadOnlyAllowances(entry)}</td>
                                    <td className="px-2 py-1.5">
                                        {!isSynced && (
                                            <Button variant="ghost" size="sm" onClick={() => startEditing(entry)} className="h-6 w-6 p-0" disabled={editingId !== null}>
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {newEditState && (
                            <tr className="border-b bg-green-50/60 dark:bg-green-950/20">
                                <td className="px-2 py-1.5">
                                    <span className="text-green-600">New</span>
                                </td>
                                <td className="px-2 py-1.5">{renderTimeSelectors(newEditState, updateNewField, 'clockIn')}</td>
                                <td className="px-2 py-1.5">{renderTimeSelectors(newEditState, updateNewField, 'clockOut')}</td>
                                <td className="hidden px-2 py-1.5 md:table-cell">{renderKioskSelector(newEditState, updateNewField)}</td>
                                <td className="px-2 py-1.5">{renderLocationSelectors(newEditState, updateNewLocation)}</td>
                                <td className="px-2 py-1.5 text-right">
                                    <span className="font-mono">{newEditState.hoursWorked}</span>
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                    <span className="text-muted-foreground">-</span>
                                </td>
                                <td className="hidden px-2 py-1.5 md:table-cell">{renderAllowances(newEditState, (s) => setNewEditState(s))}</td>
                                <td className="px-2 py-1.5">
                                    <div className="flex gap-0.5">
                                        <Button variant="ghost" size="sm" onClick={saveNewEntry} disabled={processing} className="h-6 w-6 p-0 text-green-600 hover:text-green-700">
                                            {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setNewEditState(null)} disabled={processing} className="h-6 w-6 p-0 hover:text-red-600">
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {!newEditState && (
                <div className="mt-1.5">
                    <Button variant="outline" size="sm" onClick={addEntry} className="h-7 gap-1 text-xs" disabled={editingId !== null}>
                        <Plus className="h-3 w-3" />
                        Add Entry
                    </Button>
                </div>
            )}
        </div>
    );
}
