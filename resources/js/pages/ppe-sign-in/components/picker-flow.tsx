import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Search, Users } from 'lucide-react';
import PinNumpad from '@/pages/kiosks/auth/components/numpad';
import PinInputBox from '@/pages/kiosks/auth/components/pinInputBox';
import PpeForm, { type Manager, type PpeFormOptions } from './ppe-form';

export type RosterEmployee = { id: number; name: string; full_name: string };

export type PickerEndpoints = {
    verifyPin: string;
    submit: string;
};

type Props = {
    roster: RosterEmployee[];
    managers: Manager[];
    options: PpeFormOptions;
    endpoints: PickerEndpoints;
    location: { id: number; name: string } | null;
    autoReset?: boolean;
    onAllDone?: () => void;
};

type Screen = 'pin' | 'form' | 'success';

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();

function csrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}

export default function PpePickerFlow({ roster, managers, options, endpoints, location, autoReset, onAllDone }: Props) {
    const [selected, setSelected] = useState<RosterEmployee | null>(null);
    const [screen, setScreen] = useState<Screen | null>(null);
    const [verifiedPin, setVerifiedPin] = useState<string | null>(null);

    const reset = useCallback(() => {
        setSelected(null);
        setScreen(null);
        setVerifiedPin(null);
    }, []);

    useEffect(() => {
        if (autoReset && screen === 'success') {
            const t = setTimeout(() => {
                reset();
                onAllDone?.();
            }, 4500);
            return () => clearTimeout(t);
        }
    }, [autoReset, screen, reset, onAllDone]);

    const pick = (e: RosterEmployee) => {
        setSelected(e);
        setVerifiedPin(null);
        setScreen('pin');
    };

    if (selected && screen === 'pin') {
        return (
            <PinScreen
                employee={selected}
                verifyUrl={endpoints.verifyPin}
                onBack={reset}
                onVerified={(pin) => {
                    setVerifiedPin(pin);
                    setScreen('form');
                }}
            />
        );
    }

    if (selected && screen === 'form' && verifiedPin) {
        return (
            <PpeForm
                employee={selected}
                pin={verifiedPin}
                options={options}
                managers={managers}
                endpoints={{ submit: endpoints.submit }}
                onCancel={reset}
                onSuccess={() => setScreen('success')}
            />
        );
    }

    if (selected && screen === 'success') {
        return <SuccessScreen employee={selected} onDone={reset} autoReset={!!autoReset} />;
    }

    return <Picker roster={roster} location={location} onPick={pick} />;
}

function Picker({
    roster,
    location,
    onPick,
}: {
    roster: RosterEmployee[];
    location: { id: number; name: string } | null;
    onPick: (e: RosterEmployee) => void;
}) {
    const [query, setQuery] = useState('');
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter((e) => e.name.toLowerCase().includes(q) || e.full_name.toLowerCase().includes(q));
    }, [roster, query]);

    const grouped = useMemo(() => {
        const map = new Map<string, RosterEmployee[]>();
        for (const e of filtered) {
            const letter = (e.name[0] || '?').toUpperCase();
            if (!map.has(letter)) map.set(letter, []);
            map.get(letter)!.push(e);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    return (
        <div className="bg-card flex h-full flex-1 flex-col">
            <div className="shrink-0 border-b px-6 pt-8 pb-5">
                <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">PPE/RPE Register</p>
                <h1 className="text-foreground mt-1 text-2xl font-bold tracking-tight">Tap your name to start</h1>
                {location && <p className="text-muted-foreground mt-1 text-sm">{location.name}</p>}
            </div>
            <div className="shrink-0 border-b px-4 py-3">
                <div className="bg-muted/40 border-border flex items-center gap-2 rounded-xl border px-3 py-2.5">
                    <Search className="text-muted-foreground h-4 w-4" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search your name"
                        className="text-foreground placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
                    />
                </div>
                <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    <span>{filtered.length} workers</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {grouped.length === 0 ? (
                    <p className="text-muted-foreground px-6 py-12 text-center text-sm">No matches.</p>
                ) : (
                    grouped.map(([letter, items]) => (
                        <div key={letter}>
                            <div className="border-border bg-muted/60 sticky top-0 z-10 border-b border-t px-4 py-1.5 backdrop-blur">
                                <span className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">{letter}</span>
                            </div>
                            <ul className="divide-border divide-y">
                                {items.map((emp) => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onClick={() => onPick(emp)}
                                            className="hover:bg-muted/50 active:bg-muted group flex w-full items-center gap-3 px-4 py-3 text-left transition"
                                        >
                                            <span className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                                                {initials(emp.name)}
                                            </span>
                                            <span className="text-foreground flex-1 truncate text-sm font-medium">{emp.name}</span>
                                            <ChevronRight className="text-muted-foreground/50 group-hover:text-muted-foreground h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

function PinScreen({
    employee,
    verifyUrl,
    onBack,
    onVerified,
}: {
    employee: RosterEmployee;
    verifyUrl: string;
    onBack: () => void;
    onVerified: (pin: string) => void;
}) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [shake, setShake] = useState(false);
    const [verifying, setVerifying] = useState(false);

    const handle = (value: string) => {
        if (verifying) return;
        setError(null);
        if (value === 'DEL') setPin(pin.slice(0, -1));
        else if (value === 'C') setPin('');
        else if (pin.length < 4) setPin(pin + value);
    };

    useEffect(() => {
        if (pin.length === 4 && !verifying) {
            setVerifying(true);
            (async () => {
                try {
                    const res = await fetch(verifyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': csrfToken(),
                        },
                        body: JSON.stringify({ employee_id: employee.id, pin }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok || !data?.ok) {
                        setShake(true);
                        setError(data?.message || 'Incorrect PIN.');
                        setTimeout(() => {
                            setShake(false);
                            setPin('');
                        }, 350);
                    } else {
                        onVerified(pin);
                    }
                } catch {
                    setShake(true);
                    setError('Connection error. Try again.');
                    setTimeout(() => {
                        setShake(false);
                        setPin('');
                    }, 350);
                } finally {
                    setVerifying(false);
                }
            })();
        }
    }, [pin]);

    return (
        <div className="bg-card flex h-full flex-1 flex-col">
            <header className="flex items-center justify-between px-4 pt-6 pb-4">
                <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm font-medium">
                    Back
                </button>
                <div className="text-foreground text-sm font-semibold">Enter PIN</div>
                <div className="w-10" />
            </header>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-8">
                <div className="flex flex-col items-center">
                    <span className="bg-muted text-muted-foreground flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold">
                        {initials(employee.name)}
                    </span>
                    <p className="text-foreground mt-3 text-base font-medium">{employee.name}</p>
                </div>
                <div className={shake ? 'animate-[shake_0.35s]' : ''}>
                    <PinInputBox pin={pin} error={!!error} />
                </div>
                <div className="text-destructive min-h-[20px] text-center text-xs font-medium">{error}</div>
                <PinNumpad onClick={handle} disabled={verifying} />
            </div>
            <style>{`@keyframes shake {0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
        </div>
    );
}

function SuccessScreen({ employee, onDone, autoReset }: { employee: RosterEmployee; onDone: () => void; autoReset: boolean }) {
    return (
        <div className="bg-card flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-10 w-10" strokeWidth={3} />
                </div>
            </div>
            <h1 className="text-foreground mt-2 text-2xl font-semibold tracking-tight">PPE issued</h1>
            <p className="text-muted-foreground text-sm">
                Thanks, <span className="text-foreground font-medium">{employee.name}</span>. Stay safe out there.
            </p>
            {!autoReset ? (
                <button
                    onClick={onDone}
                    className="bg-foreground text-background mt-6 w-full max-w-xs rounded-xl py-3 text-sm font-semibold transition active:scale-[0.99]"
                >
                    Done
                </button>
            ) : (
                <p className="text-muted-foreground mt-4 text-xs">Returning to the roster…</p>
            )}
        </div>
    );
}
