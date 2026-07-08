import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
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
    // Populated for docs that came from a linked employment application, so
    // the badge lets HR jump back to the enquiry context.
    source_label?: string | null;
    source_url?: string | null;
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
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-end">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload Document
                </Button>
            </div>

            {!hasGeneral && !hasSigned && (
                <p className="text-muted-foreground rounded-md border py-8 text-center text-sm">
                    No documents on file yet.
                </p>
            )}

            {hasGeneral && (
                <section className="flex flex-col gap-1">
                    <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">General</h3>
                    <ul className="flex flex-col">
                        {documents.map((doc) => (
                            <li key={`g-${doc.id}`} className="group hover:bg-accent/40 flex items-center gap-2 rounded-md px-2 py-1.5">
                                <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                <a
                                    href={doc.preview_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                                >
                                    {doc.name}
                                </a>
                                <span className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap">
                                    {formatBytes(doc.size)} · {formatDate(doc.created_at)}
                                    {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ''}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" asChild>
                                    <a href={doc.download_url} title="Download">
                                        <Download className="h-3.5 w-3.5" />
                                    </a>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-destructive hover:text-destructive h-6 w-6 opacity-0 group-hover:opacity-100"
                                    onClick={() => setConfirmDeleteId(doc.id)}
                                    title="Delete"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {hasSigned && (
                <section className="flex flex-col gap-1">
                    <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Signed Documents</h3>
                    <ul className="flex flex-col">
                        {signedDocuments.map((sd) => (
                            <li key={`s-${sd.id}`} className="group hover:bg-accent/40 flex items-center gap-2 rounded-md px-2 py-1.5">
                                <FileSignature className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                                <a
                                    href={sd.download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                                >
                                    {sd.title}
                                </a>
                                {sd.source_label && (
                                    sd.source_url ? (
                                        <a
                                            href={sd.source_url}
                                            className="shrink-0 rounded-full border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400"
                                            title="Open enquiry"
                                        >
                                            {sd.source_label}
                                        </a>
                                    ) : (
                                        <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                            {sd.source_label}
                                        </span>
                                    )
                                )}
                                <span className="text-muted-foreground shrink-0 text-[11px] whitespace-nowrap">
                                    Signed {formatDate(sd.signed_at)}
                                    {sd.signer_name ? ` · ${sd.signer_name}` : ''}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" asChild>
                                    <a href={sd.download_url} title="Download" target="_blank" rel="noreferrer">
                                        <Download className="h-3.5 w-3.5" />
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
        </div>
    );
}
