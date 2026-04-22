import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { router } from '@inertiajs/react';
import { AlertTriangle, Download, Eye, FileText, History, Loader2, MoreHorizontal, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadFileDialog from './upload-file-dialog';

interface FileType {
    id: number;
    name: string;
    category: string[] | null;
    has_back_side: boolean;
    expiry_requirement: 'required' | 'optional' | 'none';
    requires_completed_date: boolean;
    options: string[] | null;
    has_versions?: boolean;
}

interface EmployeeFileRecord {
    id: number;
    document_number: string | null;
    expires_at: string | null;
    completed_at: string | null;
    selected_options: string[] | null;
    status: 'valid' | 'expired' | 'expiring_soon';
    notes: string | null;
    uploaded_by: string | null;
    created_at: string;
    file_type: FileType;
    front_url: string | null;
    back_url: string | null;
    front_filename: string | null;
    back_filename: string | null;
    version_count?: number;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImageUrl(url: string | null): boolean {
    if (!url) return false;
    return /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url);
}

function isPreviewable(url: string | null): boolean {
    if (!url) return false;
    return /\.(jpe?g|png|gif|webp|pdf)(\?|$)/i.test(url);
}

/* ── Thumbnail with status dot ── */
function FileThumbnail({ url, status, onClick }: { url: string | null; status: string; onClick?: () => void }) {
    const dotColor = status === 'expired'
        ? 'bg-red-500'
        : status === 'expiring_soon'
            ? 'bg-amber-500'
            : 'bg-emerald-500';

    const hasImage = url && isImageUrl(url);

    const content = hasImage ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : (
        <FileText className="h-5 w-5 text-muted-foreground" />
    );

    return (
        <div className="relative shrink-0">
            {onClick ? (
                <button
                    type="button"
                    onClick={onClick}
                    aria-label="Preview file"
                    className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-muted transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    {content}
                </button>
            ) : (
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {content}
                </div>
            )}
            <span className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-background ${dotColor}`} />
        </div>
    );
}

/* ── File row ── */
function FileRow({
    file,
    onDelete,
    onPreview,
}: {
    file: EmployeeFileRecord;
    onDelete: (id: number) => void;
    onPreview: (url: string) => void;
}) {
    const isExpired = file.status === 'expired';
    const isExpiring = file.status === 'expiring_soon';

    return (
        <div className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50">
            <FileThumbnail
                url={file.front_url}
                status={file.status}
                onClick={file.front_url && isPreviewable(file.front_url) ? () => onPreview(file.front_url!) : undefined}
            />

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium leading-tight">{file.file_type.name}</span>
                    {isExpired && (
                        <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-xs leading-4">Expired</Badge>
                    )}
                    {isExpiring && (
                        <Badge className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-xs leading-4 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Expiring
                        </Badge>
                    )}
                </div>

                {file.selected_options && file.selected_options.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{file.selected_options.join(', ')}</p>
                )}

                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    {file.expires_at && (
                        <span className={isExpired ? 'font-medium text-red-600 dark:text-red-400' : isExpiring ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
                            Exp: {formatDate(file.expires_at)}
                        </span>
                    )}
                    {file.completed_at && (
                        <span>Completed: {formatDate(file.completed_at)}</span>
                    )}
                    {file.document_number && <span>#{file.document_number}</span>}
                    {file.version_count != null && file.version_count > 1 && (
                        <span className="inline-flex items-center gap-0.5" title={`${file.version_count} versions`}>
                            <History className="h-3 w-3" />
                            V{file.version_count}
                        </span>
                    )}
                </div>
            </div>

            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                        aria-label={`Actions for ${file.file_type.name}`}
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    {file.front_url && isPreviewable(file.front_url) && (
                        <DropdownMenuItem onClick={() => onPreview(file.front_url!)}>
                            <Eye className="mr-2 h-3.5 w-3.5" />
                            Preview
                        </DropdownMenuItem>
                    )}
                    {file.front_url && (
                        <DropdownMenuItem asChild>
                            <a href={file.front_url} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-3.5 w-3.5" />
                                Download{file.back_url ? ' front' : ''}
                            </a>
                        </DropdownMenuItem>
                    )}
                    {file.back_url && (
                        <DropdownMenuItem asChild>
                            <a href={file.back_url} target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-3.5 w-3.5" />
                                Download back
                            </a>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(file.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/* ── Preview dialog ── */
function PreviewDialog({ url, open, onOpenChange }: { url: string | null; open: boolean; onOpenChange: (v: boolean) => void }) {
    if (!url) return null;
    const isPdf = /\.pdf(\?|$)/i.test(url);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto p-4">
                <VisuallyHidden><DialogTitle>File preview</DialogTitle></VisuallyHidden>
                {isPdf ? (
                    <iframe src={url} className="h-[80vh] w-full rounded-md" title="PDF Preview" />
                ) : (
                    <img src={url} alt="File preview" className="h-auto max-h-[80vh] w-full rounded-md object-contain" />
                )}
            </DialogContent>
        </Dialog>
    );
}

/* ── Delete confirmation ── */
function DeleteDialog({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void }) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete file</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove this file. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

/* ── Main card ── */
export default function EmployeeFilesCard({ employeeId }: { employeeId: number }) {
    const [files, setFiles] = useState<EmployeeFileRecord[]>([]);
    const [fileTypes, setFileTypes] = useState<FileType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [deleteFileId, setDeleteFileId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setError(false);
        try {
            const res = await fetch(`/employees/${employeeId}/files`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setFiles(data.files ?? []);

            const typeMap = new Map<number, FileType>();
            (data.files ?? []).forEach((f: EmployeeFileRecord) => typeMap.set(f.file_type.id, f.file_type));
            if (data.all_file_types) {
                (data.all_file_types as FileType[]).forEach((ft) => typeMap.set(ft.id, ft));
            }
            setFileTypes(Array.from(typeMap.values()));
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        const handler = () => fetchData();
        document.addEventListener('inertia:finish', handler);
        return () => document.removeEventListener('inertia:finish', handler);
    }, [fetchData]);

    const handleDelete = () => {
        if (deleteFileId === null) return;
        router.delete(`/employees/${employeeId}/files/${deleteFileId}`, { preserveState: true, preserveScroll: true });
        setDeleteFileId(null);
    };

    const expiredCount = useMemo(() => files.filter((f) => f.status === 'expired').length, [files]);
    const expiringCount = useMemo(() => files.filter((f) => f.status === 'expiring_soon').length, [files]);

    const filesByCategory = useMemo(() => {
        const grouped: Record<string, EmployeeFileRecord[]> = {};
        for (const f of files) {
            const cat = f.file_type.category && f.file_type.category.length > 0 ? f.file_type.category[0] : 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(f);
        }
        return grouped;
    }, [files]);

    const categories = useMemo(() => {
        return Object.keys(filesByCategory).sort((a, b) => {
            const aHasExpired = filesByCategory[a].some((f) => f.status === 'expired');
            const bHasExpired = filesByCategory[b].some((f) => f.status === 'expired');
            if (aHasExpired && !bHasExpired) return -1;
            if (!aHasExpired && bHasExpired) return 1;
            return a.localeCompare(b);
        });
    }, [filesByCategory]);

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <ShieldCheck className="h-4 w-4" />
                            Licences & training
                            {!loading && files.length > 0 && (
                                <span className="text-xs font-normal text-muted-foreground">{files.length}</span>
                            )}
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                            {!loading && expiredCount > 0 && (
                                <Badge variant="destructive" className="gap-1 text-xs">
                                    <XCircle className="h-3 w-3" />
                                    {expiredCount}
                                </Badge>
                            )}
                            {!loading && expiringCount > 0 && (
                                <Badge className="gap-1 border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    <AlertTriangle className="h-3 w-3" />
                                    {expiringCount}
                                </Badge>
                            )}
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowUpload(true)}>
                                <Plus className="h-3.5 w-3.5" />
                                Upload
                            </Button>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-2 pt-0">
                    <Separator className="mb-2" />

                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-2 py-8 text-center">
                            <p className="text-sm text-muted-foreground">Could not load files.</p>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchData}>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Retry
                            </Button>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            {categories.map((cat) => (
                                <div key={cat}>
                                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        {cat}
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        {filesByCategory[cat].map((f) => (
                                            <FileRow
                                                key={f.id}
                                                file={f}
                                                onDelete={(id) => setDeleteFileId(id)}
                                                onPreview={(url) => setPreviewUrl(url)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <UploadFileDialog open={showUpload} onOpenChange={setShowUpload} employeeId={employeeId} fileTypes={fileTypes} />
            <PreviewDialog url={previewUrl} open={!!previewUrl} onOpenChange={(v) => { if (!v) setPreviewUrl(null); }} />
            <DeleteDialog open={deleteFileId !== null} onOpenChange={(v) => { if (!v) setDeleteFileId(null); }} onConfirm={handleDelete} />
        </>
    );
}
