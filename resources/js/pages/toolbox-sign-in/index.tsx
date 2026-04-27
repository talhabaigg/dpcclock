import { Head } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Check, ChevronRight, Delete, Search, X } from 'lucide-react';

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

type Screen = 'picker' | 'pin' | 'content' | 'sign' | 'success';

const initials = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0])
        .join('')
        .toUpperCase();

export default function ToolboxSignIn({ mode, talk, roster: initialRoster }: Props) {
    const isIpad = mode === 'ipad';
    const [screen, setScreen] = useState<Screen>('picker');
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
        setScreen('picker');
        setSelected(null);
        setPin('');
        setPinError(null);
        setAcknowledged(false);
        setSubmitError(null);
        setVerifiedPin(null);
    }, []);

    // Auto-reset on iPad after success (kiosk-style)
    useEffect(() => {
        if (isIpad && screen === 'success') {
            const t = setTimeout(reset, 6000);
            return () => clearTimeout(t);
        }
    }, [isIpad, screen, reset]);

    return (
        <div
            className="min-h-screen w-full bg-white antialiased"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", system-ui, sans-serif' }}
        >
            <Head title="Toolbox Sign-In" />
            <div className="flex min-h-screen w-full flex-col bg-white">
                {talk.is_locked ? (
                    <LockedScreen talk={talk} />
                ) : screen === 'picker' ? (
                    <PickerScreen
                        talk={talk}
                        roster={roster}
                        onPick={(e) => {
                            setSelected(e);
                            setPin('');
                            setPinError(null);
                            setScreen('pin');
                        }}
                    />
                ) : screen === 'pin' ? (
                    <PinScreen
                        employee={selected!}
                        token={talk.token}
                        pin={pin}
                        setPin={setPin}
                        pinError={pinError}
                        setPinError={setPinError}
                        shake={shake}
                        setShake={setShake}
                        onBack={() => {
                            setSelected(null);
                            setPin('');
                            setPinError(null);
                            setScreen('picker');
                        }}
                        onVerified={(p) => {
                            setVerifiedPin(p);
                            setScreen('content');
                        }}
                    />
                ) : screen === 'content' ? (
                    <ContentScreen
                        talk={talk}
                        acknowledged={acknowledged}
                        setAcknowledged={setAcknowledged}
                        onBack={() => setScreen('pin')}
                        onContinue={() => setScreen('sign')}
                    />
                ) : screen === 'sign' ? (
                    <SignScreen
                        talk={talk}
                        employee={selected!}
                        pin={verifiedPin!}
                        mode={mode}
                        submitting={submitting}
                        setSubmitting={setSubmitting}
                        submitError={submitError}
                        setSubmitError={setSubmitError}
                        onBack={() => setScreen('content')}
                        onSigned={(employeeId) => {
                            setRoster((r) =>
                                r.map((m) => (m.id === employeeId ? { ...m, signed_at: new Date().toISOString() } : m)),
                            );
                            setScreen('success');
                        }}
                    />
                ) : (
                    <SuccessScreen
                        employee={selected!}
                        onDone={reset}
                        autoReset={isIpad}
                    />
                )}
            </div>
        </div>
    );
}

function LockedScreen({ talk }: { talk: Talk }) {
    return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
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

function PickerScreen({ talk, roster, onPick }: { talk: Talk; roster: Employee[]; onPick: (e: Employee) => void }) {
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
            <div className="flex flex-col items-center px-6 pt-10 pb-4 text-center">
                <img src="/logo.svg" alt="Superior" className="h-10 w-auto sm:h-12" />
                <h1 className="mt-5 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Sign in to your toolbox talk</h1>
                <p className="mt-1 text-sm text-zinc-500">{talk.meeting_date_formatted}</p>
                {talk.location && <p className="mt-0.5 text-xs text-zinc-400">{talk.location.name}</p>}
                <p className="mt-3 text-xs font-medium text-zinc-500">
                    {signedCount} of {roster.length} signed
                </p>
            </div>

            <div className="mx-auto w-full max-w-3xl px-4 pb-3">
                <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                    <Search className="h-4 w-4 text-zinc-400" />
                    <input
                        autoFocus={false}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search your name"
                        className="flex-1 bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
                {grouped.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-zinc-400">No matches.</div>
                ) : (
                    grouped.map(([letter, items]) => (
                        <div key={letter} className="mx-auto w-full max-w-6xl">
                            <div className="sticky top-0 z-10 bg-white/95 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 backdrop-blur sm:px-6">
                                {letter}
                            </div>
                            <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {items.map((emp) => (
                                    <li key={emp.id}>
                                        <button
                                            type="button"
                                            onClick={() => onPick(emp)}
                                            disabled={!!emp.signed_at}
                                            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 sm:px-3"
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

    const tap = (digit: string) => {
        if (verifying || pin.length >= 4) return;
        setPinError(null);
        setPin(pin + digit);
    };
    const back = () => {
        if (verifying) return;
        setPinError(null);
        setPin(pin.slice(0, -1));
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

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    return (
        <div className="mx-auto flex h-full w-full max-w-md flex-1 flex-col">
            <header className="flex items-center justify-between px-4 pt-6 pb-4">
                <button onClick={onBack} className="text-sm font-medium text-zinc-500">
                    Back
                </button>
                <div className="text-sm font-semibold text-zinc-900">Enter PIN</div>
                <div className="w-10" />
            </header>
            <div className="flex flex-col items-center px-6 pt-2 pb-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-base font-semibold text-zinc-700">
                    {initials(employee.name)}
                </span>
                <p className="mt-3 text-base font-medium text-zinc-900">{employee.name}</p>
            </div>
            <div className={`flex justify-center gap-3 px-6 pb-2 ${shake ? 'animate-[shake_0.35s]' : ''}`}>
                {[0, 1, 2, 3].map((i) => (
                    <span
                        key={i}
                        className={`h-3.5 w-3.5 rounded-full transition ${
                            pin.length > i ? 'bg-zinc-900' : 'bg-zinc-200'
                        } ${pinError ? 'bg-red-500' : ''}`}
                    />
                ))}
            </div>
            <div className="min-h-[20px] px-6 pt-2 text-center text-xs font-medium text-red-600">{pinError}</div>

            <div className="mt-auto px-6 pb-8">
                <div className="grid grid-cols-3 gap-3">
                    {keys.map((k) => (
                        <button
                            key={k}
                            onClick={() => tap(k)}
                            className="rounded-2xl bg-zinc-100 py-5 text-2xl font-medium text-zinc-900 transition active:bg-zinc-200"
                        >
                            {k}
                        </button>
                    ))}
                    <div />
                    <button
                        onClick={() => tap('0')}
                        className="rounded-2xl bg-zinc-100 py-5 text-2xl font-medium text-zinc-900 transition active:bg-zinc-200"
                    >
                        0
                    </button>
                    <button
                        onClick={back}
                        className="flex items-center justify-center rounded-2xl py-5 text-zinc-500 transition active:bg-zinc-100"
                    >
                        <Delete className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <style>{`@keyframes shake {0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
        </div>
    );
}

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

    type Section =
        | { id: string; label: string; points: Point[]; footnote?: string }
        | { id: string; label: string; empty: string };

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
        <div className="mx-auto flex h-full w-full max-w-3xl flex-1 flex-col">
            {/* Big header (matches design's ScreenHeader) */}
            <div className="flex-shrink-0 border-b border-zinc-200 bg-white px-5 pt-8 pb-4">
                <div className="mb-3 flex min-h-8 items-center">
                    <button
                        onClick={onBack}
                        className="-ml-1 flex items-center gap-1 px-2 py-1.5 text-[15px] font-medium text-zinc-900"
                    >
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
                    {talk.called_by ? ` · ${talk.called_by.name}` : ''}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto">
                {sections.map((section, sIdx) => (
                    <div key={section.id} style={{ borderTop: sIdx === 0 ? 'none' : '8px solid #f4f4f5' }}>
                        {/* Section eyebrow */}
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
                                        style={{
                                            borderBottom: i < section.points.length - 1 ? '1px solid #e4e4e7' : 'none',
                                        }}
                                    >
                                        <div className="mt-px flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-bold tabular-nums text-zinc-900">
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {p.title && (
                                                <div className="text-[15.5px] font-semibold leading-tight tracking-tight text-zinc-900">
                                                    {p.title}
                                                </div>
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

            {/* Acknowledgment footer */}
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
                        I acknowledge &amp; understand the information provided and the requirement that I must attend the Toolbox Talk in
                        person.
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
        <div className="mx-auto flex h-full w-full max-w-2xl flex-1 flex-col">
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
                <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
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

function SuccessScreen({ employee, onDone, autoReset }: { employee: Employee; onDone: () => void; autoReset: boolean }) {
    return (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
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
