import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserInfo } from '@/components/user-info';
import KioskLayout, { type KioskBase } from '@/layouts/kiosk-layout';
import { Link } from '@inertiajs/react';
import { X } from 'lucide-react';
import AddManagerKioskDialog from '../edit-partials/add-manager-kiosk-dialog';

interface Manager {
    id: number;
    name: string;
    email?: string;
    avatar?: string;
}

interface Props {
    kiosk: KioskBase;
    managers: Manager[];
    users: { id: number; name: string }[];
}

export default function EditManagers({ kiosk, managers, users }: Props) {
    return (
        <KioskLayout kiosk={kiosk} activeTab="managers">
            <Card className="gap-0 pb-0">
                <CardHeader className="border-b">
                    <CardTitle>Managers</CardTitle>
                    <CardDescription>Users who can review timesheets from this kiosk.</CardDescription>
                    <CardAction>
                        <AddManagerKioskDialog
                            kiosk={{ id: kiosk.id, name: kiosk.name ?? 'Kiosk' }}
                            users={users}
                            existingManagerIds={managers.map((m) => m.id)}
                        />
                    </CardAction>
                </CardHeader>
                <CardContent className="p-0">
                    {managers.length === 0 ? (
                        <p className="text-muted-foreground p-4 text-sm">No managers assigned.</p>
                    ) : (
                        <div className="divide-y">
                            {managers.map((m) => (
                                <div key={m.id} className="flex items-center justify-between gap-2 p-3">
                                    <Link
                                        href={route('users.edit', { user: m.id })}
                                        className="flex min-w-0 flex-1 items-center gap-2 hover:underline"
                                    >
                                        <UserInfo
                                            user={{
                                                ...m,
                                                email: m.email ?? '',
                                                email_verified_at: '',
                                                created_at: '',
                                                updated_at: '',
                                                phone: '',
                                            }}
                                        />
                                    </Link>
                                    <Link
                                        href={route('users.kiosk.remove', { user: m.id, kiosk: kiosk.id })}
                                        preserveScroll
                                        title="Remove manager"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
                                    >
                                        <X className="h-4 w-4" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </KioskLayout>
    );
}
