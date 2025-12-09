import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { AlertCircleIcon, BadgeCheckIcon, TrashIcon } from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import HourSelector from './components/hourSelector';
import KioskSelector from './components/kioskSelector';
import LocationSelector from './components/locationSelector';
import MinuteSelector from './components/minuteSelector';

type Location = {
    id: number;
    name: string;
    external_id: string;
    eh_location_id: string;
};

type Clock = {
    id: number | string;
    clock_in: string;
    clock_out: string | null;
    hours_worked: string;
    status: string;
    eh_employee_id: string | null;
    locations: Location[];
    insulation_allowance: string;
    setout_allowance: string;
    laser_allowance: string;
    kiosk: {
        id: number;
        name: string;
        location: Location;
    };
    location: Location | null;
    eh_kiosk_id: number | null;
};

type Kiosk = {
    eh_kiosk_id: number;
    name: string;
    eh_location_id: number;
    locations?: string[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Timesheets', href: '/timesheets' },
    { title: 'Edit Timesheet', href: '/timesheets/edit' },
];

export default function EditTimesheet() {
    const { clocks, flash, locations, kiosks, date } = usePage<{
        clocks: Clock[];
        kiosks: Kiosk[];
        date: string;
        flash: { success?: string; error?: string };
        locations: string[];
    }>().props;

    const splitTime = (datetime: string | null) => {
        if (!datetime) {
            return { hour: '', minute: '' };
        }
        const timePart = datetime.split(' ')[1] ?? '08:00:00';
        const [hour, minute] = timePart.split(':');
        return { hour: hour ?? '08', minute: minute ?? '00' };
    };

    const form = useForm({
        clocks: clocks.map((clock) => {
            const { hour: clockInHour, minute: clockInMinute } = splitTime(clock.clock_in);
            const { hour: clockOutHour, minute: clockOutMinute } = splitTime(clock.clock_out);
            return {
                id: clock.id,
                status: clock.status,
                clockInHour,
                clockInMinute,
                clockOutHour,
                clockOutMinute,
                location: clock.location?.external_id ?? '',
                eh_kiosk_id: clock.eh_kiosk_id ?? '',
                kioskName: clock.kiosk.name ?? '',
                hoursWorked: clock.hours_worked ?? '',
                insulation_allowance: clock.insulation_allowance,
                setout_allowance: clock.setout_allowance,
                laser_allowance: clock.laser_allowance,
            };
        }),
    });

    const addClockRow = () => {
        form.setData('clocks', [
            ...form.data.clocks,
            {
                id: uuidv4(),
                status: '',
                clockInHour: '',
                clockInMinute: '',
                clockOutHour: '',
                clockOutMinute: '',
                location: '',
                kioskName: '',
                hoursWorked: '',
                eh_kiosk_id: '',
                insulation_allowance: '0',
                setout_allowance: '0',
                laser_allowance: '0',
            },
        ]);
    };
    const updateClockField = (id: string | number, field: string, value: string) => {
        form.setData(
            'clocks',
            form.data.clocks.map((clock) => {
                if (clock.id !== id) return clock;
                const updated = { ...clock, [field]: value };

                const inTime = new Date(0, 0, 0, +updated.clockInHour, +updated.clockInMinute);
                const outTime = new Date(0, 0, 0, +updated.clockOutHour, +updated.clockOutMinute);
                let diff = (outTime.getTime() - inTime.getTime()) / 3600000;
                if (diff < 0) diff += 24;

                return { ...updated, hoursWorked: diff.toFixed(2) };
            }),
        );
    };

    const updateLocationField = (id: string | number, value: string) => {
        form.setData(
            'clocks',
            form.data.clocks.map((clock) => (clock.id === id ? { ...clock, location: value } : clock)),
        );
    };

    const updateKioskField = (id: string | number, value: string) => {
        form.setData(
            'clocks',
            form.data.clocks.map((clock) => (clock.id === id ? { ...clock, eh_kiosk_id: value } : clock)),
        );
    };
    const updateSetoutAllowance = (id: string | number, checked: boolean) => {
        form.setData(
            'clocks',
            form.data.clocks.map((clock) => {
                if (clock.id !== id) return clock;
                return {
                    ...clock,
                    setout_allowance: checked ? '1' : '0',
                    insulation_allowance: checked ? '0' : clock.insulation_allowance,
                };
            }),
        );
    };

    const updateInsulationAllowance = (id: string | number, checked: boolean) => {
        form.setData(
            'clocks',
            form.data.clocks.map((clock) => {
                if (clock.id !== id) return clock;
                return {
                    ...clock,
                    insulation_allowance: checked ? '1' : '0',
                    setout_allowance: checked ? '0' : clock.setout_allowance,
                };
            }),
        );
    };
    const isLaserAlreadySelectedElsewhere = (id: string | number) => {
        return form.data.clocks.some((clock) => clock.id !== id && clock.laser_allowance === '1');
    };
    const updateLaserAllowance = (id: string | number, checked: boolean) => {
        if (checked && isLaserAlreadySelectedElsewhere(id)) {
            alert('Laser Allowance (Frame) can only be selected once.');
            return;
        }

        form.setData(
            'clocks',
            form.data.clocks.map((clock) => (clock.id === id ? { ...clock, laser_allowance: checked ? '1' : '0' } : clock)),
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedDate = date; // or wherever you get it from

        form.post(`${route('clock.edit.summary.post')}?date=${selectedDate}`);
    };

    const sublocationsForSelectedKiosk = (kioskId: number | ''): string[] => {
        const kiosk = kiosks.find((k) => k.eh_kiosk_id === kioskId);
        return kiosk?.locations ?? [];
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Timesheet" />
            <Alert variant="default" className="m-4">
                <AlertCircleIcon />
                <AlertTitle>Heads up!</AlertTitle>
                <AlertDescription>
                    Once timesheets are synced with Employment Hero, they cannot be edited. Please login to EH to make changes or contact your payroll
                    officer for assistance.
                </AlertDescription>
            </Alert>
            {flash.success && <div className="m-2 rounded bg-green-100 p-4 text-green-800">{flash.success}</div>}
            {flash.error && <div className="mb-4 rounded bg-red-100 p-4 text-red-800">{flash.error}</div>}
            {form.errors && (
                <>
                    {Object.values(form.errors).map((error, index) => (
                        <Label className="p-1 font-bold text-red-500" key={index}>
                            Please check - {error}
                        </Label>
                    ))}
                </>
            )}

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="col-span-1 bg-gray-50 dark:bg-gray-900"></TableHead>
                        <TableHead className="col-span-1 border-r-2 bg-gray-50 dark:bg-gray-900">Status</TableHead>
                        <TableHead className="col-span-1 border-r-2 bg-gray-50 dark:bg-gray-900">Start time</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">End time</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">Location</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">Kiosk Name</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">Hours</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">SetOut Allowance</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">Insulation Allowance</TableHead>
                        <TableHead className="border-r-2 bg-gray-50 dark:bg-gray-900">Laser Allowance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {form.data.clocks.map((clock) => {
                        const isSynced = clock.status?.toLowerCase() === 'synced';
                        return (
                            <TableRow key={clock.id} className="relative">
                                {isSynced ? (
                                    <div className="absolute inset-0 z-10 cursor-not-allowed" onClick={() => toast.warning('Locked for editing.')} />
                                ) : (
                                    <div />
                                )}
                                <TableCell className="border-r-2">
                                    {clock.status ? (
                                        <Badge variant="secondary" className="bg-green-700 text-white dark:bg-green-900">
                                            <BadgeCheckIcon />
                                            {clock.status}
                                        </Badge>
                                    ) : (
                                        <Badge variant="default" className="">
                                            <BadgeCheckIcon />
                                            Pending
                                        </Badge>
                                    )}
                                </TableCell>

                                <TableCell className="border-r-2">
                                    {' '}
                                    <div className="flex w-full flex-row">
                                        <HourSelector
                                            clockInHour={clock.clockInHour}
                                            onChange={(val) => updateClockField(clock.id, 'clockInHour', val)}
                                            disabled={isSynced}
                                        />
                                        <MinuteSelector
                                            minute={clock.clockInMinute}
                                            onChange={(val) => updateClockField(clock.id, 'clockInMinute', val)}
                                            disabled={isSynced}
                                        />
                                    </div>
                                </TableCell>
                                <TableCell className="border-r-2">
                                    {' '}
                                    <div className="flex w-full flex-row">
                                        <HourSelector
                                            clockInHour={clock.clockOutHour}
                                            onChange={(val) => updateClockField(clock.id, 'clockOutHour', val)}
                                            disabled={isSynced}
                                        />
                                        <MinuteSelector
                                            minute={clock.clockOutMinute}
                                            onChange={(val) => updateClockField(clock.id, 'clockOutMinute', val)}
                                            disabled={isSynced}
                                        />
                                    </div>
                                </TableCell>

                                <TableCell className="border-r-2">
                                    {' '}
                                    <LocationSelector
                                        listLocations={sublocationsForSelectedKiosk(clock.eh_kiosk_id as number)}
                                        selectedLocation={clock.location}
                                        onChange={(val) => updateLocationField(clock.id, val)}
                                        disabled={isSynced}
                                        allLocations={locations}
                                    />
                                </TableCell>
                                <TableCell className="border-r-2">
                                    {' '}
                                    <KioskSelector
                                        kiosks={kiosks}
                                        selectedKiosk={Number(clock.eh_kiosk_id) || ''}
                                        onChange={(val) => updateKioskField(clock.id, val)}
                                        disabled={isSynced}
                                    />
                                </TableCell>
                                <TableCell>
                                    <input value={clock.hoursWorked ?? 0} disabled className="rounded-sm border border-none p-2 shadow-none" />
                                </TableCell>
                                <TableCell className="border-l-2">
                                    <Checkbox
                                        disabled={isSynced}
                                        checked={!!+clock.setout_allowance}
                                        onCheckedChange={(checked) => updateSetoutAllowance(clock.id, !!checked)}
                                    />
                                </TableCell>
                                <TableCell className="border-l-2">
                                    <Checkbox
                                        disabled={isSynced}
                                        checked={!!+clock.insulation_allowance}
                                        onCheckedChange={(checked) => updateInsulationAllowance(clock.id, !!checked)}
                                    />
                                </TableCell>
                                <TableCell className="border-l-2">
                                    <Checkbox
                                        checked={!!+clock.laser_allowance}
                                        disabled={isSynced || (isLaserAlreadySelectedElsewhere(clock.id) && clock.laser_allowance !== '1')}
                                        onCheckedChange={(checked) => updateLaserAllowance(clock.id, !!checked)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Link href={route('clocks.destroy', clock.id)} method="delete" as="button">
                                        <TrashIcon />
                                    </Link>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <div>
                <Button onClick={addClockRow} className="m-2 w-48">
                    + Add Clock Row
                </Button>
                <Button onClick={handleSubmit} className="m-2 w-48">
                    Save Changes
                </Button>
            </div>
        </AppLayout>
    );
}
