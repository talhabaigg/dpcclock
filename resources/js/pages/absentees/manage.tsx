import { SuccessAlertFlash } from '@/components/alert-flash';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

interface Location {
    id: number;
    name: string;
}

interface Absentee {
    id: number | null;
    employee_id: number;
    employee_name: string;
    reason: string | null;
    notes: string | null;
}

interface Prestart {
    id: string;
    work_date: string;
    work_date_formatted: string;
    location: Location | null;
}

interface Props {
    absentees: Absentee[];
    prestart: Prestart;
    reasonOptions: Record<string, string>;
}

export default function ManageAbsentees({ absentees, prestart, reasonOptions }: Props) {
    const { flash } = usePage<{ flash: { success?: string } }>().props as { flash: { success?: string } };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Absentees', href: `/absent?project_id=${prestart.location?.id}&work_day=${prestart.work_date}` },
        { title: 'Manage', href: '#' },
    ];

    const [localData, setLocalData] = useState<Record<number, { reason: string; notes: string }>>(() => {
        const initial: Record<number, { reason: string; notes: string }> = {};
        absentees.forEach((a) => {
            initial[a.employee_id] = { reason: a.reason ?? '', notes: a.notes ?? '' };
        });
        return initial;
    });

    const [saving, setSaving] = useState(false);

    const updateLocal = (employeeId: number, field: 'reason' | 'notes', value: string) => {
        setLocalData((prev) => ({
            ...prev,
            [employeeId]: { ...prev[employeeId], [field]: value },
        }));
    };

    const saveAll = () => {
        setSaving(true);
        const payload = absentees.map((a) => ({
            employee_id: a.employee_id,
            reason: localData[a.employee_id]?.reason || null,
            notes: localData[a.employee_id]?.notes || null,
        }));

        router.post(
            '/absent',
            { daily_prestart_id: prestart.id, absentees: payload },
            {
                preserveScroll: true,
                onFinish: () => setSaving(false),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Manage Absentees" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Manage Absentees</h1>
                        <p className="text-sm text-muted-foreground">
                            {prestart.location?.name} — {prestart.work_date_formatted} — {absentees.length} absentee{absentees.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Button variant="outline" asChild>
                        <Link href={`/absent?project_id=${prestart.location?.id}&work_day=${prestart.work_date}`}>Back</Link>
                    </Button>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Name</TableHead>
                                <TableHead className="w-[200px]">Reason</TableHead>
                                <TableHead>Notes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {absentees.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                                        No absentees — all employees have signed the prestart.
                                    </TableCell>
                                </TableRow>
                            )}
                            {absentees.map((a) => {
                                const local = localData[a.employee_id] ?? { reason: '', notes: '' };

                                return (
                                    <TableRow key={a.employee_id}>
                                        <TableCell className="font-medium">{a.employee_name}</TableCell>
                                        <TableCell>
                                            <Select
                                                value={local.reason || 'none'}
                                                onValueChange={(val) => updateLocal(a.employee_id, 'reason', val === 'none' ? '' : val)}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select reason" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">Select reason</SelectItem>
                                                    {Object.entries(reasonOptions).map(([key, label]) => (
                                                        <SelectItem key={key} value={key}>
                                                            {label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={local.notes}
                                                onChange={(e) => updateLocal(a.employee_id, 'notes', e.target.value)}
                                                placeholder="Add notes..."
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {absentees.length > 0 && (
                    <div className="flex justify-end">
                        <Button onClick={saveAll} disabled={saving}>
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
