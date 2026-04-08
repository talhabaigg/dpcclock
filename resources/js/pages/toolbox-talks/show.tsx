import { SuccessAlertFlash } from '@/components/alert-flash';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { Download, Pencil, Upload } from 'lucide-react';

interface MediaItem {
    id: number;
    file_name: string;
    original_url: string;
    collection_name: string;
}

interface Talk {
    id: string;
    meeting_date: string;
    meeting_date_formatted: string;
    meeting_subject: string;
    is_locked: boolean;
    key_topics: { description: string }[] | null;
    action_points: { description: string }[] | null;
    injuries: { description: string }[] | null;
    near_misses: { description: string }[] | null;
    floor_comments: { description: string }[] | null;
    location: { id: number; name: string } | null;
    called_by: { id: number; name: string } | null;
    created_by: { id: number; name: string } | null;
    media: MediaItem[];
}

interface Props {
    talk: Talk;
    subjectOptions: Record<string, string>;
    generalItems: string[];
}

export default function ToolboxTalkShow({ talk, subjectOptions, generalItems }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const signedPdf = talk.media.find((m) => m.collection_name === 'signed_pdf');
    const topicFiles = talk.media.filter((m) => m.collection_name === 'topic_files');
    const actionPointFiles = talk.media.filter((m) => m.collection_name === 'action_point_files');
    const injuryFiles = talk.media.filter((m) => m.collection_name === 'injury_files');
    const nearMissFiles = talk.media.filter((m) => m.collection_name === 'near_miss_files');
    const floorCommentFiles = talk.media.filter((m) => m.collection_name === 'floor_comment_files');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Toolbox Talks', href: '/toolbox-talks' },
        { title: `${talk.meeting_date_formatted}`, href: '#' },
    ];

    const renderFiles = (files: MediaItem[]) =>
        files.length > 0 && (
            <div className="mt-2 space-y-1">
                {files.map((m) => (
                    <a key={m.id} href={m.original_url} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline">
                        {m.file_name}
                    </a>
                ))}
            </div>
        );

    const renderList = (title: string, items: { description: string }[] | null, files: MediaItem[]) =>
        items && items.length > 0 ? (
            <Card>
                <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                <CardContent>
                    <ul className="list-disc space-y-1 pl-5">
                        {items.map((item, i) => <li key={i}>{item.description}</li>)}
                    </ul>
                    {renderFiles(files)}
                </CardContent>
            </Card>
        ) : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Toolbox Talk - ${talk.meeting_date_formatted}`} />
            <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Toolbox Talk - {talk.meeting_date_formatted}</h1>
                    <div className="flex gap-2">
                        {can('prestarts.edit') && !talk.is_locked && (
                            <Button variant="outline" asChild>
                                <Link href={`/toolbox-talks/${talk.id}/edit`}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <a href={`/toolbox-talks/${talk.id}/pdf`} target="_blank" rel="noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a href={`/toolbox-talks/${talk.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Sign Sheet
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Details */}
                <Card>
                    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Project</dt>
                                <dd>{talk.location?.name ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Meeting Called By</dt>
                                <dd>{talk.called_by?.name ?? '-'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Subject</dt>
                                <dd><Badge variant="outline">{subjectOptions[talk.meeting_subject] ?? talk.meeting_subject}</Badge></dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                                <dd><Badge variant={talk.is_locked ? 'secondary' : 'default'}>{talk.is_locked ? 'Locked' : 'Active'}</Badge></dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                {/* General Items */}
                <Card>
                    <CardHeader><CardTitle>General Items to be Discussed</CardTitle></CardHeader>
                    <CardContent>
                        <ol className="list-decimal space-y-1 pl-5 text-sm">
                            {generalItems.map((item, i) => <li key={i}>{item}</li>)}
                        </ol>
                    </CardContent>
                </Card>

                {renderList('Key Topics Arising on Site', talk.key_topics, topicFiles)}
                {renderList('Action Points from Last Meeting', talk.action_points, actionPointFiles)}
                {renderList('Injuries from Previous Week', talk.injuries, injuryFiles)}
                {renderList('Near Misses from Previous Week', talk.near_misses, nearMissFiles)}
                {renderList('Comments from the Floor', talk.floor_comments, floorCommentFiles)}

                {/* Signatures */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Signatures</CardTitle>
                            {can('prestarts.edit') && (
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/toolbox-talks/${talk.id}/upload-signatures`}>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload Signatures
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {signedPdf ? (
                            <a href={signedPdf.original_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                                {signedPdf.file_name}
                            </a>
                        ) : (
                            <p className="text-sm text-muted-foreground">No signed PDF uploaded yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
