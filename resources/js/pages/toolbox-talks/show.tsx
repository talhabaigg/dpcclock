import { SuccessAlertFlash } from '@/components/alert-flash';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    Activity,
    Building2,
    Check,
    Copy,
    Download,
    ExternalLink,
    FileSignature,
    Pencil,
    QrCode,
    Tag,
    Upload,
    User,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Fragment, type ReactNode, useState } from 'react';

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
    signInUrl: string;
    ipadUrl: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try {
            await navigator.clipboard?.writeText(value);
        } catch {
            /* swallow */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };
    return (
        <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2.5">
            <label className="text-sm font-medium text-muted-foreground">{label}</label>
            <Input value={value} readOnly className="font-mono text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={onCopy} className="min-w-[76px] gap-1.5">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied' : 'Copy'}
            </Button>
        </div>
    );
}

function DetailField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
    return (
        <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {icon}
                <span>{label}</span>
            </div>
            <div className="text-sm font-medium text-foreground">{children}</div>
        </div>
    );
}

function highlightMust(text: string) {
    return text.split(/(\bMUST\b)/g).map((part, i) =>
        part === 'MUST' ? (
            <strong key={i} className="font-semibold text-foreground">
                {part}
            </strong>
        ) : (
            <Fragment key={i}>{part}</Fragment>
        ),
    );
}

export default function ToolboxTalkShow({ talk, subjectOptions, generalItems, signInUrl, ipadUrl }: Props) {
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
                <CardHeader className="border-b">
                    <CardTitle className="text-sm">{title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                    <ul className="space-y-2">
                        {items.map((item, i) => (
                            <li key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                                <span className="size-[5px] shrink-0 rounded-full bg-muted-foreground" />
                                {item.description}
                            </li>
                        ))}
                    </ul>
                    {renderFiles(files)}
                </CardContent>
            </Card>
        ) : null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Toolbox Talk - ${talk.meeting_date_formatted}`} />
            <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-baseline gap-3">
                        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Toolbox Talk</h1>
                        <span className="text-sm font-medium text-muted-foreground">{talk.meeting_date_formatted}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {can('prestarts.edit') && !talk.is_locked && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/toolbox-talks/${talk.id}/edit`}>
                                    <Pencil className="size-3.5" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/toolbox-talks/${talk.id}/pdf`} target="_blank" rel="noreferrer">
                                <Download className="size-3.5" />
                                Download PDF
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/toolbox-talks/${talk.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                <Download className="size-3.5" />
                                Sign Sheet
                            </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                            <a href={`/toolbox-talks/${talk.id}/qr-sheet`} target="_blank" rel="noreferrer">
                                <QrCode className="size-3.5" />
                                Print QR
                            </a>
                        </Button>
                    </div>
                </header>

                {/* Worker Sign-In */}
                <Card>
                    <CardHeader className="border-b">
                        <CardTitle className="text-sm">Worker Sign-In</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="grid items-start gap-6 sm:grid-cols-[200px_1fr]">
                            <div className="w-fit rounded-xl border border-border bg-background p-3 shadow-[0_1px_0_rgba(15,17,21,0.02)]">
                                <QRCodeSVG value={signInUrl} size={176} level="M" />
                            </div>
                            <div className="flex flex-col gap-3">
                                <p className="m-0 max-w-[480px] text-[13.5px] leading-snug text-muted-foreground">
                                    Workers scan this code to sign in via their phone. Or open the link directly on a shared iPad.
                                </p>
                                <div className="flex flex-col gap-2">
                                    <CopyField label="Mobile" value={signInUrl} />
                                    <CopyField label="iPad" value={ipadUrl} />
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={`/toolbox-talks/${talk.id}/qr-sheet`} target="_blank" rel="noreferrer">
                                            <QrCode className="size-3.5" />
                                            Printable QR Sheet
                                        </a>
                                    </Button>
                                    <Button size="sm" variant="outline" asChild>
                                        <a href={ipadUrl} target="_blank" rel="noreferrer">
                                            <ExternalLink className="size-3.5" />
                                            Open on iPad
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Details */}
                <Card>
                    <CardHeader className="border-b">
                        <CardTitle className="text-sm">Details</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2">
                        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                            <DetailField icon={<Building2 className="size-3.5" />} label="Project">
                                {talk.location?.name ?? '-'}
                            </DetailField>
                            <DetailField icon={<User className="size-3.5" />} label="Meeting Called By">
                                {talk.called_by?.name ?? '-'}
                            </DetailField>
                            <DetailField icon={<Tag className="size-3.5" />} label="Subject">
                                <Badge variant="outline">{subjectOptions[talk.meeting_subject] ?? talk.meeting_subject}</Badge>
                            </DetailField>
                            <DetailField icon={<Activity className="size-3.5" />} label="Status">
                                {talk.is_locked ? (
                                    <Badge variant="secondary">Closed</Badge>
                                ) : (
                                    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                                        <span className="size-1.5 rounded-full bg-emerald-600" />
                                        Active
                                    </span>
                                )}
                            </DetailField>
                        </div>
                    </CardContent>
                </Card>

                {/* General Items */}
                <Card>
                    <CardHeader className="border-b">
                        <CardTitle className="text-sm">General Items to be Discussed</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pt-1 pb-2">
                        <ol className="m-0 flex list-none flex-col p-0">
                            {generalItems.map((item, i) => (
                                <li
                                    key={i}
                                    className={
                                        'grid grid-cols-[28px_1fr] gap-2 py-3 text-[13.5px] leading-snug ' +
                                        (i === generalItems.length - 1 ? '' : 'border-b border-dashed border-border')
                                    }
                                >
                                    <span className="pt-px font-mono text-xs tabular-nums text-muted-foreground">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="text-foreground">{highlightMust(item)}</span>
                                </li>
                            ))}
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
                    <CardHeader className="border-b">
                        <CardTitle className="text-sm">Signatures</CardTitle>
                        {can('prestarts.edit') && (
                            <CardAction>
                                <Button variant="outline" size="sm" asChild>
                                    <Link href={`/toolbox-talks/${talk.id}/upload-signatures`}>
                                        <Upload className="size-3.5" />
                                        Upload Signatures
                                    </Link>
                                </Button>
                            </CardAction>
                        )}
                    </CardHeader>
                    <CardContent className="pt-2">
                        {signedPdf ? (
                            <div className="flex items-center gap-3 rounded-[10px] border border-border bg-muted p-3">
                                <div className="grid size-9 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
                                    <FileSignature className="size-[18px]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-[13.5px] font-medium">{signedPdf.file_name}</div>
                                </div>
                                <Button size="sm" variant="outline" asChild>
                                    <a href={signedPdf.original_url} target="_blank" rel="noreferrer">
                                        <Download className="size-3.5" />
                                        Download
                                    </a>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
                                <span className="grid size-7 place-items-center rounded-lg border border-dashed border-border bg-muted">
                                    <FileSignature className="size-3.5" />
                                </span>
                                No signed PDF uploaded yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
