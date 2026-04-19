import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import WeatherWidget from '@/components/weather-widget';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { CheckCircle2, Download, GraduationCap, Pencil } from 'lucide-react';

interface MediaItem {
    id: number;
    file_name: string;
    original_url: string;
    collection_name: string;
}

interface Signature {
    id: number;
    signature: string;
    signed_at: string;
    employee: { id: number; name: string; preferred_name: string | null } | null;
}

interface UnsignedEmployee {
    id: number;
    name: string;
    is_present_at_site: boolean;
    absence_reason: string | null;
    note: string | null;
    clock_in_time: string | null;
}

interface Prestart {
    id: string;
    work_date: string;
    work_date_formatted: string;
    weather: Record<string, unknown> | null;
    activities: { description: string }[] | null;
    safety_concerns: { description: string }[] | null;
    is_active: boolean;
    is_locked: boolean;
    location: { id: number; name: string } | null;
    foreman: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    signatures: Signature[];
    media: MediaItem[];
}

interface TrainingItem {
    id: number;
    title: string;
    time: string | null;
    room: string | null;
    notes: string | null;
    employees: { id: number; name: string; preferred_name: string | null; display_name: string }[];
}

interface Props {
    prestart: Prestart;
    unsignedEmployees: UnsignedEmployee[];
    trainings: TrainingItem[];
}

const DAILY_CHECKLIST = [
    "Today's trade specific works discussed and understood",
    'All SWMS reviewed and understood',
    'Work permits in place as required and conditions understood',
    'Tools and equipment in working order with Test & Tag up to date',
    'Required PPE available and fit for purpose',
    'Current Licences & Qualifications are relevant to work tasks',
];

export default function DailyPrestartShow({ prestart, unsignedEmployees, trainings }: Props) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as { auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Daily Prestarts', href: '/daily-prestarts' },
        { title: prestart.location?.name ?? 'Prestart', href: '/daily-prestarts' },
        { title: prestart.work_date_formatted ?? prestart.work_date, href: '#' },
    ];

    const activityMedia = prestart.media.filter((m) => m.collection_name === 'activity_files');
    const safetyConcernMedia = prestart.media.filter((m) => m.collection_name === 'safety_concern_files');
    const buildersPrestartMedia = prestart.media.filter((m) => m.collection_name === 'builders_prestart_file');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Prestart - ${prestart.location?.name ?? ''} ${prestart.work_date_formatted ?? prestart.work_date}`} />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-lg font-semibold">Daily Prestart</h1>
                        <p className="text-muted-foreground text-sm">
                            {prestart.location?.name ?? '-'} &middot; {prestart.work_date_formatted ?? prestart.work_date}
                            {prestart.foreman && <> &middot; {prestart.foreman.name}</>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {prestart.is_locked && <Badge variant="outline">Locked</Badge>}
                        <Badge variant={prestart.is_active ? 'default' : 'secondary'}>{prestart.is_active ? 'Active' : 'Inactive'}</Badge>
                        {can('prestarts.edit') && !prestart.is_locked && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/daily-prestarts/${prestart.id}/edit`}>
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/daily-prestarts/${prestart.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                PDF
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Weather */}
                <WeatherWidget weather={prestart.weather as any} />

                {/* Activities */}
                {prestart.activities && prestart.activities.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>General Site Works / Activities</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc space-y-1 pl-5">
                                {prestart.activities.map((a, i) => (
                                    <li key={i}>{a.description}</li>
                                ))}
                            </ul>
                            {activityMedia.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-muted-foreground mb-2 text-sm font-medium">Attached Files</h4>
                                    <div className="space-y-1">
                                        {activityMedia.map((m) => (
                                            <a
                                                key={m.id}
                                                href={m.original_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-sm text-blue-600 hover:underline"
                                            >
                                                {m.file_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Daily Checklist */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Checklist</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-2">
                            {DAILY_CHECKLIST.map((item, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>

                {/* Safety Concerns */}
                {prestart.safety_concerns && prestart.safety_concerns.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Safety Concerns / Incidents</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc space-y-1 pl-5">
                                {prestart.safety_concerns.map((s, i) => (
                                    <li key={i}>{s.description}</li>
                                ))}
                            </ul>
                            {safetyConcernMedia.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="text-muted-foreground mb-2 text-sm font-medium">Attached Files</h4>
                                    <div className="space-y-1">
                                        {safetyConcernMedia.map((m) => (
                                            <a
                                                key={m.id}
                                                href={m.original_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block text-sm text-blue-600 hover:underline"
                                            >
                                                {m.file_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Trainings */}
                {trainings && trainings.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <GraduationCap className="h-5 w-5" />
                                Training Booked
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {trainings.map((t) => (
                                <div key={t.id} className="rounded-lg border p-3">
                                    <p className="font-medium">
                                        {t.title}
                                        {t.time && <span className="text-muted-foreground"> at {t.time}</span>}
                                    </p>
                                    {t.room && <p className="text-muted-foreground text-sm">{t.room}</p>}
                                    {t.employees.length > 0 && (
                                        <p className="mt-1 text-sm">
                                            {t.employees.map((e) => e.display_name || e.preferred_name || e.name).join(', ')}
                                        </p>
                                    )}
                                    {t.notes && <p className="text-muted-foreground mt-1 text-sm italic">{t.notes}</p>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Builders Prestart Files */}
                {buildersPrestartMedia.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Builders Daily Pre-Start</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                {buildersPrestartMedia.map((m) => (
                                    <a
                                        key={m.id}
                                        href={m.original_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block text-sm text-blue-600 hover:underline"
                                    >
                                        {m.file_name}
                                    </a>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Unsigned Employees */}
                {unsignedEmployees.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Not Signed ({unsignedEmployees.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {unsignedEmployees.map((emp) => (
                                            <TableRow key={emp.id}>
                                                <TableCell>{emp.name}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        <div>
                                                            {emp.is_present_at_site ? (
                                                                <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-200">
                                                                    Present - Not Signed
                                                                </Badge>
                                                            ) : emp.absence_reason ? (
                                                                <Badge variant="outline" className="bg-blue-50 text-blue-900 border-blue-200">
                                                                    {emp.absence_reason}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-gray-50 text-gray-900 border-gray-200">
                                                                    No Record
                                                                </Badge>
                                                            )}
                                                            {emp.clock_in_time && (
                                                                <span className="text-xs text-slate-500 ml-2">at {emp.clock_in_time}</span>
                                                            )}
                                                        </div>
                                                        {emp.note && (
                                                            <div className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-200">
                                                                {emp.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Signatures */}
                <Card>
                    <CardHeader>
                        <CardTitle>Signatures ({prestart.signatures.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {prestart.signatures.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No signatures yet.</p>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Signed At</TableHead>
                                            <TableHead>Signature</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {prestart.signatures.map((sig) => (
                                            <TableRow key={sig.id}>
                                                <TableCell>{sig.employee?.preferred_name || sig.employee?.name || '-'}</TableCell>
                                                <TableCell>{new Date(sig.signed_at).toLocaleString('en-AU')}</TableCell>
                                                <TableCell>
                                                    <img
                                                        src={sig.signature}
                                                        alt="Signature"
                                                        className="h-10 max-w-[200px] object-contain dark:invert"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
