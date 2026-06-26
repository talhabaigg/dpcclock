import { Head, router } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import PpePickerFlow, { type RosterEmployee, type PickerEndpoints } from '@/pages/ppe-sign-in/components/picker-flow';
import type { Manager, PpeFormOptions } from '@/pages/ppe-sign-in/components/ppe-form';

type Props = {
    kiosk: { id: number; eh_kiosk_id: string; name: string };
    location: { id: number; name: string; external_id: string } | null;
    roster: RosterEmployee[];
    managers: Manager[];
    options: PpeFormOptions;
    endpoints: PickerEndpoints & { back: string };
};

export default function KioskPpe({ kiosk, location, roster, managers, options, endpoints }: Props) {
    return (
        <div
            className="bg-background flex h-screen w-full flex-col antialiased"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif' }}
        >
            <Head title={`PPE/RPE — ${kiosk.name}`} />
            <header className="bg-card flex h-14 shrink-0 items-center justify-between border-b px-5">
                <button
                    onClick={() => router.visit(endpoints.back)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-medium"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to kiosk
                </button>
                <div className="text-center">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">PPE/RPE Register</p>
                    <p className="text-foreground -mt-0.5 text-sm font-semibold">{location?.name ?? kiosk.name}</p>
                </div>
                <div className="w-32" />
            </header>
            <div className="bg-card mx-auto flex w-full max-w-4xl flex-1 overflow-hidden shadow-sm">
                <PpePickerFlow
                    roster={roster}
                    managers={managers}
                    options={options}
                    endpoints={endpoints}
                    location={location}
                    autoReset
                />
            </div>
        </div>
    );
}
