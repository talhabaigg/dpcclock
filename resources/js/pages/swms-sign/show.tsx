import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { Head } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, FileText, RotateCcw, Search } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { useEffect, useMemo, useRef, useState } from 'react';
import PinNumpad from '@/pages/kiosks/auth/components/numpad';
import PinInputBox from '@/pages/kiosks/auth/components/pinInputBox';

interface VersionRef {
    id: string;
    version_number: string;
    swms_name: string;
    document_url: string;
}

interface EmployeeRef {
    id: number;
    name: string;
    signed: boolean;
}

interface Props {
    token: string;
    location: { id: number; name: string };
    employees: EmployeeRef[];
    versions: VersionRef[];
    expired: boolean;
    completed: boolean;
    logoUrl: string;
}

type Stage = 'pick-employee' | 'pin' | 'sign' | 'done';

function csrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
}

export default function SwmsSignShow({ token, location, employees: initialEmployees, versions, expired, completed, logoUrl }: Props) {
    const [employees, setEmployees] = useState<EmployeeRef[]>(initialEmployees);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState<string | null>(null);
    const [verifyingPin, setVerifyingPin] = useState(false);
    const [stage, setStage] = useState<Stage>('pick-employee');

    const unsignedEmployees = employees.filter((e) => !e.signed);
    const selectedEmployee = useMemo(
        () => employees.find((e) => e.id === selectedEmployeeId) ?? null,
        [selectedEmployeeId, employees],
    );

    // If there's only one unsigned worker, skip the picker step and pre-select them
    useEffect(() => {
        if (stage === 'pick-employee' && unsignedEmployees.length === 1) {
            setSelectedEmployeeId(unsignedEmployees[0].id);
            setStage('pin');
        }
    }, [stage, unsignedEmployees]);

    if (expired) {
        return <Centered logoUrl={logoUrl} title="This signing request has expired" subtitle="Ask your supervisor for a new link." />;
    }

    if (completed || unsignedEmployees.length === 0) {
        return (
            <Centered
                logoUrl={logoUrl}
                title="All done"
                subtitle={`Every worker on this request has signed for ${location.name}.`}
                icon={<CheckCircle2 className="h-12 w-12 text-green-600" />}
            />
        );
    }

    const verifyPin = async () => {
        if (!selectedEmployeeId || !pin) return;
        setVerifyingPin(true);
        setPinError(null);
        try {
            const res = await fetch(`/swms-sign/${token}/verify-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), Accept: 'application/json' },
                body: JSON.stringify({ employee_id: selectedEmployeeId, pin }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                setPinError('Incorrect PIN. Try again.');
                return;
            }
            setStage('sign');
        } catch {
            setPinError('Connection error.');
        } finally {
            setVerifyingPin(false);
        }
    };

    const handleSigned = (employeeId: number) => {
        setEmployees((prev) =>
            prev.map((e) => (e.id === employeeId ? { ...e, signed: true } : e)),
        );
        setSelectedEmployeeId(null);
        setPin('');
        setStage(unsignedEmployees.length - 1 === 0 ? 'done' : 'pick-employee');
    };

    return (
        <>
            <Head title={`Sign SWMS — ${location.name}`} />
            <div className="min-h-screen bg-slate-50">
                <div className="mx-auto max-w-2xl space-y-6 p-4">
                    <header className="flex justify-center pt-4">
                        <img src={logoUrl} alt="Company logo" className="h-14 w-auto" />
                    </header>

                    {stage === 'pick-employee' && (
                        <EmployeePicker
                            employees={unsignedEmployees}
                            onPick={(id) => {
                                setSelectedEmployeeId(id);
                                setStage('pin');
                            }}
                        />
                    )}

                    {stage === 'pin' && selectedEmployee && (
                        <PinPad
                            employeeName={selectedEmployee.name}
                            pin={pin}
                            setPin={setPin}
                            onBack={() => {
                                setStage('pick-employee');
                                setSelectedEmployeeId(null);
                                setPin('');
                                setPinError(null);
                            }}
                            onVerify={verifyPin}
                            verifying={verifyingPin}
                            error={pinError}
                        />
                    )}

                    {stage === 'sign' && selectedEmployee && (
                        <SignStage
                            token={token}
                            location={location}
                            versions={versions}
                            employeeId={selectedEmployee.id}
                            employeeName={selectedEmployee.name}
                            pin={pin}
                            onBack={() => setStage('pin')}
                            onSigned={handleSigned}
                        />
                    )}
                </div>
            </div>
        </>
    );
}

function EmployeePicker({ employees, onPick }: { employees: EmployeeRef[]; onPick: (id: number) => void }) {
    const [search, setSearch] = useState('');
    const getInitials = useInitials();
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return employees
            .filter((e) => e.name.toLowerCase().includes(q))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }, [employees, search]);

    return (
        <div>
            <h2 className="text-center text-lg font-semibold text-slate-900">Select your name</h2>
            <p className="text-muted-foreground mt-1 text-center text-sm">Tap your name to continue.</p>

            <div className="relative mt-4">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name..."
                    className="focus:border-primary focus:ring-primary/20 w-full rounded-md border bg-white py-2 pr-3 pl-9 text-base text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:outline-none"
                />
            </div>

            <ul className="mt-4 space-y-2">
                {filtered.length === 0 ? (
                    <li className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
                        No workers match &quot;{search}&quot;.
                    </li>
                ) : (
                    filtered.map((e) => (
                        <li key={e.id}>
                            <button
                                type="button"
                                onClick={() => onPick(e.id)}
                                className="flex w-full items-center gap-3 rounded-md border bg-white px-4 py-3 text-left text-base font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
                            >
                                <Avatar className="h-9 w-9 shrink-0">
                                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                                        {getInitials(e.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="flex-1">{e.name}</span>
                            </button>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );
}

function PinPad({
    employeeName,
    pin,
    setPin,
    onBack,
    onVerify,
    verifying,
    error,
}: {
    employeeName: string;
    pin: string;
    setPin: (s: string) => void;
    onBack: () => void;
    onVerify: () => void;
    verifying: boolean;
    error: string | null;
}) {
    const onKey = (k: string) => {
        if (verifying) return;
        if (k === 'DEL') {
            setPin(pin.slice(0, -1));
        } else if (k === 'C') {
            setPin('');
        } else if (pin.length < 4) {
            setPin(pin + k);
        }
    };

    // Auto-submit when 4 digits entered (matches kiosk pin behavior)
    useEffect(() => {
        if (pin.length === 4 && !verifying) {
            onVerify();
        }
         
    }, [pin]);

    return (
        <div>
            <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h2 className="mt-2 text-center text-lg font-semibold text-slate-900">Hi, {employeeName.split(' ')[0]}!</h2>
            <p className="text-muted-foreground text-center text-sm">Enter your 4-digit PIN to continue</p>

            <div className="mt-6 flex justify-center">
                <PinInputBox pin={pin} error={!!error} />
            </div>

            {error && <p className="text-destructive mt-4 text-center text-sm">{error}</p>}

            <div className="mt-6 flex justify-center [&_button]:!h-24 [&_button]:!w-24 [&_button]:!rounded-2xl [&_button]:!text-3xl sm:[&_button]:!h-28 sm:[&_button]:!w-28">
                <PinNumpad onClick={onKey} disabled={verifying} />
            </div>
        </div>
    );
}

const DECLARATION_LINES = [
    'I have personally attended the face-to-face induction.',
    'I acknowledge that I have either read the Safe Work Method Statement(s) (SWMS) or, where required, had them explained to me in a manner that I understand.',
    'I have been given the opportunity to ask questions, have had those questions answered to my satisfaction, and confirm that I understand the hazards, risks, control measures, PPE requirements and safe work procedures applicable to the work I am undertaking.',
    'I agree to follow the control measures and work methods described in this SWMS at all times.',
    'I understand that if the scope of work changes, new hazards are identified, or the SWMS is amended, I must review and comply with the updated SWMS before continuing work.',
    'I will immediately stop work and consult my supervisor if I do not understand any part of this SWMS or if I identify any hazard or risk not adequately controlled.',
    'I understand that failure to comply with this SWMS may place myself and others at risk of injury and may result in disciplinary action.',
];

function SignStage({
    token,
    location,
    versions,
    employeeId,
    employeeName,
    pin,
    onBack,
    onSigned,
}: {
    token: string;
    location: { id: number; name: string };
    versions: VersionRef[];
    employeeId: number;
    employeeName: string;
    pin: string;
    onBack: () => void;
    onSigned: (employeeId: number) => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [empty, setEmpty] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

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
        try {
            const res = await fetch(`/swms-sign/${token}/sign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    employee_id: employeeId,
                    pin,
                    signature: padRef.current.toDataURL('image/png'),
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                setSubmitError(data?.message || 'Could not submit. Try again.');
                return;
            }
            onSigned(employeeId);
        } catch {
            setSubmitError('Connection error.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline">
                <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="mt-3">
                <h2 className="text-lg font-semibold text-slate-900">{location.name}</h2>
                <ul className="mt-1 space-y-1">
                    {versions.map((v) => (
                        <li key={v.id}>
                            <a
                                href={v.document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                            >
                                <FileText className="h-4 w-4" />
                                {v.swms_name} — version {v.version_number}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>

            <p className="text-muted-foreground mt-4 text-sm">Signing as: <span className="font-medium text-slate-900">{employeeName}</span></p>

            <div className="mt-3 rounded-md border bg-slate-50 p-3">
                <h3 className="text-sm font-semibold text-slate-900">Worker Acknowledgement &amp; Sign-Off</h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs text-slate-700">
                    {DECLARATION_LINES.map((line, i) => (
                        <li key={i}>{line}</li>
                    ))}
                </ul>
            </div>

            <div className="mt-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-900">Draw signature</label>
                    <button
                        type="button"
                        onClick={clear}
                        disabled={empty || submitting}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:underline disabled:opacity-40"
                    >
                        <RotateCcw className="h-3 w-3" /> Clear
                    </button>
                </div>
                <div className="mt-1 aspect-[21/9] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
                    <canvas ref={canvasRef} className="block h-full w-full touch-none" />
                </div>
            </div>

            {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

            <div className="mt-6 flex justify-center">
                <Button
                    type="button"
                    onClick={submit}
                    disabled={empty || submitting}
                    className={cn(
                        'h-20 w-72 rounded-2xl text-lg font-bold',
                        'bg-emerald-500 text-white shadow-lg',
                        'hover:bg-emerald-600 hover:shadow-xl',
                        'active:scale-[0.98]',
                        'touch-manipulation transition-all duration-200',
                        'disabled:opacity-50',
                    )}
                >
                    {submitting ? 'Submitting...' : 'Submit'}
                </Button>
            </div>
        </div>
    );
}

function Centered({
    title,
    subtitle,
    icon,
    logoUrl,
}: {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    logoUrl?: string;
}) {
    return (
        <>
            <Head title={title} />
            <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md text-center">
                    {logoUrl && (
                        <div className="mb-6 flex justify-center">
                            <img src={logoUrl} alt="Company logo" className="h-14 w-auto" />
                        </div>
                    )}
                    {icon && <div className="mb-4 flex justify-center">{icon}</div>}
                    <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
                    {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
                </div>
            </div>
        </>
    );
}
