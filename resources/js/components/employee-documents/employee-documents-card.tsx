import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { router } from '@inertiajs/react';
import { Download, FileSignature, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import Dropzone from 'shadcn-dropzone';

export interface EmployeeDocument {
    id: number;
    name: string;
    mime_type: string | null;
    size: number;
    created_at: string | null;
    uploaded_by: string | null;
    download_url: string;
    preview_url: string;
}

export interface EmployeeSignedDocument {
    id: number;
    title: string;
    signed_at: string | null;
    signer_name: string | null;
    download_url: string;
}

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EmployeeDocumentsCard({
    employeeId,
    documents,
    signedDocuments,
}: {
    employeeId: number;
    documents: EmployeeDocument[];
    signedDocuments: EmployeeSignedDocument[];
}) {
    const [uploadOpen, setUploadOpen] = useState(false);
    const [pending, setPending] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const submit = useCallback(() => {
        if (pending.length === 0) return;
        const data = new FormData();
        pending.forEach((f) => data.append('files[]', f));
        setUploading(true);
        router.post(`/employees/${employeeId}/documents`, data, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => {
                setUploading(false);
                setPending([]);
                setUploadOpen(false);
            },
        });
    }, [pending, employeeId]);

    const onDelete = useCallback(() => {
        if (confirmDeleteId == null) return;
        router.delete(`/employees/${employeeId}/documents/${confirmDeleteId}`, {
            preserveScroll: true,
            onFinish: () => setConfirmDeleteId(null),
        });
    }, [confirmDeleteId, employeeId]);

    const hasGeneral = documents.length > 0;
    const hasSigned = signedDocuments.length > 0;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        Documents
                    </CardTitle>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                        <Upload className="h-3.5 w-3.5" />
                        Upload Document
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <Separator className="mb-4" />

                {!hasGeneral && !hasSigned && (
                    <p className="text-muted-foreground text-sm italic">No documents on file yet.</p>
                )}

                {hasGeneral && (
                    <section className="mb-5">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">General</h3>
                        <ul className="divide-y rounded-md border">
                            {documents.map((doc) => (
                                <li key={`g-${doc.id}`} className="flex items-center gap-3 px-3 py-2">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <a
                                            href={doc.preview_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block truncate text-sm font-medium hover:underline"
                                        >
                                            {doc.name}
                                        </a>
                                        <p className="truncate text-[11px] text-muted-foreground">
                                            {formatBytes(doc.size)} · {formatDate(doc.created_at)}
                                            {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                            <a href={doc.download_url} title="Download">
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => setConfirmDeleteId(doc.id)}
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {hasSigned && (
                    <section>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signed Documents</h3>
                        <ul className="divide-y rounded-md border">
                            {signedDocuments.map((sd) => (
                                <li key={`s-${sd.id}`} className="flex items-center gap-3 px-3 py-2">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 dark:bg-red-950/40">
                                        <FileSignature className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <a
                                            href={sd.download_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block truncate text-sm font-medium hover:underline"
                                        >
                                            {sd.title}
                                        </a>
                                        <p className="truncate text-[11px] text-muted-foreground">
                                            Signed {formatDate(sd.signed_at)}
                                            {sd.signer_name ? ` · ${sd.signer_name}` : ''}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                        <a href={sd.download_url} title="Download" target="_blank" rel="noreferrer">
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <Sheet open={uploadOpen} onOpenChange={(open) => {
                    setUploadOpen(open);
                    if (!open) setPending([]);
                }}>
                    <SheetContent side="right" className="w-full sm:max-w-md">
                        <SheetHeader>
                            <SheetTitle>Upload Documents</SheetTitle>
                            <SheetDescription>
                                Drop files here or click to select. Up to 20 MB each.
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex-1 overflow-y-auto px-4">
                            <Dropzone
                                onDrop={(files) => setPending((prev) => [...prev, ...files])}
                                maxSize={20 * 1024 * 1024}
                                showFilesList={false}
                            />
                            {pending.length > 0 && (
                                <ul className="mt-3 divide-y rounded-md border">
                                    {pending.map((f, idx) => (
                                        <li key={`${f.name}-${idx}`} className="flex items-center gap-2 px-3 py-2 text-xs">
                                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                            <span className="shrink-0 text-muted-foreground">{formatBytes(f.size)}</span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => setPending((prev) => prev.filter((_, i) => i !== idx))}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <SheetFooter className="border-t pt-4">
                            <Button variant="ghost" onClick={() => setUploadOpen(false)} disabled={uploading}>
                                Cancel
                            </Button>
                            <Button onClick={submit} disabled={pending.length === 0 || uploading} className="gap-1.5">
                                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Upload {pending.length > 0 ? `(${pending.length})` : ''}
                            </Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>

                <AlertDialog open={confirmDeleteId != null} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently remove the file. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
