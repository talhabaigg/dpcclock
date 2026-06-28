import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Building, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

const LAST_LOCATION_KEY = 'whs-deliverables.lastLocationId';

interface Location {
    id: number;
    name: string;
}

interface Props {
    locations: Location[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'WHS Deliverables', href: '/whs-deliverables' }];

export default function WhsDeliverablesSelectLocation({ locations }: Props) {
    const [didAutoRedirect, setDidAutoRedirect] = useState(false);

    useEffect(() => {
        if (didAutoRedirect) return;
        const saved = localStorage.getItem(LAST_LOCATION_KEY);
        if (saved && locations.some((l) => String(l.id) === saved)) {
            setDidAutoRedirect(true);
            router.visit(`/locations/${saved}/whs-deliverables`, { replace: true });
        }
    }, [didAutoRedirect, locations]);

    const pick = (id: number) => {
        localStorage.setItem(LAST_LOCATION_KEY, String(id));
        router.visit(`/locations/${id}/whs-deliverables`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Select project — WHS Deliverables" />
            <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Select a project</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {locations.length === 0 && (
                            <p className="text-muted-foreground text-sm">
                                You don't have access to any projects. Ask an administrator to add you to a kiosk.
                            </p>
                        )}
                        {locations.map((loc) => (
                            <Button key={loc.id} variant="outline" className="h-auto w-full justify-between px-4 py-3" onClick={() => pick(loc.id)}>
                                <span className="flex items-center gap-2 text-left">
                                    <Building className="text-muted-foreground h-4 w-4" />
                                    {loc.name}
                                </span>
                                <ChevronRight className="text-muted-foreground h-4 w-4" />
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
