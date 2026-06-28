import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import WeatherWidget from '@/components/weather-widget';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Clock, FileText, GraduationCap, LogIn, MapPin, Users } from 'lucide-react';
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

interface GuestSigner {
    id: number;
    guest_name: string;
    guest_company: string;
    signed_at: string;
    signed_at_formatted: string;
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
    "Today's site works (builders prestart) discussed and understood",
    'All SWMS reviewed and understood',
    'Work permits in place as required and conditions understood',
    'Tools and equipment in working order with Test & Tag up to date',
    'Required PPE available and fit for purpose',
    'Current Licences & Qualifications are relevant to work tasks',
];

export default function PrestartSign() {
    const { kiosk, employee, prestart, employees, adminMode, trainings, guestSigners, hasTodayPrestart } = usePage<{
        kiosk: Kiosk;
        employee: Employee;
        prestart: Prestart;
        employees: Employee[];
        adminMode: boolean;
        trainings: TrainingItem[];
        guestSigners?: GuestSigner[];
        hasTodayPrestart?: boolean;
    }>().props;

    const getInitials = useInitials();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [showProcessing, setShowProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [sigError, setSigError] = useState('');

    const [allAcknowledged, setAllAcknowledged] = useState(false);
    const allAccepted = allAcknowledged;


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
                <Button asChild variant="outline" size="lg" className="touch-manipulation gap-2 rounded-full shadow-sm">
                    <Link href={route('kiosks.show', { kiosk: kiosk.id })}>
                        <ArrowLeft className="h-5 w-5" />
                        Back
                    </Link>
                </Button>
            </div>

            <div className="w-full max-w-2xl space-y-4 pt-14">
                {/* Employee Header */}
                <div className="flex flex-col items-center text-center">
                    <Avatar className="border-border mb-3 h-16 w-16 border shadow-sm">
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">{getInitials(employee.display_name)}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-xl font-bold">{employee.display_name}</h2>
                    <Badge variant="secondary" className="mt-2 gap-1.5 font-medium">
                        <FileText className="h-3.5 w-3.5" />
                        Daily Prestart · {prestart.work_date_formatted}
                    </Badge>
                </div>

                {/* Prestart Content */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Prestart Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 text-sm">
                        <WeatherWidget weather={prestart.weather as any} workDate={prestart.work_date} dense />

                        {prestart.activities && prestart.activities.length > 0 && (
                            <div>
                                <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">Activities</p>
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                    {prestart.activities.map((a, i) => (
                                        <li key={i}>{a.description}</li>
                                    ))}
                                </ul>
                                {activityFiles.length > 0 && (
                                    <div className="mt-1.5 space-y-0.5 pl-5">
                                        {activityFiles.map((f) => (
                                            <a key={f.id} href={f.original_url} target="_blank" rel="noreferrer" className="text-primary block text-xs hover:underline">
                                                {f.file_name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {prestart.safety_concerns && prestart.safety_concerns.length > 0 && (
                            <div>
                                <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">Safety Concerns</p>
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                    {prestart.safety_concerns.map((s, i) => (
                                        <li key={i}>{s.description}</li>
                                    ))}
                                </ul>
                                {safetyConcernFiles.length > 0 && (
                                    <div className="mt-1.5 space-y-0.5 pl-5">
                                        {safetyConcernFiles.map((f) => (
                                            <a key={f.id} href={f.original_url} target="_blank" rel="noreferrer" className="text-primary block text-xs hover:underline">
                                                {f.file_name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">Daily Checklist</p>
                            <ul className="text-muted-foreground list-disc space-y-1 pl-5">
                                {DAILY_CHECKLIST.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </div>

                        {trainings && trainings.length > 0 && (
                            <div>
                                <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                                    <GraduationCap className="h-3.5 w-3.5" />
                                    Booked Training
                                </p>
                                <div className="space-y-2">
                                    {trainings.map((t) => (
                                        <div key={t.id} className="bg-muted/40 overflow-hidden rounded-lg border">
                                            <div className="flex items-start gap-3 p-3">
                                                <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                                                    <GraduationCap className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold leading-tight">{t.title}</p>
                                                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                        {t.time && (
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                {t.time}
                                                            </span>
                                                        )}
                                                        {t.room && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="h-3 w-3" />
                                                                {t.room}
                                                            </span>
                                                        )}
                                                        {t.employees.length > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <Users className="h-3 w-3" />
                                                                {t.employees.length} attending
                                                            </span>
                                                        )}
                                                    </div>
                                                    {t.employees.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {t.employees.map((e) => (
                                                                <span key={e.id} className="bg-background text-foreground rounded-full border px-2 py-0.5 text-xs">
                                                                    {e.display_name || e.preferred_name || e.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {t.notes && <p className="text-muted-foreground mt-2 border-t pt-2 text-xs italic">{t.notes}</p>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <label
                            className={cn(
                                'flex cursor-pointer touch-manipulation items-start gap-3 rounded-lg border p-3 transition-colors',
                                allAcknowledged ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-accent',
                            )}
                        >
                            <Checkbox checked={allAcknowledged} onCheckedChange={() => setAllAcknowledged((prev) => !prev)} className="mt-0.5 h-5 w-5" />
                            <span className="text-foreground flex-1 font-medium">I acknowledge and confirm all of the above activities, safety concerns, and checklist items</span>
                        </label>
                    </CardContent>
                </Card>

                {/* Signature Pad */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Sign Below</CardTitle>
                        <p className="text-muted-foreground text-xs">
                            By signing, you confirm you have read and understood today's prestart and that you are required to attend the prestart meeting in person.
                        </p>
                    </CardHeader>
                    <CardContent>
                        {/* Canvas stays white so the captured signature image is legible */}
                        <div className="overflow-hidden rounded-md border bg-white">
                            <canvas ref={canvasRef} className="h-40 w-full cursor-crosshair touch-none" />
                        </div>
                        {sigError && <p className="text-destructive mt-2 text-sm">{sigError}</p>}
                        <div className="mt-2 flex justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Sign & Clock In Button */}
                <div className="flex flex-col items-center gap-2 pb-6">
                    {!allAccepted && <p className="text-muted-foreground text-sm">Accept all items above to enable signing</p>}
                    <Button
                        onClick={handleSignAndClockIn}
                        disabled={showProcessing || !allAccepted}
                        size="lg"
                        className="h-14 w-64 gap-2 rounded-xl text-base font-semibold"
                    >
                        <LogIn className="h-5 w-5" />
                        Sign & Clock In
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <KioskLayout
            employees={employees ?? []}
            kiosk={kiosk}
            selectedEmployee={employee}
            adminMode={adminMode}
            guestSigners={guestSigners ?? []}
            hasTodayPrestart={hasTodayPrestart ?? false}
        >
            <Head title="Prestart Sign" />
            {content}
        </KioskLayout>
    );
}
