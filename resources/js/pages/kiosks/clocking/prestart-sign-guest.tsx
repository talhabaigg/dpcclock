import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import WeatherWidget from '@/components/weather-widget';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Building2, Clock, FileText, GraduationCap, MapPin, PenLine, UserPlus, Users } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { useCallback, useEffect, useRef, useState } from 'react';
import KioskDialogBox from '../components/kiosk-dialog';
import KioskLayout from '../partials/layout';

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

interface GuestSigner {
    id: number;
    guest_name: string;
    guest_company: string;
    signed_at: string;
    signed_at_formatted: string;
}

export default function PrestartSignGuest() {
    const { kiosk, prestart, employees, adminMode, trainings, guestSigners } = usePage<{
        kiosk: Kiosk;
        prestart: Prestart;
        employees?: any[];
        adminMode: boolean;
        trainings: TrainingItem[];
        guestSigners?: GuestSigner[];
    }>().props;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePad | null>(null);
    const [showProcessing, setShowProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [sigError, setSigError] = useState('');

    const [guestName, setGuestName] = useState('');
    const [guestCompany, setGuestCompany] = useState('');
    const [allAcknowledged, setAllAcknowledged] = useState(false);

    const detailsComplete = guestName.trim().length > 0 && guestCompany.trim().length > 0;
    const allAccepted = detailsComplete && allAcknowledged;

    // Clear stale error once the gating issue is resolved.
    useEffect(() => {
        if (sigError && detailsComplete && allAcknowledged) {
            setSigError('');
        }
    }, [sigError, detailsComplete, allAcknowledged]);

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

    const handleSign = () => {
        if (!detailsComplete) {
            setSigError('Please enter your name and company.');
            return;
        }
        if (!allAcknowledged) {
            setSigError('Please acknowledge the prestart items before signing.');
            return;
        }
        if (!padRef.current || padRef.current.isEmpty()) {
            setSigError('Please sign before submitting.');
            return;
        }
        setSigError('');
        setShowProcessing(true);

        const signatureData = padRef.current.toDataURL('image/png');

        router.post(
            route('kiosk.prestart.guest.sign', { kioskId: kiosk.eh_kiosk_id }),
            {
                prestart_id: prestart.id,
                guest_name: guestName.trim(),
                guest_company: guestCompany.trim(),
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
            <KioskDialogBox isOpen={showProcessing} onClose={() => {}} title="Signing Prestart" description="Please wait..." variant="loading" />

            <KioskDialogBox
                isOpen={success}
                onClose={() => {
                    window.location.href = route('kiosks.show', { kiosk: kiosk.id });
                }}
                title="Prestart Signed"
                description="Thanks! Your signature has been recorded."
                variant="success"
            />

            <div className="absolute top-4 left-4">
                <Link href={route('kiosks.show', { kiosk: kiosk.id })}>
                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-accent touch-manipulation">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                </Link>
            </div>

            <div className="w-full max-w-2xl space-y-4 pt-12">
                {/* Guest Header */}
                <div className="flex flex-col items-center">
                    <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-4 border-sky-500/20 bg-sky-500/10 text-sky-600 shadow-lg dark:text-sky-400">
                        <UserPlus className="h-7 w-7" />
                    </div>
                    <h2 className="text-xl font-bold">Guest Sign-In</h2>
                    <div className="mt-1 flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-sky-700 dark:text-sky-300">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">Daily Prestart &middot; {prestart.work_date_formatted}</span>
                    </div>
                </div>

                {/* Guest Details Form */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Your Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="guest_name">Name</Label>
                            <Input
                                id="guest_name"
                                autoFocus
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="Your full name"
                                autoComplete="name"
                                autoCapitalize="words"
                                spellCheck={false}
                                enterKeyHint="next"
                                className="h-11 text-base"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="guest_company" className="flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                Company
                            </Label>
                            <Input
                                id="guest_company"
                                value={guestCompany}
                                onChange={(e) => setGuestCompany(e.target.value)}
                                placeholder="Your company or trade"
                                autoComplete="organization"
                                autoCapitalize="words"
                                spellCheck={false}
                                enterKeyHint="done"
                                className="h-11 text-base"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Prestart Content */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Prestart Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <WeatherWidget weather={prestart.weather as any} workDate={prestart.work_date} dense />

                        {prestart.activities && prestart.activities.length > 0 && (
                            <div>
                                <p className="mb-1 font-medium text-muted-foreground">Activities</p>
                                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                    {prestart.activities.map((a, i) => (
                                        <li key={i}>{a.description}</li>
                                    ))}
                                </ul>
                                {activityFiles.length > 0 && (
                                    <div className="mt-1 space-y-0.5 pl-5">
                                        {activityFiles.map((f) => (
                                            <a key={f.id} href={f.original_url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline">
                                                {f.file_name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {prestart.safety_concerns && prestart.safety_concerns.length > 0 && (
                            <div>
                                <p className="mb-1 font-medium text-muted-foreground">Safety Concerns</p>
                                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                    {prestart.safety_concerns.map((s, i) => (
                                        <li key={i}>{s.description}</li>
                                    ))}
                                </ul>
                                {safetyConcernFiles.length > 0 && (
                                    <div className="mt-1 space-y-0.5 pl-5">
                                        {safetyConcernFiles.map((f) => (
                                            <a key={f.id} href={f.original_url} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline">
                                                {f.file_name}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div>
                            <p className="mb-1 font-medium text-muted-foreground">Daily Checklist</p>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                {DAILY_CHECKLIST.map((item, i) => (
                                    <li key={i}>{item}</li>
                                ))}
                            </ul>
                        </div>

                        {trainings && trainings.length > 0 && (
                            <div>
                                <p className="mb-1.5 flex items-center gap-1.5 font-medium text-muted-foreground">
                                    <GraduationCap className="h-4 w-4" />
                                    Booked Training
                                </p>
                                <div className="space-y-2">
                                    {trainings.map((t) => (
                                        <div
                                            key={t.id}
                                            className="overflow-hidden rounded-lg border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-blue-50/60 dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-blue-950/20"
                                        >
                                            <div className="flex items-start gap-3 p-3">
                                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                                    <GraduationCap className="h-5 w-5" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold leading-tight">{t.title}</p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                                                    {t.notes && (
                                                        <p className="mt-2 border-t border-indigo-200/50 pt-2 text-xs italic text-muted-foreground dark:border-indigo-900/50">
                                                            {t.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <label
                            className={cn(
                                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors touch-manipulation',
                                allAcknowledged ? 'border-emerald-300 bg-emerald-50' : 'border-border',
                            )}
                        >
                            <Checkbox checked={allAcknowledged} onCheckedChange={() => setAllAcknowledged((prev) => !prev)} className="mt-0.5 h-5 w-5" />
                            <span className={cn('flex-1 font-medium', allAcknowledged && 'text-emerald-800')}>
                                I acknowledge and confirm all of the above activities, safety concerns, and checklist items
                            </span>
                        </label>
                    </CardContent>
                </Card>

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

                {/* Sign Button */}
                <div className="flex flex-col items-center gap-3 pb-6">
                    {!detailsComplete && (
                        <p className="text-muted-foreground text-sm">Enter your name and company to continue</p>
                    )}
                    {detailsComplete && !allAcknowledged && (
                        <p className="text-muted-foreground text-sm">Tick the acknowledgement above to continue</p>
                    )}
                    <Button
                        onClick={handleSign}
                        disabled={showProcessing || !allAccepted}
                        className={cn(
                            'h-16 w-64 gap-3 rounded-2xl text-lg font-bold',
                            'bg-sky-600 text-white shadow-lg',
                            'hover:bg-sky-700 hover:shadow-xl',
                            'active:scale-[0.98]',
                            'touch-manipulation transition-all duration-200',
                        )}
                    >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                            <PenLine className="h-4 w-4" />
                        </div>
                        Sign Prestart
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <KioskLayout
            employees={employees ?? []}
            kiosk={kiosk}
            adminMode={adminMode}
            guestSigners={guestSigners ?? []}
            hasTodayPrestart
        >
            <Head title="Guest Prestart Sign" />
            {content}
        </KioskLayout>
    );
}
