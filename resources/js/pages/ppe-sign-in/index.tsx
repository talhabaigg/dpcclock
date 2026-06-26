import { Head } from '@inertiajs/react';
import PpePickerFlow, { type RosterEmployee, type PickerEndpoints } from './components/picker-flow';
import type { Manager, PpeFormOptions } from './components/ppe-form';

type Props = {
    mode: 'qr';
    location: { id: number; name: string; external_id: string } | null;
    roster: RosterEmployee[];
    managers: Manager[];
    options: PpeFormOptions;
    endpoints: PickerEndpoints;
};

function SuperiorMark({ className }: { className?: string }) {
    return (
        <>
            <img src="/superior-group-logo.svg" alt="Superior" className={`${className ?? ''} dark:hidden`} />
            <img src="/superior-group-logo-white.svg" alt="Superior" className={`${className ?? ''} hidden dark:block`} />
        </>
    );
}

export default function PpeSignIn({ location, roster, managers, options, endpoints }: Props) {
    return (
        <div
            className="bg-background flex h-screen w-full flex-col antialiased"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif' }}
        >
            <Head title="PPE/RPE Register" />
            <header className="bg-card flex h-14 shrink-0 items-center justify-between border-b px-5">
                <div>
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">PPE/RPE Register</p>
                    {location && <p className="text-foreground -mt-0.5 text-sm font-semibold">{location.name}</p>}
                </div>
                <SuperiorMark className="h-7 w-auto" />
            </header>
            <div className="bg-card mx-auto flex w-full max-w-3xl flex-1 overflow-hidden shadow-sm">
                <PpePickerFlow
                    roster={roster}
                    managers={managers}
                    options={options}
                    endpoints={endpoints}
                    location={location}
                    autoReset={false}
                />
            </div>
        </div>
    );
}
