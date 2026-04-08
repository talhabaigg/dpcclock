import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Download, Pencil } from 'lucide-react';

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

interface Prestart {
    id: string;
    work_date: string;
    weather: string | null;
    weather_impact: string | null;
    activities: { description: string }[] | null;
    safety_concerns: { description: string }[] | null;
    is_active: boolean;
    location: { id: number; name: string } | null;
    foreman: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    signatures: Signature[];
    media: MediaItem[];
}

interface Props {
    prestart: Prestart;
}

export default function DailyPrestartShow({ prestart }: Props) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as { auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Daily Prestarts', href: '/daily-prestarts' },
        { title: `${prestart.work_date} - ${prestart.location?.name ?? ''}`, href: '#' },
    ];

    const activityMedia = prestart.media.filter((m) => m.collection_name === 'activity_files');
    const safetyConcernMedia = prestart.media.filter((m) => m.collection_name === 'safety_concern_files');
    const buildersPrestartMedia = prestart.media.filter((m) => m.collection_name === 'builders_prestart_file');

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Prestart - ${prestart.work_date}`} />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Daily Prestart - {prestart.work_date}</h1>
                    <div className="flex gap-2">
                        {can('prestarts.edit') && (
                            <Button variant="outline" asChild>
                                <Link href={`/daily-prestarts/${prestart.id}/edit`}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <a href={`/daily-prestarts/${prestart.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Details */}
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Project</dt>
                                <dd>{prestart.location?.name ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Foreman</dt>
                                <dd>{prestart.foreman?.name ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Weather</dt>
                                <dd>{prestart.weather ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Weather Impact</dt>
                                <dd>{prestart.weather_impact ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                                <dd>
                                    <Badge variant={prestart.is_active ? 'default' : 'secondary'}>{prestart.is_active ? 'Active' : 'Inactive'}</Badge>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Created By</dt>
                                <dd>{prestart.created_by?.name ?? '-'}</dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

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
                                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Attached Files</h4>
                                    <div className="space-y-1">
                                        {activityMedia.map((m) => (
                                            <a key={m.id} href={m.original_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                                                {m.file_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

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
                                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">Attached Files</h4>
                                    <div className="space-y-1">
                                        {safetyConcernMedia.map((m) => (
                                            <a key={m.id} href={m.original_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                                                {m.file_name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                    <a key={m.id} href={m.original_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                                        {m.file_name}
                                    </a>
                                ))}
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
                            <p className="text-sm text-muted-foreground">No signatures yet.</p>
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
                                                    <img src={sig.signature} alt="Signature" className="h-10 max-w-[200px] object-contain" />
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
