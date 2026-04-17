import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import WeatherWidget from '@/components/weather-widget';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, FileText, GraduationCap, LogIn } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { useCallback, useEffect, useRef, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import KioskLayout from '../partials/layout';

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    display_name: string;
}

interface Kiosk {
    id: number;
    name: string;
    eh_kiosk_id: string;
}

interface MediaItem {
    id: number;
    file_name: string;
    original_url: string;
    collection_name: string;
}

interface TrainingItem {
    id: number;
    title: string;
    time: string | null;
    room: string | null;
    notes: string | null;
    employees: { id: number; name: string; preferred_name: string | null; display_name: string }[];
}

interface Prestart {
    id: string;
    work_date: string;
    work_date_formatted: string;
    weather: Record<string, unknown> | null;
    activities: { description: string }[] | null;
    safety_concerns: { description: string }[] | null;
    media: MediaItem[];
}

const DAILY_CHECKLIST = [
    "Today's trade specific works discussed and understood",
    'All SWMS reviewed and understood',
    'Work permits in place as required and conditions understood',
    'Tools and equipment in working order with Test & Tag up to date',
    'Required PPE available and fit for purpose',
    'Current Licences & Qualifications are relevant to work tasks',
];

export default function PrestartSign() {
    const { kiosk, employee, prestart, employees, adminMode, trainings } = usePage<{
        kiosk: Kiosk;
        employee: Employee;
        prestart: Prestart;
        employees: Employee[];
        adminMode: boolean;
        trainings: TrainingItem[];
    }>().props;

    const getInitials = useInitials();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [showProcessing, setShowProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [sigError, setSigError] = useState('');

    // Track acceptance of each activity and safety concern
    const activityCount = prestart.activities?.length ?? 0;
    const safetyConcernCount = prestart.safety_concerns?.length ?? 0;
    const totalItems = activityCount + safetyConcernCount;

    const [acceptedActivities, setAcceptedActivities] = useState<boolean[]>(new Array(activityCount).fill(false));
    const [acceptedConcerns, setAcceptedConcerns] = useState<boolean[]>(new Array(safetyConcernCount).fill(false));
    const [checklistAcknowledged, setChecklistAcknowledged] = useState(false);

    const allAccepted =
        checklistAcknowledged &&
        (totalItems === 0 || (acceptedActivities.every(Boolean) && acceptedConcerns.every(Boolean)));

    const toggleActivity = (i: number) => {
        setAcceptedActivities((prev) => {
            const next = [...prev];
            next[i] = !next[i];
            return next;
        });
    };

    const toggleConcern = (i: number) => {
        setAcceptedConcerns((prev) => {
            const next = [...prev];
            next[i] = !next[i];
            return next;
        });
    };


    const initPad = useCallback(() => {
        if (!canvasRef.current || padRef.current) return;
        const canvas = canvasRef.current;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        padRef.current = new SignaturePad(canvas, {
            penColor: 'rgb(0, 0, 0)',
            backgroundColor: 'rgb(255, 255, 255)',
        });
    }, []);

    useEffect(() => {
        const timer = setTimeout(initPad, 100);
        return () => clearTimeout(timer);
    }, [initPad]);

    const clearSignature = () => {
        padRef.current?.clear();
        setSigError('');
    };

    const handleSignAndClockIn = () => {
        if (!allAccepted) {
            setSigError('Please accept all activities and safety concerns before signing.');
            return;
        }
        if (!padRef.current || padRef.current.isEmpty()) {
            setSigError('Please sign before clocking in.');
            return;
        }
        setSigError('');
        setShowProcessing(true);

        const signatureData = padRef.current.toDataURL('image/png');

        router.post(
            route('kiosk.prestart.sign', { kioskId: kiosk.eh_kiosk_id, employeeId: employee.id }),
            {
                prestart_id: prestart.id,
                signature: signatureData,
            },
            {
                onSuccess: () => {
                    setSuccess(true);
                    setShowProcessing(false);
                },
                onError: () => {
                    setShowProcessing(false);
                },
            },
        );
    };

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const activityFiles = prestart.media?.filter((m) => m.collection_name === 'activity_files') ?? [];
    const safetyConcernFiles = prestart.media?.filter((m) => m.collection_name === 'safety_concern_files') ?? [];

    const content = (
        <div className="relative flex h-full w-full flex-col items-center overflow-y-auto px-4 py-6">
            {/* Processing Dialog */}
            <KioskDialogBox isOpen={showProcessing} onClose={() => {}} title="Signing & Clocking In" description="Please wait..." variant="loading" />

            {/* Success Dialog */}
            <KioskDialogBox
                isOpen={success}
                onClose={() => {
                    window.location.href = route('kiosks.show', { kiosk: kiosk.id });
                }}
                title="Signed & Clocked In"
                description="Your prestart signature and clock in have been recorded."
                variant="success"
            />

            {/* Back Button */}
            <div className="absolute top-4 left-4">
                <Link href={route('kiosks.show', { kiosk: kiosk.id })}>
                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-accent touch-manipulation">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <div className="w-full max-w-2xl space-y-4 pt-12">
                {/* Employee Header */}
                <div className="flex flex-col items-center">
                    <Avatar className="border-primary/20 mb-2 h-16 w-16 border-4 shadow-lg">
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                            {getInitials(employee.display_name)}
                        </AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-bold">{employee.display_name}</h2>
                    <div className="mt-1 flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1 text-blue-600">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">Daily Prestart - {prestart.work_date_formatted}</span>
                    </div>
                </div>

                {/* Prestart Content */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Prestart Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <WeatherWidget weather={prestart.weather as any} />

                        {prestart.activities && prestart.activities.length > 0 && (
                            <div>
                                <p className="mb-2 font-medium text-muted-foreground">Activities:</p>
                                <div className="space-y-2">
                                    {prestart.activities.map((a, i) => (
                                        <label key={i} className={cn('flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors touch-manipulation', acceptedActivities[i] ? 'border-emerald-300 bg-emerald-50' : 'border-border')}>
                                            <Checkbox checked={acceptedActivities[i]} onCheckedChange={() => toggleActivity(i)} className="mt-0.5 h-5 w-5" />
                                            <span className={cn('flex-1', acceptedActivities[i] && 'text-emerald-800')}>{a.description}</span>
                                        </label>
                                    ))}
                                </div>
                                {activityFiles.length > 0 && (
                                    <div className="mt-2 space-y-0.5 pl-8">
                                        {activityFiles.map((f) => (
                                            <a key={f.id} href={f.original_url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline">
                                                {f.file_name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                    </CardContent>
                </Card>

                {/* Training Booked */}
                {trainings && trainings.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <GraduationCap className="h-4 w-4" />
                                Training Booked
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            {trainings.map((t) => (
                                <div key={t.id} className="rounded-lg border bg-blue-50/50 p-3 dark:bg-blue-950/20">
                                    <p className="font-medium">
                                        {t.title}
                                        {t.time && <span className="text-muted-foreground"> at {t.time}</span>}
                                    </p>
                                    {t.room && <p className="text-xs text-muted-foreground">{t.room}</p>}
                                    {t.employees.length > 0 && (
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {t.employees.map((e) => e.display_name || e.preferred_name || e.name).join(', ')}
                                        </p>
                                    )}
                                    {t.notes && <p className="mt-1 text-xs italic text-muted-foreground">{t.notes}</p>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Daily Checklist */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Daily Checklist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {DAILY_CHECKLIST.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                        <label className={cn('flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors touch-manipulation', checklistAcknowledged ? 'border-emerald-300 bg-emerald-50' : 'border-border')}>
                            <Checkbox checked={checklistAcknowledged} onCheckedChange={() => setChecklistAcknowledged((prev) => !prev)} className="mt-0.5 h-5 w-5" />
                            <span className={cn('flex-1 font-medium', checklistAcknowledged && 'text-emerald-800')}>I acknowledge and confirm all of the above</span>
                        </label>
                    </CardContent>
                </Card>

                {/* Safety Concerns */}
                {prestart.safety_concerns && prestart.safety_concerns.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Safety Concerns</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {prestart.safety_concerns.map((s, i) => (
                                    <label key={i} className={cn('flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors touch-manipulation', acceptedConcerns[i] ? 'border-emerald-300 bg-emerald-50' : 'border-border')}>
                                        <Checkbox checked={acceptedConcerns[i]} onCheckedChange={() => toggleConcern(i)} className="mt-0.5 h-5 w-5" />
                                        <span className={cn('flex-1', acceptedConcerns[i] && 'text-emerald-800')}>{s.description}</span>
                                    </label>
                                ))}
                            </div>
                            {safetyConcernFiles.length > 0 && (
                                <div className="mt-2 space-y-0.5 pl-8">
                                    {safetyConcernFiles.map((f) => (
                                        <a key={f.id} href={f.original_url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline">
                                            {f.file_name}
                                        </a>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Signature Pad */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Sign Below</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            By signing, you confirm you have read and understood today's prestart.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border bg-white">
                            <canvas ref={canvasRef} className="h-40 w-full cursor-crosshair touch-none" />
                        </div>
                        {sigError && <p className="mt-1 text-sm text-destructive">{sigError}</p>}
                        <div className="mt-2 flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Sign & Clock In Button */}
                <div className="flex flex-col items-center gap-3 pb-6">
                    {!allAccepted && (
                        <p className="text-sm text-muted-foreground">Accept all items above to enable signing</p>
                    )}
                    <Button
                        onClick={handleSignAndClockIn}
                        disabled={showProcessing || !allAccepted}
                        className={cn(
                            'h-16 w-64 gap-3 rounded-2xl text-lg font-bold',
                            'bg-emerald-500 text-white shadow-lg',
                            'hover:bg-emerald-600 hover:shadow-xl',
                            'active:scale-[0.98]',
                            'touch-manipulation transition-all duration-200',
                        )}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                            <LogIn className="h-4 w-4" />
                        </div>
                        Sign & Clock In
                    </Button>
                </div>
            </div>
        </div>
    );

    return isMobile ? (
        <div className="bg-background min-h-screen">
            <Head title="Prestart Sign" />
            {content}
        </div>
    ) : (
        <KioskLayout employees={employees ?? []} kiosk={kiosk} selectedEmployee={employee} adminMode={adminMode}>
            <Head title="Prestart Sign" />
            {content}
        </KioskLayout>
    );
}
