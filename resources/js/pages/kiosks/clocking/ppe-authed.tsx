import { Head, router } from '@inertiajs/react';
import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import PpeForm, { type Manager, type PpeFormOptions } from '@/pages/ppe-sign-in/components/ppe-form';
import KioskLayout from '../partials/layout';

type Props = {
    kiosk: any;
    adminMode: boolean;
    employees: Array<any>;
    guestSigners?: any[];
    hasTodayPrestart?: boolean;
    location: { id: number; name: string; external_id: string } | null;
    employee: { id: number; eh_employee_id: number | string; name: string };
    managers: Manager[];
    options: PpeFormOptions;
    endpoints: { submit: string; back: string };
};

export default function KioskPpeAuthed({
    kiosk,
    adminMode,
    employees,
    guestSigners,
    hasTodayPrestart,
    location,
    employee,
    managers,
    options,
    endpoints,
}: Props) {
    const [done, setDone] = useState(false);

    return (
        <KioskLayout
            employees={employees}
            kiosk={kiosk}
            adminMode={adminMode}
            guestSigners={guestSigners}
            hasTodayPrestart={hasTodayPrestart}
            selectedEmployee={employee}
        >
            <Head title={`Collect PPE — ${kiosk.name}`} />
            <div className="bg-card flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border shadow-sm">
                <div className="grid shrink-0 grid-cols-3 items-center gap-3 border-b px-5 py-3">
                    <button
                        onClick={() => router.visit(endpoints.back)}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 justify-self-start text-sm font-medium"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </button>
                    <div className="text-center">
                        <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">PPE/RPE Register</p>
                        <p className="-mt-0.5 text-sm font-semibold">{location?.name ?? kiosk.name}</p>
                    </div>
                    <div className="justify-self-end text-right">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Collecting as</p>
                        <p className="-mt-0.5 text-sm font-semibold">{employee.name}</p>
                    </div>
                </div>
                {done ? (
                    <Success employee={employee} onDone={() => router.visit(endpoints.back)} />
                ) : (
                    <PpeForm
                        employee={employee}
                        pin={null}
                        options={options}
                        managers={managers}
                        endpoints={{ submit: endpoints.submit }}
                        onCancel={() => router.visit(endpoints.back)}
                        onSuccess={() => setDone(true)}
                        hideHeader
                    />
                )}
            </div>
        </KioskLayout>
    );
}

function Success({ employee, onDone }: { employee: { name: string }; onDone: () => void }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-10 w-10" strokeWidth={3} />
                </div>
            </div>
            <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">PPE issued</h1>
            <p className="text-muted-foreground text-sm">
                Thanks, <span className="text-foreground font-medium">{employee.name}</span>. Stay safe out there.
            </p>
            <button
                onClick={onDone}
                className="bg-primary text-primary-foreground mt-6 w-full max-w-xs rounded-xl py-3 text-sm font-semibold transition active:scale-[0.99]"
            >
                Done
            </button>
        </div>
    );
}
