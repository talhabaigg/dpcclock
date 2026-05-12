import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, LayoutDashboard } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AvailableLocation {
    id: number;
    name: string;
    external_id: string;
}

interface Props {
    availableLocations: AvailableLocation[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Project Dashboard', href: '/project-dashboard' },
];

// Shared key — locations/dashboard.tsx writes here on mount so this selector can
// auto-redirect on subsequent visits.
export const RECENT_PROJECT_STORAGE_KEY = 'dpcclock:recent-project-location';

export default function ProjectDashboard({ availableLocations }: Props) {
    const [open, setOpen] = useState(false);
    // While checking localStorage we don't want to flash the selector
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        // Allow ?select=1 to force the picker (escape hatch if storage points
        // to a job the user no longer wants to land on).
        const params = new URLSearchParams(window.location.search);
        if (params.has('select')) {
            try {
                localStorage.removeItem(RECENT_PROJECT_STORAGE_KEY);
            } catch {
                /* localStorage may be unavailable (private mode, etc.) — fall through */
            }
            setChecking(false);
            return;
        }

        let storedId: number | null = null;
        try {
            const raw = localStorage.getItem(RECENT_PROJECT_STORAGE_KEY);
            if (raw) storedId = Number(raw);
        } catch {
            /* localStorage unavailable — show selector */
        }

        // Validate against accessible locations so a stale or revoked ID falls
        // back to the picker instead of redirecting into a 404.
        const match = storedId && availableLocations.find((l) => l.id === storedId);
        if (match) {
            router.get(`/locations/${match.id}/dashboard`, undefined, { replace: true });
            return;
        }

        setChecking(false);
    }, [availableLocations]);

    const handleLocationChange = (locationId: number) => {
        setOpen(false);
        try {
            localStorage.setItem(RECENT_PROJECT_STORAGE_KEY, String(locationId));
        } catch {
            /* ignore — non-blocking */
        }
        router.get(`/locations/${locationId}/dashboard`);
    };

    if (checking) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Project Dashboard" />
                <div className="flex flex-1 items-center justify-center p-6">
                    <p className="text-sm text-muted-foreground">Loading…</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Project Dashboard" />

            <div className="flex flex-1 items-center justify-center p-6">
                <div className="flex flex-col items-center gap-6 text-center">
                    <div className="rounded-full bg-muted p-4">
                        <LayoutDashboard className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Project Dashboard</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Please select a job to view the project dashboard
                        </p>
                    </div>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={open} className="w-[300px] justify-between">
                                Select a job...
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="center">
                            <Command>
                                <CommandInput placeholder="Search jobs..." className="h-9" />
                                <CommandList>
                                    <CommandEmpty>No jobs found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableLocations.map((loc) => (
                                            <CommandItem
                                                key={loc.id}
                                                value={`${loc.external_id} ${loc.name}`}
                                                onSelect={() => handleLocationChange(loc.id)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{loc.external_id}</span>
                                                    <span className="text-xs text-muted-foreground truncate">{loc.name}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </AppLayout>
    );
}
