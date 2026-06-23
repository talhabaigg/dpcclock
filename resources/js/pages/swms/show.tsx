import { SuccessAlertFlash } from '@/components/alert-flash';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { EllipsisVertical, Pencil, Upload } from 'lucide-react';
import { useState } from 'react';

interface Person {
    id: number;
    name: string;
}

interface Version {
    id: string;
    version_number: string;
    status: string;
    status_label: string;
    requires_resignature: boolean;
    change_summary: string | null;
    approved_at: string | null;
    created_at: string;
    created_by: Person | null;
    document_filename: string | null;
    signatures_count: number;
}

interface Props {
    location: { id: number; name: string };
    swms: {
        id: string;
        name: string;
        description: string | null;
        created_by: Person | null;
        created_at: string;
    };
    versions: Version[];
    activeSummary: { id: string; signed_count: number; kiosk_count: number } | null;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (status) {
        case 'active':
            return 'default';
        case 'superseded':
            return 'secondary';
        case 'archived':
            return 'outline';
        default:
            return 'outline';
    }
}

export default function SwmsShow({ location, swms, versions, activeSummary }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const baseUrl = `/locations/${location.id}/swms`;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'SWMS', href: baseUrl },
        { title: swms.name, href: `${baseUrl}/${swms.id}` },
    ];

    const [uploadOpen, setUploadOpen] = useState(false);
    const [archiveTarget, setArchiveTarget] = useState<Version | null>(null);

    const uploadForm = useForm({
        version_number: '',
        change_summary: '',
        requires_resignature: true as boolean,
        approved_at: '',
        document: null as File | null,
    });

    const submitUpload = (e: React.FormEvent) => {
        e.preventDefault();
        uploadForm.post(`${baseUrl}/${swms.id}/versions`, {
            forceFormData: true,
            onSuccess: () => {
                setUploadOpen(false);
                uploadForm.reset();
            },
        });
    };

    const confirmArchive = () => {
        if (!archiveTarget) return;
        router.post(
            `${baseUrl}/${swms.id}/versions/${archiveTarget.id}/archive`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setArchiveTarget(null),
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={swms.name} />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                <div className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold">{swms.name}</h1>
                        {swms.description && (
                            <p className="text-muted-foreground mt-1 text-sm">{swms.description}</p>
                        )}
                        {activeSummary && (
                            <p className="text-muted-foreground mt-1 text-sm">
                                <span className="font-medium text-foreground">{activeSummary.signed_count}</span> of{' '}
                                <span className="font-medium text-foreground">{activeSummary.kiosk_count}</span> workers have signed the active version.
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {can('swms.edit') && (
                            <Button asChild variant="outline" size="sm">
                                <Link href={`${baseUrl}/${swms.id}/edit`}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Link>
                            </Button>
                        )}
                        {can('swms.create') && (
                            <Button size="sm" onClick={() => setUploadOpen(true)}>
                                <Upload className="mr-2 h-4 w-4" />
                                Upload new version
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <h2 className="text-base font-semibold">Versions ({versions.length})</h2>
                    <div className="rounded-md border">
                        <Table className="[&_td]:py-1 [&_th]:h-auto [&_th]:py-1">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Version</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Document</TableHead>
                                    <TableHead>Signed</TableHead>
                                    <TableHead>Re-signature</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {versions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                                            No versions yet. Upload the first version to make it active.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {versions.map((v) => {
                                    const vBase = `${baseUrl}/${swms.id}/versions/${v.id}`;
                                    return (
                                    <TableRow key={v.id}>
                                        <TableCell>
                                            <Link href={vBase} className="font-medium hover:underline">
                                                {v.version_number}
                                            </Link>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusBadgeVariant(v.status)}>{v.status_label}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[280px]">
                                            {v.document_filename ? (
                                                <a
                                                    href={`${vBase}/document`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={v.document_filename}
                                                    className="block truncate text-blue-600 hover:underline dark:text-blue-400"
                                                >
                                                    {v.document_filename}
                                                </a>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{v.signatures_count}</TableCell>
                                        <TableCell>{v.requires_resignature ? 'Required' : 'Carried forward'}</TableCell>
                                        <TableCell>
                                            {new Date(v.created_at).toLocaleDateString('en-AU')}
                                            {v.created_by && <span className="text-muted-foreground"> · {v.created_by.name}</span>}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" aria-label="Row actions">
                                                        <EllipsisVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="min-w-max">
                                                    <DropdownMenuItem asChild className="whitespace-nowrap">
                                                        <Link href={vBase}>View signers</Link>
                                                    </DropdownMenuItem>
                                                    {v.document_filename && (
                                                        <DropdownMenuItem asChild className="whitespace-nowrap">
                                                            <a href={`${vBase}/document`} target="_blank" rel="noreferrer">
                                                                Download document
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem asChild className="whitespace-nowrap">
                                                        <a href={`${vBase}/sign-sheet`} target="_blank" rel="noreferrer">
                                                            Signed-workers PDF
                                                        </a>
                                                    </DropdownMenuItem>
                                                    {can('swms.archive') && v.status !== 'archived' && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="text-destructive focus:text-destructive whitespace-nowrap"
                                                                onClick={() => setArchiveTarget(v)}
                                                            >
                                                                Archive
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Upload new version</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitUpload} className="space-y-4">
                        <div>
                            <Label htmlFor="version_number">Version number (optional)</Label>
                            <Input
                                id="version_number"
                                placeholder="Leave blank to auto-increment"
                                value={uploadForm.data.version_number}
                                onChange={(e) => uploadForm.setData('version_number', e.target.value)}
                            />
                            {uploadForm.errors.version_number && <p className="text-destructive mt-1 text-xs">{uploadForm.errors.version_number}</p>}
                        </div>

                        <div>
                            <Label htmlFor="document">PDF document</Label>
                            <Input
                                id="document"
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => uploadForm.setData('document', e.target.files?.[0] ?? null)}
                            />
                            {uploadForm.errors.document && <p className="text-destructive mt-1 text-xs">{uploadForm.errors.document}</p>}
                        </div>

                        <div>
                            <Label htmlFor="change_summary">Change summary (optional)</Label>
                            <Textarea
                                id="change_summary"
                                rows={3}
                                value={uploadForm.data.change_summary}
                                onChange={(e) => uploadForm.setData('change_summary', e.target.value)}
                            />
                            {uploadForm.errors.change_summary && <p className="text-destructive mt-1 text-xs">{uploadForm.errors.change_summary}</p>}
                        </div>

                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="requires_resignature"
                                checked={uploadForm.data.requires_resignature}
                                onCheckedChange={(v) => uploadForm.setData('requires_resignature', !!v)}
                            />
                            <div>
                                <Label htmlFor="requires_resignature" className="cursor-pointer">
                                    Previous signers must re-sign
                                </Label>
                                <p className="text-muted-foreground text-xs">
                                    If unchecked, existing signatures from the prior active version will carry forward to this version.
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setUploadOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={uploadForm.processing || !uploadForm.data.document}>
                                Upload &amp; activate
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!archiveTarget}
                onOpenChange={(open) => !open && setArchiveTarget(null)}
                title="Archive version"
                description={archiveTarget ? `Archive version ${archiveTarget.version_number}? It will remain accessible but won't appear as active.` : ''}
                confirmLabel="Archive"
                onConfirm={confirmArchive}
            />
        </AppLayout>
    );
}
