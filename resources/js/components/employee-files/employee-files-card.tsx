import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { PdfThumbnail } from '@/components/ui/pdf-thumbnail';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ZoomableImage } from '@/components/ui/zoomable-image';
import { useInitials } from '@/hooks/use-initials';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { router } from '@inertiajs/react';
import { AlertTriangle, CalendarClock, CheckCircle2, Download, ExternalLink, Eye, FileImage, FileText, FileType2, Hash, History, LayoutGrid, List, ListChecks, Loader2, MoreHorizontal, NotebookPen, Plus, RefreshCw, ShieldCheck, Trash2, XCircle } from 'lucide-react';
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
    is_other?: boolean;
}

interface Requirement {
    file_type_id: number;
    file_type_name: string;
    category: string[];
    level: 'mandatory' | 'preferred' | 'optional' | 'none';
    status: 'valid' | 'expired' | 'expiring_soon' | 'missing';
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
    front_preview_url: string | null;
    back_preview_url: string | null;
    front_filename: string | null;
    back_filename: string | null;
    front_mime_type: string | null;
    back_mime_type: string | null;
    front_size: number | null;
    back_size: number | null;
    version_count?: number;
}

function formatBytes(bytes: number | null | undefined): string {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImageFile(file: { url?: string | null; filename?: string | null; mimeType?: string | null }): boolean {
    if (file.mimeType?.startsWith('image/')) return true;
    if (file.filename) return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(file.filename);
    if (file.url) return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(file.url);
    return false;
}

function isPdfFile(file: { url?: string | null; filename?: string | null; mimeType?: string | null }): boolean {
    if (file.mimeType === 'application/pdf') return true;
    if (file.filename) return /\.pdf$/i.test(file.filename);
    if (file.url) return /\.pdf(\?|$)/i.test(file.url);
    return false;
}

function isPreviewable(file: { url?: string | null; filename?: string | null; mimeType?: string | null }): boolean {
    if (!file.url) return false;
    return isImageFile(file) || isPdfFile(file);
}

/* ── Thumbnail with status dot ── */
function FileThumbnail({
    url,
    filename,
    mimeType,
    status,
    onClick,
}: {
    url: string | null;
    filename: string | null;
    mimeType: string | null;
    status: string;
    onClick?: () => void;
}) {
    const dotColor = status === 'expired'
        ? 'bg-red-500'
        : status === 'expiring_soon'
            ? 'bg-amber-500'
            : 'bg-emerald-500';

    const hasImage = url && isImageFile({ url, filename, mimeType });
    const isPdf = isPdfFile({ url, filename, mimeType });

    const content = hasImage ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : isPdf && url ? (
        <PdfThumbnail url={url} targetWidth={200} fallbackClassName="h-5 w-5 text-muted-foreground" />
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
    onPreview: (record: EmployeeFileRecord, side: 'front' | 'back') => void;
}) {
    const getInitials = useInitials();
    const isExpired = file.status === 'expired';
    const isExpiring = file.status === 'expiring_soon';

    return (
        <div className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50">
            <FileThumbnail
                url={file.front_preview_url}
                filename={file.front_filename}
                mimeType={file.front_mime_type}
                status={file.status}
                onClick={file.front_preview_url && isPreviewable({ url: file.front_preview_url, filename: file.front_filename, mimeType: file.front_mime_type })
                    ? () => onPreview(file, 'front')
                    : undefined}
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

            {file.uploaded_by && (
                <TooltipProvider delay={150}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Avatar size="sm" className="shrink-0">
                                <AvatarFallback className="text-[10px]">{getInitials(file.uploaded_by)}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            Uploaded by {file.uploaded_by}
                            <span className="opacity-70"> · {formatDate(file.created_at)}</span>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

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
                    {file.front_preview_url && isPreviewable({ url: file.front_preview_url, filename: file.front_filename, mimeType: file.front_mime_type }) && (
                        <DropdownMenuItem onClick={() => onPreview(file, 'front')}>
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

/* ── Missing requirement row (no file uploaded yet) ── */
function MissingRow({
    requirement,
    onUpload,
}: {
    requirement: Requirement;
    onUpload: (fileTypeId: number) => void;
}) {
    const isMandatory = requirement.level === 'mandatory';

    return (
        <div className={`group flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 transition-colors ${
            isMandatory
                ? 'border-red-300 bg-red-50/30 hover:bg-red-50 dark:border-red-900 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                : 'border-amber-300 bg-amber-50/30 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
        }`}>
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed ${
                isMandatory
                    ? 'border-red-400 text-red-500 dark:border-red-800 dark:text-red-400'
                    : 'border-amber-400 text-amber-500 dark:border-amber-800 dark:text-amber-400'
            }`}>
                <Plus className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium leading-tight">{requirement.file_type_name}</span>
                    {isMandatory ? (
                        <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-[10px] leading-4">Required</Badge>
                    ) : (
                        <Badge className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] leading-4 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Preferred
                        </Badge>
                    )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Not uploaded yet</p>
            </div>

            <Button
                variant="outline"
                size="sm"
                className="h-7 shrink-0 gap-1"
                onClick={() => onUpload(requirement.file_type_id)}
            >
                <Plus className="h-3 w-3" />
                Upload
            </Button>
        </div>
    );
}

/* ── File tile (grid view) ── */
function FileTile({
    file,
    onDelete,
    onPreview,
}: {
    file: EmployeeFileRecord;
    onDelete: (id: number) => void;
    onPreview: (record: EmployeeFileRecord, side: 'front' | 'back') => void;
}) {
    const isExpired = file.status === 'expired';
    const isExpiring = file.status === 'expiring_soon';
    const previewable = !!file.front_preview_url && isPreviewable({ url: file.front_preview_url, filename: file.front_filename, mimeType: file.front_mime_type });
    const openPreview = previewable ? () => onPreview(file, 'front') : undefined;

    const dotColor = isExpired ? 'bg-red-500' : isExpiring ? 'bg-amber-500' : 'bg-emerald-500';
    const url = file.front_preview_url;
    const hasImage = url && isImageFile({ url, filename: file.front_filename, mimeType: file.front_mime_type });
    const isPdf = isPdfFile({ url, filename: file.front_filename, mimeType: file.front_mime_type });

    const thumbnail = hasImage ? (
        <img src={url} alt="" className="h-full w-full object-cover object-top" loading="lazy" />
    ) : isPdf && url ? (
        <PdfThumbnail url={url} targetWidth={480} className="h-full w-full object-cover object-top" fallbackClassName="text-muted-foreground h-10 w-10" />
    ) : (
        <div className="flex h-full w-full items-center justify-center">
            <FileText className="text-muted-foreground h-10 w-10" />
        </div>
    );

    return (
        <div className="group hover:border-accent-foreground/20 relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:shadow-md">
            <button
                type="button"
                onClick={openPreview}
                disabled={!openPreview}
                className="bg-muted relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden disabled:cursor-default"
                aria-label={openPreview ? `Preview ${file.file_type.name}` : file.file_type.name}
            >
                {thumbnail}
                <span className={`absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-background ${dotColor}`} title={file.status.replace(/_/g, ' ')} />
                {(isExpired || isExpiring) && (
                    <span className={`absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${isExpired ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
                        {isExpired ? 'Expired' : 'Expiring'}
                    </span>
                )}
                {isPdf && (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded bg-red-600/90 px-1 py-0.5 text-[9px] font-semibold uppercase text-white" title="PDF file">
                        <FileType2 className="h-2.5 w-2.5" />
                        PDF
                    </span>
                )}
                {hasImage && (
                    <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-600/90 px-1 py-0.5 text-[9px] font-semibold uppercase text-white" title="Image file">
                        <FileImage className="h-2.5 w-2.5" />
                        IMG
                    </span>
                )}
            </button>

            <div className="flex flex-col gap-1 border-t p-2.5">
                <div className="flex items-start justify-between gap-1">
                    <p className="min-w-0 truncate text-xs font-medium leading-tight" title={file.file_type.name}>
                        {file.file_type.name}
                    </p>
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground -my-1 -mr-1 h-6 w-6 shrink-0 p-0"
                                aria-label={`Actions for ${file.file_type.name}`}
                            >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            {previewable && (
                                <DropdownMenuItem onClick={openPreview}>
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
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                    {file.expires_at && (
                        <span className={isExpired ? 'font-medium text-red-600 dark:text-red-400' : isExpiring ? 'font-medium text-amber-600 dark:text-amber-400' : ''}>
                            Exp {formatDate(file.expires_at)}
                        </span>
                    )}
                    {file.document_number && <span>#{file.document_number}</span>}
                    {file.version_count != null && file.version_count > 1 && (
                        <span className="inline-flex items-center gap-0.5" title={`${file.version_count} versions`}>
                            <History className="h-3 w-3" />V{file.version_count}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Missing requirement tile (grid view) ── */
function MissingTile({
    requirement,
    onUpload,
}: {
    requirement: Requirement;
    onUpload: (fileTypeId: number) => void;
}) {
    const isMandatory = requirement.level === 'mandatory';
    return (
        <button
            type="button"
            onClick={() => onUpload(requirement.file_type_id)}
            className={`flex flex-col overflow-hidden rounded-lg border border-dashed text-left transition-colors ${
                isMandatory
                    ? 'border-red-300 bg-red-50/30 hover:bg-red-50 dark:border-red-900 dark:bg-red-950/20 dark:hover:bg-red-950/30'
                    : 'border-amber-300 bg-amber-50/30 hover:bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 dark:hover:bg-amber-950/30'
            }`}
        >
            <div className={`flex aspect-[4/3] w-full items-center justify-center ${
                isMandatory
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-amber-500 dark:text-amber-400'
            }`}>
                <Plus className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-0.5 border-t border-dashed p-2.5">
                <div className="flex items-center gap-1.5">
                    <p className="min-w-0 truncate text-xs font-medium leading-tight" title={requirement.file_type_name}>
                        {requirement.file_type_name}
                    </p>
                    {isMandatory ? (
                        <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-[10px] leading-4">Required</Badge>
                    ) : (
                        <Badge className="shrink-0 border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] leading-4 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Preferred
                        </Badge>
                    )}
                </div>
                <p className="text-muted-foreground text-[11px]">Tap to upload</p>
            </div>
        </button>
    );
}

/* ── Detail row inside preview sidebar ── */
function FieldRow({
    icon,
    label,
    children,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    tone?: 'danger' | 'warning';
}) {
    const toneClass =
        tone === 'danger' ? 'text-red-600 dark:text-red-400' :
        tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
        '';
    return (
        <div className="flex items-start gap-2">
            <span className={`text-muted-foreground mt-0.5 shrink-0 ${toneClass}`}>{icon}</span>
            <div className="min-w-0 flex-1">
                <dt className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide leading-tight">{label}</dt>
                <dd className={`text-sm leading-tight ${toneClass || ''}`}>{children}</dd>
            </div>
        </div>
    );
}

/* ── Preview dialog (mirrors injury-register attachment viewer) ── */
interface PreviewTarget {
    record: EmployeeFileRecord;
    side: 'front' | 'back';
}

function PreviewDialog({
    target,
    open,
    onOpenChange,
}: {
    target: PreviewTarget | null;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const getInitials = useInitials();
    if (!target) return null;
    const { record, side } = target;
    const url = side === 'back' ? record.back_url : (record.front_preview_url ?? record.front_url);
    const filename = side === 'back' ? record.back_filename : record.front_filename;
    const mimeType = side === 'back' ? record.back_mime_type : record.front_mime_type;
    const size = side === 'back' ? record.back_size : record.front_size;

    if (!url) return null;

    const isPdf = isPdfFile({ url, filename, mimeType });
    const isImage = isImageFile({ url, filename, mimeType });
    const isExpired = record.status === 'expired';
    const isExpiring = record.status === 'expiring_soon';
    const typeLabel = isPdf ? 'PDF' : isImage ? 'Image' : mimeType?.split('/')[1]?.toUpperCase() ?? 'File';
    const headingText = isPdf ? 'PDF' : isImage ? 'Photo' : 'File';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl md:flex-row">
                <VisuallyHidden><DialogTitle>{filename ?? headingText}</DialogTitle></VisuallyHidden>

                <div className="bg-muted/30 relative flex flex-1 overflow-hidden md:order-1">
                    {isPdf && (
                        <iframe src={url} title={filename ?? 'PDF'} className="h-full w-full bg-white" />
                    )}
                    {isImage && (
                        <ZoomableImage src={url} alt={filename ?? 'File preview'} />
                    )}
                    {!isPdf && !isImage && (
                        <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-3 p-8 text-center text-sm">
                            <FileText className="h-12 w-12 opacity-50" />
                            <p>No preview available for this file type.</p>
                        </div>
                    )}
                </div>

                <aside className="bg-background flex max-h-[35vh] shrink-0 flex-col gap-3 overflow-y-auto border-t p-4 pr-12 md:order-2 md:max-h-none md:w-72 md:gap-5 md:border-l md:border-t-0 md:p-5">
                    <h2 className="text-base font-semibold leading-tight">{headingText}</h2>

                    <div className="space-y-2.5 md:border-t md:pt-4">
                        <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Details</h3>
                        <p className="text-sm font-medium">{record.file_type.name}</p>
                        {(isExpired || isExpiring) && (
                            isExpired ? (
                                <Badge variant="destructive" className="gap-1 text-[10px]">
                                    <XCircle className="h-3 w-3" />
                                    Expired
                                </Badge>
                            ) : (
                                <Badge className="gap-1 border-amber-200 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    <AlertTriangle className="h-3 w-3" />
                                    Expiring soon
                                </Badge>
                            )
                        )}
                        <dl className="flex flex-col gap-2">
                            {record.expires_at && (
                                <FieldRow
                                    icon={<CalendarClock className="h-3.5 w-3.5" />}
                                    label="Expires"
                                    tone={isExpired ? 'danger' : isExpiring ? 'warning' : undefined}
                                >
                                    {formatDate(record.expires_at)}
                                </FieldRow>
                            )}
                            {record.completed_at && (
                                <FieldRow
                                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                                    label="Completed"
                                >
                                    {formatDate(record.completed_at)}
                                </FieldRow>
                            )}
                            {record.document_number && (
                                <FieldRow icon={<Hash className="h-3.5 w-3.5" />} label="Document #">
                                    {record.document_number}
                                </FieldRow>
                            )}
                            {record.selected_options && record.selected_options.length > 0 && (
                                <FieldRow icon={<ListChecks className="h-3.5 w-3.5" />} label="Options">
                                    {record.selected_options.join(', ')}
                                </FieldRow>
                            )}
                            {record.notes && !record.file_type.is_other && (
                                <FieldRow icon={<NotebookPen className="h-3.5 w-3.5" />} label="Notes">
                                    <span className="whitespace-pre-wrap">{record.notes}</span>
                                </FieldRow>
                            )}
                            {record.version_count != null && record.version_count > 1 && (
                                <FieldRow icon={<History className="h-3.5 w-3.5" />} label="Version">
                                    V{record.version_count}
                                </FieldRow>
                            )}
                        </dl>
                    </div>

                    <div className="space-y-1.5 md:space-y-2 md:border-t md:pt-4">
                        <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Uploaded</h3>
                        <div className="flex items-center gap-2">
                            <Avatar size="sm" className="shrink-0">
                                <AvatarFallback className="text-[10px]">
                                    {record.uploaded_by ? getInitials(record.uploaded_by) : '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                {record.uploaded_by && (
                                    <p className="truncate text-sm font-medium leading-tight">{record.uploaded_by}</p>
                                )}
                                <p className="text-muted-foreground text-xs leading-tight">
                                    {new Date(record.created_at).toLocaleString('en-AU')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5 md:space-y-2 md:border-t md:pt-4">
                        <h3 className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">File</h3>
                        {filename && <p className="break-words text-sm">{filename}</p>}
                        <p className="text-muted-foreground text-xs uppercase tracking-wide">
                            {typeLabel}{size ? ` · ${formatBytes(size)}` : ''}
                        </p>
                    </div>

                    <div className="mt-1 flex flex-col gap-1.5 md:mt-auto">
                        <Button asChild variant="outline" size="sm">
                            <a href={url} download={filename ?? undefined}>
                                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                            </a>
                        </Button>
                        {record.back_url && side !== 'back' && (
                            <Button asChild variant="outline" size="sm">
                                <a href={record.back_url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open back side
                                </a>
                            </Button>
                        )}
                    </div>
                </aside>
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
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [uploadPreselectId, setUploadPreselectId] = useState<number | null>(null);
    const [previewFile, setPreviewFile] = useState<PreviewTarget | null>(null);
    const [deleteFileId, setDeleteFileId] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'list';
        return (localStorage.getItem('employee-files:view') as 'list' | 'grid') || 'list';
    });
    useEffect(() => {
        if (typeof window !== 'undefined') localStorage.setItem('employee-files:view', viewMode);
    }, [viewMode]);

    const fetchData = useCallback(async () => {
        setError(false);
        try {
            const res = await fetch(`/employees/${employeeId}/files`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setFiles(data.files ?? []);
            setRequirements(data.requirements ?? []);

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

    // Missing = applicable to this employee (mandatory/preferred) but not yet uploaded.
    // Mandatory first, then preferred; alphabetical within each level.
    const missingByCategory = useMemo(() => {
        const grouped: Record<string, Requirement[]> = {};
        for (const r of requirements) {
            if (r.status !== 'missing') continue;
            const cat = r.category && r.category.length > 0 ? r.category[0] : 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(r);
        }
        for (const cat of Object.keys(grouped)) {
            grouped[cat].sort((a, b) => {
                if (a.level !== b.level) return a.level === 'mandatory' ? -1 : 1;
                return a.file_type_name.localeCompare(b.file_type_name);
            });
        }
        return grouped;
    }, [requirements]);

    const missingRequiredCount = useMemo(
        () => requirements.filter((r) => r.status === 'missing' && r.level === 'mandatory').length,
        [requirements],
    );
    const missingPreferredCount = useMemo(
        () => requirements.filter((r) => r.status === 'missing' && r.level === 'preferred').length,
        [requirements],
    );

    const categories = useMemo(() => {
        const set = new Set<string>([...Object.keys(filesByCategory), ...Object.keys(missingByCategory)]);
        return Array.from(set).sort((a, b) => {
            const aHasMandatoryGap = (missingByCategory[a] ?? []).some((r) => r.level === 'mandatory');
            const bHasMandatoryGap = (missingByCategory[b] ?? []).some((r) => r.level === 'mandatory');
            if (aHasMandatoryGap && !bHasMandatoryGap) return -1;
            if (!aHasMandatoryGap && bHasMandatoryGap) return 1;
            const aHasExpired = (filesByCategory[a] ?? []).some((f) => f.status === 'expired');
            const bHasExpired = (filesByCategory[b] ?? []).some((f) => f.status === 'expired');
            if (aHasExpired && !bHasExpired) return -1;
            if (!aHasExpired && bHasExpired) return 1;
            return a.localeCompare(b);
        });
    }, [filesByCategory, missingByCategory]);

    const openUploadFor = useCallback((fileTypeId: number | null) => {
        setUploadPreselectId(fileTypeId);
        setShowUpload(true);
    }, []);

    const hasAnyContent = files.length > 0 || Object.keys(missingByCategory).length > 0;

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
                            {!loading && missingRequiredCount > 0 && (
                                <Badge variant="destructive" className="gap-1 text-xs" title={`${missingRequiredCount} required document(s) missing`}>
                                    <AlertTriangle className="h-3 w-3" />
                                    {missingRequiredCount} missing
                                </Badge>
                            )}
                            {!loading && missingPreferredCount > 0 && missingRequiredCount === 0 && (
                                <Badge className="gap-1 border-amber-200 bg-amber-50 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300" title={`${missingPreferredCount} preferred document(s) missing`}>
                                    <AlertTriangle className="h-3 w-3" />
                                    {missingPreferredCount} preferred
                                </Badge>
                            )}
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
                            <div className="bg-muted flex overflow-hidden rounded-md border p-0.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                    className={`h-6 w-7 p-0 ${viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                                    aria-label="List view"
                                    aria-pressed={viewMode === 'list'}
                                >
                                    <List className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                    className={`h-6 w-7 p-0 ${viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                                    aria-label="Grid view"
                                    aria-pressed={viewMode === 'grid'}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openUploadFor(null)}>
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
                    ) : !hasAnyContent ? (
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
                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                            {(filesByCategory[cat] ?? []).map((f) => (
                                                <FileTile
                                                    key={f.id}
                                                    file={f}
                                                    onDelete={(id) => setDeleteFileId(id)}
                                                    onPreview={(record, side) => setPreviewFile({ record, side })}
                                                />
                                            ))}
                                            {(missingByCategory[cat] ?? []).map((r) => (
                                                <MissingTile
                                                    key={`missing-${r.file_type_id}`}
                                                    requirement={r}
                                                    onUpload={openUploadFor}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {(filesByCategory[cat] ?? []).map((f) => (
                                                <FileRow
                                                    key={f.id}
                                                    file={f}
                                                    onDelete={(id) => setDeleteFileId(id)}
                                                    onPreview={(record, side) => setPreviewFile({ record, side })}
                                                />
                                            ))}
                                            {(missingByCategory[cat] ?? []).map((r) => (
                                                <MissingRow
                                                    key={`missing-${r.file_type_id}`}
                                                    requirement={r}
                                                    onUpload={openUploadFor}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <UploadFileDialog
                open={showUpload}
                onOpenChange={(v) => {
                    setShowUpload(v);
                    if (!v) setUploadPreselectId(null);
                }}
                employeeId={employeeId}
                fileTypes={fileTypes}
                initialFileTypeId={uploadPreselectId}
            />
            <PreviewDialog target={previewFile} open={!!previewFile} onOpenChange={(v) => { if (!v) setPreviewFile(null); }} />
            <DeleteDialog open={deleteFileId !== null} onOpenChange={(v) => { if (!v) setDeleteFileId(null); }} onConfirm={handleDelete} />
        </>
    );
}
