import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Settings } from 'lucide-react';
import React from 'react';

// Define the Kiosk type
interface Kiosk {
    id: number;
    name: string;
    eh_location_id: string;
    location?: {
        name?: string;
    };
    default_start_time: string;
    default_end_time: string;
    employees?:
        | {
              name: string;
          }[]
        | undefined;
}
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Kiosks', href: '/kiosks' }];

export default function KiosksList() {
    const { kiosks, flash } = usePage<{ kiosks: Kiosk[]; flash?: { success?: string } }>().props;
    const [loading, setLoading] = React.useState(false);
    const getInitials = useInitials();
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Kiosks" />

            <div className="m-2 flex items-center gap-2">
                <Link href="/kiosks/sync" method="get">
                    <Button variant="outline" className="w-32">
                        Sync Kiosk
                    </Button>
                </Link>
                <Link href="/employees/kiosks/update" method="get">
                    <Button variant="outline" className="w-full" onClick={() => setLoading(true)} disabled={loading}>
                        {loading ? 'Syncing...' : 'Sync Employees with Kiosk'}
                    </Button>
                </Link>
                {flash?.success && <div className="text-green-500">{flash.success}</div>}
            </div>
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {kiosks.map((kiosk) => (
                    <Card key={kiosk.id} className="mb-4 p-4">
                        <CardTitle>{kiosk.name}</CardTitle>

                        <CardDescription>
                            <Label
                                className="block max-w-xs truncate text-sm font-normal"
                                title={`${kiosk.eh_location_id} - ${kiosk.location?.name?.trim() || 'N/A'}`}
                            >
                                {kiosk.eh_location_id} - {kiosk.location?.name?.trim() || 'N/A'}
                            </Label>
                            <div className="mt-2 flex items-center justify-between">
                                <Label>Default Start time</Label>
                                <Label className="text-muted-foreground">
                                    {(() => {
                                        const [hour, minute] = kiosk.default_start_time.split(':');
                                        const date = new Date();
                                        date.setHours(Number(hour), Number(minute));
                                        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                                    })()}
                                </Label>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <Label>Default End time</Label>
                                <Label className="text-muted-foreground">
                                    {(() => {
                                        const [hour, minute] = kiosk.default_end_time.split(':');
                                        const date = new Date();
                                        date.setHours(Number(hour), Number(minute));
                                        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                                    })()}
                                </Label>
                            </div>
                            <div>
                                {kiosk.employees && kiosk.employees.length > 0 ? (
                                    <Label className="mt-2 flex items-center gap-2">
                                        Employees:{' '}
                                        <div className="flex -space-x-1 overflow-hidden">
                                            {kiosk.employees.slice(0, 5).map((employee, idx) => (
                                                <Avatar key={employee.name + idx} className="h-8 w-8 overflow-hidden rounded-full">
                                                    <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                                        {getInitials(employee.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                    </Label>
                                ) : (
                                    <Label className="mt-2">No employees assigned</Label>
                                )}
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                {' '}
                                <Link href={`/kiosks/${kiosk.id}`}>
                                    <Button>Open</Button>
                                </Link>
                                <Link href={`/kiosks/${kiosk.id}/edit`}>
                                    <Button variant="outline">
                                        {' '}
                                        <Settings />
                                    </Button>
                                </Link>
                            </div>
                        </CardDescription>
                    </Card>
                ))}
            </div>
        </AppLayout>
    );
}
