import { Head } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Check, ChevronRight, Copy, ExternalLink, QrCode, Search, Users, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import PinNumpad from '@/pages/kiosks/auth/components/numpad';
import PinInputBox from '@/pages/kiosks/auth/components/pinInputBox';

type Employee = {
    id: number;
    name: string;
    full_name: string;
    signed_at: string | null;
};

type Talk = {
    id: string;
    token: string;
    meeting_date: string;
    meeting_date_formatted: string;
    meeting_subject: string;
    subject_label: string;
    location: { id: number; name: string } | null;
    called_by: { id: number; name: string } | null;
    general_items: string[];
    key_topics: { description: string }[];
    action_points: { description: string }[];
    injuries: { description: string }[];
    near_misses: { description: string }[];
    floor_comments: { description: string }[];
    is_locked: boolean;
};

type Props = {
    mode: 'mobile' | 'ipad';
    talk: Talk;
    roster: Employee[];
};

type Screen = 'pin' | 'content' | 'sign' | 'success';

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();

function SuperiorMark({ className }: { className?: string }) {
    return (
        <>
            <img src="/superior-group-logo.svg" alt="Superior" className={`${className ?? ''} dark:hidden`} />
            <img src="/superior-group-logo-white.svg" alt="Superior" className={`${className ?? ''} hidden dark:block`} />
        </>
    );
}

function useIsLargeScreen() {
    const [large, setLarge] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(min-width: 768px)').matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(min-width: 768px)');
        const handler = (e: MediaQueryListEvent) => setLarge(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    return large;
}

export default function ToolboxSignIn({ mode, talk, roster: initialRoster }: Props) {
    const isLarge = useIsLargeScreen();
    const isIpad = mode === 'ipad' || isLarge;

    const [screen, setScreen] = useState<Screen | null>(null);
    const [selected, setSelected] = useState<Employee | null>(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);
    const [shake, setShake] = useState(false);
    const [acknowledged, setAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [verifiedPin, setVerifiedPin] = useState<string | null>(null);
    const [roster, setRoster] = useState(initialRoster);

    const reset = useCallback(() => {
        setScreen(null);
        setSelected(null);
        setPin('');
        setPinError(null);
        setAcknowledged(false);
        setSubmitError(null);
        setVerifiedPin(null);
    }, []);

    // Auto-reset on iPad after success
    useEffect(() => {
        if (isIpad && screen === 'success') {
            const t = setTimeout(reset, 6000);
            return () => clearTimeout(t);
        }
    }, [isIpad, screen, reset]);

    const handlePick = (e: Employee) => {
        if (e.signed_at) return;
        setSelected(e);
        setPin('');
        setPinError(null);
        setAcknowledged(false);
        setSubmitError(null);
        setVerifiedPin(null);
        setScreen('pin');
    };

    const flow = selected && screen ? (
        <FlowSteps
            screen={screen}
            setScreen={setScreen}
            talk={talk}
            employee={selected}
            mode={mode}
            pin={pin}
            setPin={setPin}
            pinError={pinError}
            setPinError={setPinError}
            shake={shake}
            setShake={setShake}
            acknowledged={acknowledged}
            setAcknowledged={setAcknowledged}
            submitting={submitting}
            setSubmitting={setSubmitting}
            submitError={submitError}
            setSubmitError={setSubmitError}
            verifiedPin={verifiedPin}
            setVerifiedPin={setVerifiedPin}
            isIpad={isIpad}
            onClose={reset}
            onSigned={(employeeId) => {
                setRoster((r) => r.map((m) => (m.id === employeeId ? { ...m, signed_at: new Date().toISOString() } : m)));
                setScreen('success');
            }}
        />
    ) : null;

    if (talk.is_locked) {
        return (
            <Shell>
                <LockedScreen talk={talk} />
            </Shell>
        );
    }

    if (isLarge) {
        return (
            <>
                <Head title="Toolbox Sign-In" />
                <IpadFrame talk={talk} roster={roster} selected={selected} onPick={handlePick} flow={flow} />
            </>
        );
    }

    // Phone — linear single-screen flow
    return (
        <Shell>
            <Head title="Toolbox Sign-In" />
            {selected && screen ? (
                flow
            ) : (
                <PhonePicker talk={talk} roster={roster} onPick={handlePick} />
            )}
        </Shell>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="min-h-screen w-full bg-zinc-100 antialiased"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif' }}
        >
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-sm">
                <header className="flex h-14 shrink-0 items-center justify-center border-b border-zinc-200 bg-white">
                    <SuperiorMark className="h-7 w-auto" />
                </header>
                <div className="flex flex-1 flex-col">{children}</div>
            </div>
        </div>
    );
}

function LockedScreen({ talk }: { talk: Talk }) {
    return (
        <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
                <X className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">Sign-in closed</h1>
            <p className="text-sm text-zinc-500">
                The {talk.meeting_date_formatted} toolbox talk has been locked. Please see your supervisor.
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// iPad / Kiosk Frame — persistent top bar + sidebar with roster
// ─────────────────────────────────────────────────────────────────────
function IpadFrame({
    talk,
    roster,
    selected,
    onPick,
    flow,
}: {
    talk: Talk;
    roster: Employee[];
    selected: Employee | null;
    onPick: (e: Employee) => void;
    flow: React.ReactNode;
}) {
    return (
        <div
            className="flex h-screen flex-col bg-zinc-50 antialiased"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif' }}
        >
            <FrameTopBar talk={talk} roster={roster} />
            <div className="flex flex-1 overflow-hidden">
                <FrameSidebar roster={roster} selected={selected} onPick={onPick} />
                <main className="flex flex-1 overflow-hidden bg-white">
                    {flow ? flow : <FrameWelcome talk={talk} roster={roster} />}
                </main>
            </div>
        </div>
    );
}

function FrameTopBar({ talk, roster }: { talk: Talk; roster: Employee[] }) {
    const signed = roster.filter((r) => r.signed_at).length;
    return (
        <header className="grid h-16 w-full shrink-0 grid-cols-3 items-center border-b border-zinc-200 bg-white px-6 shadow-sm">
            <div className="justify-self-start">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Toolbox Talk</p>
                <h2 className="-mt-0.5 text-base font-semibold leading-tight text-zinc-900">
                    {talk.meeting_date_formatted}
                    {talk.location ? ` · ${talk.location.name}` : ''}
                </h2>
            </div>
            <SuperiorMark className="h-9 w-auto justify-self-center" />
            <div className="flex items-center gap-3 justify-self-end">
                <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-medium text-emerald-700">
                        {signed} of {roster.length} signed in
                    </span>
                </div>
                <ScanQrDialog talk={talk} />
            </div>
        </header>
    );
}

function ScanQrDialog({ talk }: { talk: Talk }) {
    const [open, setOpen] = useState(false);
    const url = typeof window !== 'undefined' ? `${window.location.origin}/t/${talk.token}` : '';

    const copy = () => {
        navigator.clipboard?.writeText(url);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <QrCode className="h-4 w-4" />
                    <span>Sign in on phone</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="text-center">
                    <DialogTitle className="flex items-center justify-center gap-2">
                        <QrCode className="h-5 w-5 text-primary" />
                        Scan to sign in on your phone
                    </DialogTitle>
                    <DialogDescription>
                        Open your camera, point it at the code, then continue the toolbox sign-in on your phone.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-2">
                    <div className="rounded-xl border-2 border-primary/20 bg-white p-4 shadow-lg shadow-primary/5">
                        <QRCodeSVG value={url} size={224} level="M" />
                    </div>
                    <div className="w-full space-y-3">
                        <div className="rounded-lg bg-muted/50 p-3">
                            <p className="text-center text-xs text-muted-foreground break-all">{url}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={copy}>
                                <Copy className="h-4 w-4" />
                                Copy Link
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 gap-2" asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4" />
                                    Open Link
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function FrameSidebar({
    roster,
    selected,
    onPick,
}: {
    roster: Employee[];
    selected: Employee | null;
    onPick: (e: Employee) => void;
}) {
    const [query, setQuery] = useState('');
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter((e) => e.name.toLowerCase().includes(q) || e.full_name.toLowerCase().includes(q));
    }, [roster, query]);

    const grouped = useMemo(() => {
        const map = new Map<string, Employee[]>();
        for (const e of filtered) {
            const letter = (e.name[0] || '?').toUpperCase();
            if (!map.has(letter)) map.set(letter, []);
            map.get(letter)!.push(e);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);

    return (
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-zinc-200 bg-white lg:w-96">
            <div className="border-b border-zinc-200 p-4">
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                    <Search className="h-4 w-4 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search workers"
                        className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-400"
                    />
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                    <Users className="h-3.5 w-3.5" />
                    <span>{filtered.length} workers</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {grouped.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-zinc-400">No matches.</p>
                ) : (
                    grouped.map(([letter, items]) => (
                        <div key={letter}>
                            <div className="sticky top-0 z-10 border-b border-t border-zinc-200/50 bg-zinc-50/90 px-4 py-1.5 backdrop-blur-sm">
                                <span className="text-xs font-semibold uppercase text-zinc-500">{letter}</span>
                            </div>
                            <ul className="divide-y divide-zinc-100">
                                {items.map((emp) => (
                                    <li key={emp.id} className="px-2 py-1">
                                        <button
                                            type="button"
                                            onClick={() => onPick(emp)}
                                            disabled={!!emp.signed_at}
                                            className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                                                selected?.id === emp.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100'
                                            } ${emp.signed_at ? 'opacity-60' : ''}`}
                                        >
                                            <span
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                                    selected?.id === emp.id ? 'bg-white/15 text-white' : emp.signed_at ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-200 text-zinc-700'
                                                }`}
                                            >
                                                {emp.signed_at ? <Check className="h-4 w-4" /> : initials(emp.name)}
                                            </span>
                                            <span className="flex-1 truncate text-sm font-medium">{emp.name}</span>
                                            {emp.signed_at ? (
                                                <span
                                                    className={`text-[11px] font-medium ${
                                                        selected?.id === emp.id ? 'text-white/70' : 'text-emerald-600'
                                                    }`}
                                                >
                                                    Signed
                                                </span>
                                            ) : (
                                                <ChevronRight
                                                    className={`h-4 w-4 transition ${
                                                        selected?.id === emp.id ? 'text-white' : 'text-zinc-300 group-hover:text-zinc-500'
                                                    }`}
                                                />
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}

function FrameWelcome({ talk, roster }: { talk: Talk; roster: Employee[] }) {
    const remaining = roster.filter((r) => !r.signed_at).length;
    return (
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-10">
            <div className="max-w-xl text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 text-white">
                    <Users className="h-7 w-7" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Tap your name to sign in</h1>
                <p className="mt-3 text-base text-zinc-500">
                    Select your name from the list, enter your 4-digit PIN, acknowledge the talking points and sign.
                </p>
                {remaining > 0 ? (
                    <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-700">
                        {remaining} {remaining === 1 ? 'worker' : 'workers'} still to sign
                    </p>
                ) : (
                    <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                        <Check className="h-4 w-4" /> Everyone has signed in
                    </p>
                )}
                {talk.subject_label && (
                    <p className="mt-8 text-xs uppercase tracking-wider text-zinc-400">{talk.subject_label}</p>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Phone Picker (matches Claude Design)
// ─────────────────────────────────────────────────────────────────────
function PhonePicker({ talk, roster, onPick }: { talk: Talk; roster: Employee[]; onPick: (e: Employee) => void }) {
    const [query, setQuery] = useState('');
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return roster;
        return roster.filter((e) => e.name.toLowerCase().includes(q) || e.full_name.toLowerCase().includes(q));
    }, [roster, query]);
    const grouped = useMemo(() => {
        const map = new Map<string, Employee[]>();
        for (const e of filtered) {
            const letter = (e.name[0] || '?').toUpperCase();
            if (!map.has(letter)) map.set(letter, []);
            map.get(letter)!.push(e);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [filtered]);
    const signedCount = roster.filter((r) => r.signed_at).length;

    return (
        <div className="flex h-full flex-1 flex-col">
            <div className="flex flex-col items-center px-6 pt-8 pb-4 text-center">
                <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Sign in to your toolbox talk</h1>
                <p className="mt-1 text-sm text-zinc-500">{talk.meeting_date_formatted}</p>
                {talk.location && <p className="mt-0.5 text-xs text-zinc-400">{talk.location.name}</p>}
                <p className="mt-3 text-xs font-medium text-zinc-500">
                    {signedCount} of {roster.length} signed
                </p>
            </div>
            <div className="px-4 pb-3">
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                    <Search className="h-4 w-4 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search your name"
                        className="flex-1 bg-transparent text-sm outline-none placeholder-zinc-400"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto pb-6">
                {grouped.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-zinc-400">No matches.</div>
                ) : (
                    grouped.map(([letter, items]) => (
                        <div key={letter}>
                            <div className="sticky top-0 z-10 bg-white/95 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 backdrop-blur">
                                {letter}
                            </div>
                            <ul>
                                {items.map((emp) => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onClick={() => onPick(emp)}
                                            disabled={!!emp.signed_at}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-zinc-100 disabled:opacity-50"
                                        >
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
                                                {initials(emp.name)}
                                            </span>
                                            <span className="flex-1 truncate text-sm font-medium text-zinc-900">{emp.name}</span>
                                            {emp.signed_at ? (
                                                <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                                    <Check className="h-3.5 w-3.5" />
                                                    Signed
                                                </span>
                                            ) : (
                                                <ChevronRight className="h-4 w-4 text-zinc-300" />
                                            )}
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

// ─────────────────────────────────────────────────────────────────────
// Flow Steps (PIN → Content → Sign → Success). Used both as full-screen
// (phone) and inside the dialog (iPad).
// ─────────────────────────────────────────────────────────────────────
type FlowProps = {
    screen: Screen;
    setScreen: (s: Screen) => void;
    talk: Talk;
    employee: Employee;
    mode: 'mobile' | 'ipad';
    pin: string;
    setPin: (s: string) => void;
    pinError: string | null;
    setPinError: (s: string | null) => void;
    shake: boolean;
    setShake: (b: boolean) => void;
    acknowledged: boolean;
    setAcknowledged: (b: boolean) => void;
    submitting: boolean;
    setSubmitting: (b: boolean) => void;
    submitError: string | null;
    setSubmitError: (s: string | null) => void;
    verifiedPin: string | null;
    setVerifiedPin: (s: string | null) => void;
    isIpad: boolean;
    onClose: () => void;
    onSigned: (employeeId: number) => void;
};

function FlowSteps(p: FlowProps) {
    if (p.screen === 'pin') {
        return (
            <PinScreen
                employee={p.employee}
                token={p.talk.token}
                pin={p.pin}
                setPin={p.setPin}
                pinError={p.pinError}
                setPinError={p.setPinError}
                shake={p.shake}
                setShake={p.setShake}
                onBack={p.onClose}
                onVerified={(verified) => {
                    p.setVerifiedPin(verified);
                    p.setScreen('content');
                }}
            />
        );
    }
    if (p.screen === 'content') {
        return (
            <ContentScreen
                talk={p.talk}
                acknowledged={p.acknowledged}
                setAcknowledged={p.setAcknowledged}
                onBack={() => p.setScreen('pin')}
                onContinue={() => p.setScreen('sign')}
            />
        );
    }
    if (p.screen === 'sign') {
        return (
            <SignScreen
                talk={p.talk}
                employee={p.employee}
                pin={p.verifiedPin!}
                mode={p.mode}
                submitting={p.submitting}
                setSubmitting={p.setSubmitting}
                submitError={p.submitError}
                setSubmitError={p.setSubmitError}
                onBack={() => p.setScreen('content')}
                onSigned={p.onSigned}
            />
        );
    }
    return <SuccessScreen employee={p.employee} onDone={p.onClose} autoReset={p.isIpad} />;
}

// ─────────────────────────────────────────────────────────────────────
// PIN
// ─────────────────────────────────────────────────────────────────────
function PinScreen({
    employee,
    token,
    pin,
    setPin,
    pinError,
    setPinError,
    shake,
    setShake,
    onBack,
    onVerified,
}: {
    employee: Employee;
    token: string;
    pin: string;
    setPin: (p: string) => void;
    pinError: string | null;
    setPinError: (s: string | null) => void;
    shake: boolean;
    setShake: (b: boolean) => void;
    onBack: () => void;
    onVerified: (pin: string) => void;
}) {
    const [verifying, setVerifying] = useState(false);

    const handleNumClick = (value: string) => {
        if (verifying) return;
        setPinError(null);
        if (value === 'DEL') {
            setPin(pin.slice(0, -1));
        } else if (value === 'C') {
            setPin('');
        } else if (pin.length < 4) {
            setPin(pin + value);
        }
    };

    useEffect(() => {
        if (pin.length === 4 && !verifying) {
            setVerifying(true);
            (async () => {
                try {
                    const res = await fetch(`/t/${token}/verify-pin`, {
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
                        setPinError(data?.message || 'Incorrect PIN.');
                        setTimeout(() => {
                            setShake(false);
                            setPin('');
                        }, 350);
                    } else {
                        onVerified(pin);
                    }
                } catch {
                    setShake(true);
                    setPinError('Connection error. Try again.');
                    setTimeout(() => {
                        setShake(false);
                        setPin('');
                    }, 350);
                } finally {
                    setVerifying(false);
                }
            })();
        }
    }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex h-full flex-1 flex-col">
            <header className="flex items-center justify-between px-4 pt-6 pb-4">
                <button onClick={onBack} className="text-sm font-medium text-zinc-500">
                    Back
                </button>
                <div className="text-sm font-semibold text-zinc-900">Enter PIN</div>
                <div className="w-10" />
            </header>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-8">
                <div className="flex flex-col items-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-base font-semibold text-zinc-700">
                        {initials(employee.name)}
                    </span>
                    <p className="mt-3 text-base font-medium text-zinc-900">{employee.name}</p>
                </div>
                <div className={shake ? 'animate-[shake_0.35s]' : ''}>
                    <PinInputBox pin={pin} error={!!pinError} />
                </div>
                <div className="min-h-[20px] text-center text-xs font-medium text-red-600">{pinError}</div>
                <PinNumpad onClick={handleNumClick} disabled={verifying} />
            </div>
            <style>{`@keyframes shake {0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────
type Point = { title?: string; description?: string; body?: string; correction?: string };

function ContentScreen({
    talk,
    acknowledged,
    setAcknowledged,
    onBack,
    onContinue,
}: {
    talk: Talk;
    acknowledged: boolean;
    setAcknowledged: (b: boolean) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const normalize = (items: { description?: string; title?: string; correction?: string }[] = []): Point[] =>
        items.map((it) => ({
            title: it.title || it.description || '',
            body: it.title ? it.description : undefined,
            correction: it.correction,
        }));

    const incidents = [...normalize(talk.injuries ?? []), ...normalize(talk.near_misses ?? [])];

    type Section = { id: string; label: string; points: Point[]; footnote?: string } | { id: string; label: string; empty: string };
    const sections: Section[] = [];
    sections.push({ id: 'general', label: 'General items', points: (talk.general_items ?? []).map((g) => ({ title: g })) });
    if ((talk.key_topics ?? []).length) sections.push({ id: 'topics', label: 'Key topics on site', points: normalize(talk.key_topics) });
    if ((talk.action_points ?? []).length)
        sections.push({ id: 'actions', label: 'Action points from last meeting', points: normalize(talk.action_points) });
    if (incidents.length) {
        sections.push({
            id: 'incidents',
            label: 'Injuries & near misses',
            points: incidents,
            footnote: (talk.near_misses ?? []).length === 0 ? 'No near misses reported this week.' : undefined,
        });
    } else {
        sections.push({ id: 'incidents', label: 'Injuries & near misses', empty: 'No injuries or near misses reported this week.' });
    }
    if ((talk.floor_comments ?? []).length)
        sections.push({ id: 'comments', label: 'Comments from the floor', points: normalize(talk.floor_comments) });
    else sections.push({ id: 'comments', label: 'Comments from the floor', empty: 'No comments from the floor recorded.' });

    return (
        <div className="flex h-full flex-1 flex-col">
            <div className="flex-shrink-0 border-b border-zinc-200 bg-white px-5 pt-8 pb-4">
                <div className="mb-3 flex min-h-8 items-center">
                    <button onClick={onBack} className="-ml-1 flex items-center gap-1 px-2 py-1.5 text-[15px] font-medium text-zinc-900">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M11 4l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Back
                    </button>
                </div>
                <h1 className="text-[26px] font-bold leading-tight tracking-tight text-zinc-900">Toolbox Talk</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    {talk.meeting_date_formatted}
                    {talk.location ? ` · ${talk.location.name}` : ''}
                </p>
            </div>
            <div className="flex-1 overflow-y-auto">
                {sections.map((section, sIdx) => (
                    <div key={section.id} style={{ borderTop: sIdx === 0 ? 'none' : '8px solid #f4f4f5' }}>
                        <div className="flex items-center justify-between px-5 pt-[18px] pb-2">
                            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500">{section.label}</span>
                            {'points' in section && (
                                <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-zinc-500">
                                    {section.points.length}
                                </span>
                            )}
                        </div>
                        {'points' in section ? (
                            <div className="px-5 pb-4">
                                {section.points.map((p, i) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3.5 px-1 py-3.5"
                                        style={{ borderBottom: i < section.points.length - 1 ? '1px solid #e4e4e7' : 'none' }}
                                    >
                                        <div className="mt-px flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold tabular-nums text-zinc-900">
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {p.title && (
                                                <div className="text-[15.5px] font-semibold leading-tight tracking-tight text-zinc-900">{p.title}</div>
                                            )}
                                            {p.body && <div className="mt-1.5 text-[13.5px] leading-[1.5] text-zinc-500">{p.body}</div>}
                                            {p.correction && (
                                                <div className="mt-2.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-2.5">
                                                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-zinc-500">
                                                        Corrective action
                                                    </div>
                                                    <div className="text-[13px] leading-[1.5] text-zinc-900">{p.correction}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {'footnote' in section && section.footnote && (
                                    <div className="mt-3 rounded-lg border border-dashed border-zinc-200 bg-zinc-100 px-3.5 py-2.5 text-[13px] italic text-zinc-500">
                                        {section.footnote}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="px-5 pb-[18px]">
                                <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-100 px-4 py-3.5 text-[13.5px] italic text-zinc-500">
                                    {section.empty}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                <div className="h-2" />
            </div>
            <div className="flex-shrink-0 border-t border-zinc-200 bg-white px-5 pt-3.5 pb-7">
                <button
                    type="button"
                    onClick={() => setAcknowledged(!acknowledged)}
                    className="mb-3 flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition"
                    style={{
                        background: acknowledged ? '#f4f4f5' : '#ffffff',
                        borderColor: acknowledged ? '#d4d4d8' : '#e4e4e7',
                    }}
                >
                    <div
                        className="mt-px flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md transition"
                        style={{
                            border: `1.6px solid ${acknowledged ? '#09090b' : '#d4d4d8'}`,
                            background: acknowledged ? '#09090b' : 'transparent',
                        }}
                    >
                        {acknowledged && (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M2.5 6.8l2.8 2.7L10.5 3.5" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        )}
                    </div>
                    <div className="flex-1 text-[13.5px] leading-[1.45] text-zinc-900">
                        I acknowledge &amp; understand the information provided and the requirement that I must attend the Toolbox Talk in person.
                    </div>
                </button>
                <button
                    onClick={onContinue}
                    disabled={!acknowledged}
                    className="flex w-full items-center justify-center gap-1 rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                    Continue to signature
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-1">
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Sign
// ─────────────────────────────────────────────────────────────────────
function SignScreen({
    talk,
    employee,
    pin,
    mode,
    submitting,
    setSubmitting,
    submitError,
    setSubmitError,
    onBack,
    onSigned,
}: {
    talk: Talk;
    employee: Employee;
    pin: string;
    mode: 'mobile' | 'ipad';
    submitting: boolean;
    setSubmitting: (b: boolean) => void;
    submitError: string | null;
    setSubmitError: (s: string | null) => void;
    onBack: () => void;
    onSigned: (employeeId: number) => void;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const sizeCanvas = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const rect = canvas.getBoundingClientRect();
            const data = padRef.current?.toData();
            canvas.width = rect.width * ratio;
            canvas.height = rect.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx?.scale(ratio, ratio);
            if (padRef.current && data) {
                padRef.current.clear();
                padRef.current.fromData(data);
            }
        };
        sizeCanvas();
        padRef.current = new SignaturePad(canvas, {
            penColor: 'rgb(15, 23, 42)',
            backgroundColor: 'rgb(255, 255, 255)',
        });
        const handleEnd = () => setEmpty(padRef.current?.isEmpty() ?? true);
        padRef.current.addEventListener('endStroke', handleEnd);
        const ro = new ResizeObserver(() => sizeCanvas());
        ro.observe(canvas);
        window.addEventListener('orientationchange', sizeCanvas);
        return () => {
            ro.disconnect();
            window.removeEventListener('orientationchange', sizeCanvas);
            padRef.current?.removeEventListener('endStroke', handleEnd);
            padRef.current?.off();
        };
    }, []);

    const clear = () => {
        padRef.current?.clear();
        setEmpty(true);
        setSubmitError(null);
    };

    const submit = async () => {
        if (!padRef.current || padRef.current.isEmpty()) {
            setSubmitError('Please sign before submitting.');
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        const dataUrl = padRef.current.toDataURL('image/png');
        try {
            const res = await fetch(`/t/${talk.token}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify({
                    employee_id: employee.id,
                    pin,
                    signature: dataUrl,
                    source: mode === 'ipad' ? 'ipad' : 'qr',
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                setSubmitError(data?.message || 'Could not submit. Try again.');
                return;
            }
            onSigned(employee.id);
        } catch {
            setSubmitError('Connection error. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-full flex-1 flex-col">
            <header className="flex items-center justify-between px-4 pt-6 pb-4">
                <button onClick={onBack} className="text-sm font-medium text-zinc-500">
                    Back
                </button>
                <div className="text-sm font-semibold text-zinc-900">Sign</div>
                <div className="w-10" />
            </header>
            <div className="px-5 pb-2">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Signing as</p>
                <p className="mt-0.5 text-base font-semibold text-zinc-900">{employee.name}</p>
            </div>
            <div ref={wrapRef} className="px-5 pt-2">
                <div className="aspect-[21/9] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <canvas ref={canvasRef} className="block h-full w-full touch-none" />
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-400">Sign with your finger</p>
            </div>
            <div className="min-h-[20px] px-6 pt-2 text-center text-xs font-medium text-red-600">{submitError}</div>
            <div className="mt-auto flex gap-3 px-5 pb-6 pt-3">
                <button
                    onClick={clear}
                    disabled={empty || submitting}
                    className="flex-1 rounded-xl border border-zinc-200 py-3.5 text-sm font-medium text-zinc-700 transition active:bg-zinc-50 disabled:opacity-40"
                >
                    Clear
                </button>
                <button
                    onClick={submit}
                    disabled={empty || submitting}
                    className="flex-[2] rounded-xl bg-zinc-900 py-3.5 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                    {submitting ? 'Submitting…' : 'Submit signature'}
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Success
// ─────────────────────────────────────────────────────────────────────
function SuccessScreen({ employee, onDone, autoReset }: { employee: Employee; onDone: () => void; autoReset: boolean }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
                <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-10 w-10" strokeWidth={3} />
                </div>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">You're signed in</h1>
            <p className="text-sm text-zinc-500">
                Thanks, <span className="font-medium text-zinc-700">{employee.name}</span>. Stay safe out there.
            </p>
            {!autoReset ? (
                <button
                    onClick={onDone}
                    className="mt-6 w-full max-w-xs rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
                >
                    Done
                </button>
            ) : (
                <p className="mt-4 text-xs text-zinc-400">Returning to the roster…</p>
            )}
        </div>
    );
}

function csrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}
