import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Head, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { AlertTriangle, CircleCheck, Download, FileText, Loader2, MoreVertical, Pencil, Plus, Printer, QrCode, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { QRCodeSVG } from 'qrcode.react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'SDS Register', href: '/sds' }];

interface MediaFile {
    id: number;
    file_name: string;
    size: number;
    collection_name: string;
}

interface SdsRecord {
    id: number;
    product_name: string;
    manufacturer: string;
    description: string | null;
    hazard_classifications: string[];
    expires_at: string;
    locations: { id: number; name: string }[];
    media: MediaFile[];
    created_at: string;
}

interface Filters {
    search?: string;
    manufacturer?: string;
    location_id?: string;
    expiry?: string;
}

interface PageProps {
    sds: { data: SdsRecord[] } & Partial<PaginationData>;
    filters: Filters;
    manufacturers: string[];
    locations: { id: number; name: string }[];
    hazardClassifications: string[];
}

function isExpired(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getOtherFiles(media: MediaFile[]): MediaFile[] {
    return media.filter((m) => m.collection_name === 'other_files');
}

// ── Form State ────────────────────────────────────────────────────────────────

interface FormState {
    product_name: string;
    manufacturer: string;
    description: string;
    hazard_classifications: string[];
    expires_at: Date | undefined;
    location_ids: number[];
    sds_file: File | null;
    other_files: File[];
    remove_other_files: number[];
}

const EMPTY_FORM: FormState = {
    product_name: '',
    manufacturer: '',
    description: '',
    hazard_classifications: [],
    expires_at: undefined,
    location_ids: [],
    sds_file: null,
    other_files: [],
    remove_other_files: [],
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SdsIndex() {
    const { sds, filters, manufacturers, locations, hazardClassifications } = usePage<{ props: PageProps }>().props as unknown as PageProps;
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [search, setSearch] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Dialog state
    const [showDialog, setShowDialog] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingMedia, setEditingMedia] = useState<MediaFile[]>([]);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);

    // Delete dialog
    const [deleteId, setDeleteId] = useState<number | null>(null);

    // QR dialog
    const [showQrDialog, setShowQrDialog] = useState(false);
    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/public/sds` : '/public/sds';

    const handlePrintQr = () => {
        const svg = document.getElementById('sds-public-qr')?.outerHTML ?? '';
        const win = window.open('', '_blank', 'width=800,height=900');
        if (!win) return;
        const logoUrl = `${window.location.origin}/logo.png`;
        win.document.write(`<!doctype html><html><head><title>SDS Register QR Code</title>
            <style>
                @page { size: A4 portrait; margin: 15mm; }
                * { box-sizing: border-box; }
                html, body { margin: 0; padding: 0; background: #fff; color: #111; }
                body { font-family: system-ui, -apple-system, sans-serif; text-align: center; }
                .card {
                    width: 100%;
                    max-width: 180mm;
                    margin: 0 auto;
                    border: 3px solid #111;
                    border-radius: 6mm;
                    padding: 14mm 12mm;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .logo { height: 22mm; width: auto; margin-bottom: 8mm; }
                h1 { font-size: 28pt; margin: 0 0 2mm; letter-spacing: -0.01em; font-weight: 700; }
                h2 { font-size: 14pt; margin: 0 0 8mm; color: #444; font-weight: 500; }
                .qr {
                    padding: 6mm;
                    background: #fff;
                    border: 1px solid #ddd;
                    border-radius: 3mm;
                    margin-bottom: 8mm;
                }
                .qr svg { width: 110mm; height: 110mm; display: block; }
                .instructions { font-size: 12pt; color: #222; line-height: 1.5; margin-bottom: 5mm; }
                .url {
                    font-size: 9pt;
                    color: #555;
                    word-break: break-all;
                    font-family: ui-monospace, 'Courier New', monospace;
                    margin-bottom: 6mm;
                }
                .footer {
                    padding-top: 4mm;
                    border-top: 1px solid #ddd;
                    font-size: 9pt;
                    color: #777;
                    width: 100%;
                }
                @media print {
                    html, body { width: 210mm; height: 297mm; }
                    .card { border-width: 2pt; page-break-inside: avoid; }
                }
            </style></head><body>
            <div class="card">
                <img class="logo" src="${logoUrl}" alt="DPC" />
                <h1>SDS Register</h1>
                <h2>Scan to view the register</h2>
                <div class="qr">${svg}</div>
                <div class="instructions">
                    Point your phone camera at the code above to access all<br/>
                    product safety data sheets. No login required.
                </div>
                <div class="url">${publicUrl}</div>
                <div class="footer">For safety enquiries, contact your site supervisor.</div>
            </div>
            <script>
                window.onload = () => {
                    const img = document.querySelector('img.logo');
                    const doPrint = () => { window.focus(); window.print(); };
                    if (img && !img.complete) {
                        img.onload = () => setTimeout(doPrint, 100);
                        img.onerror = () => setTimeout(doPrint, 100);
                    } else {
                        setTimeout(doPrint, 250);
                    }
                };
            </script>
            </body></html>`);
        win.document.close();
    };

    useEffect(() => {
        if (flash?.success) setAlertMessage({ type: 'success', text: flash.success });
        else if (flash?.error) setAlertMessage({ type: 'error', text: flash.error });
    }, [flash?.success, flash?.error]);

    // Debounced search
    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyFilter('search', search);
            }
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    const applyFilter = (key: string, value: string) => {
        const newFilters = { ...filters, [key]: value || undefined };
        Object.keys(newFilters).forEach((k) => {
            if (!newFilters[k as keyof Filters]) delete newFilters[k as keyof Filters];
        });
        router.get('/sds', newFilters, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        setSearch('');
        router.get('/sds', {}, { preserveState: true, preserveScroll: true });
    };

    const hasFilters = !!(filters.search || filters.manufacturer || filters.location_id || filters.expiry);

    // Create / Edit
    const openCreate = () => {
        setEditingId(null);
        setEditingMedia([]);
        setForm(EMPTY_FORM);
        setShowDialog(true);
    };

    const openEdit = (record: SdsRecord) => {
        setEditingId(record.id);
        setEditingMedia(getOtherFiles(record.media));
        setForm({
            product_name: record.product_name,
            manufacturer: record.manufacturer,
            description: record.description ?? '',
            hazard_classifications: record.hazard_classifications ?? [],
            expires_at: new Date(record.expires_at),
            location_ids: record.locations?.map((l) => l.id) ?? [],
            sds_file: null,
            other_files: [],
            remove_other_files: [],
        });
        setShowDialog(true);
    };

    const toggleHazard = (h: string) => {
        setForm((prev) => ({
            ...prev,
            hazard_classifications: prev.hazard_classifications.includes(h)
                ? prev.hazard_classifications.filter((x) => x !== h)
                : [...prev.hazard_classifications, h],
        }));
    };

    const handleSubmit = () => {
        if (!form.product_name || !form.manufacturer || !form.expires_at) return;
        if (!editingId && !form.sds_file) return;
        setSubmitting(true);

        const data: Record<string, unknown> = {
            product_name: form.product_name,
            manufacturer: form.manufacturer,
            description: form.description || null,
            hazard_classifications: form.hazard_classifications,
            expires_at: format(form.expires_at, 'yyyy-MM-dd'),
            location_ids: form.location_ids,
        };

        if (form.sds_file) data.sds_file = form.sds_file;
        if (form.other_files.length > 0) data.other_files = form.other_files;
        if (form.remove_other_files.length > 0) data.remove_other_files = form.remove_other_files;

        const url = editingId ? `/sds/${editingId}` : '/sds';

        if (editingId) {
            // PUT via POST with _method for file uploads
            router.post(url, { ...data, _method: 'PUT' } as never, {
                forceFormData: true,
                onFinish: () => setSubmitting(false),
                onSuccess: () => setShowDialog(false),
            });
        } else {
            router.post(url, data as never, {
                forceFormData: true,
                onFinish: () => setSubmitting(false),
                onSuccess: () => setShowDialog(false),
            });
        }
    };

    const handleDelete = () => {
        if (!deleteId) return;
        router.delete(`/sds/${deleteId}`, {
            onSuccess: () => setDeleteId(null),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="SDS Register" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {alertMessage && (
                    <div
                        className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
                            alertMessage.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300'
                                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300'
                        }`}
                    >
                        {alertMessage.type === 'success' ? <CircleCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span className="flex-1">{alertMessage.text}</span>
                        <button onClick={() => setAlertMessage(null)}>
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">SDS Register</h2>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowQrDialog(true)} className="gap-1.5">
                            <QrCode size={14} />
                            Public QR
                        </Button>
                        <Button size="sm" onClick={openCreate} className="gap-1.5">
                            <Plus size={14} />
                            Add SDS
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" size={18} />
                        <Input
                            type="text"
                            placeholder="Search SDS register..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Select value={filters.manufacturer ?? ''} onValueChange={(v) => applyFilter('manufacturer', v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-9 w-[180px] text-sm">
                            <SelectValue placeholder="Manufacturer" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Manufacturers</SelectItem>
                            {manufacturers.map((m) => (
                                <SelectItem key={m} value={m}>
                                    {m}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.expiry ?? ''} onValueChange={(v) => applyFilter('expiry', v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-9 w-[180px] text-sm">
                            <SelectValue placeholder="Expiry" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Expiry</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="tomorrow">Expires Tomorrow</SelectItem>
                            <SelectItem value="7days">Within 7 Days</SelectItem>
                            <SelectItem value="30days">Within 30 Days</SelectItem>
                            <SelectItem value="90days">Within 90 Days</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.location_id ?? ''} onValueChange={(v) => applyFilter('location_id', v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-9 w-[180px] text-sm">
                            <SelectValue placeholder="Project" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Projects</SelectItem>
                            {locations.map((l) => (
                                <SelectItem key={l.id} value={String(l.id)}>
                                    {l.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
                            <X size={14} />
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3 text-xs">Product & Manufacturer</TableHead>
                                <TableHead className="px-3 text-xs">Expiry Date</TableHead>
                                <TableHead className="px-3 text-xs">Description</TableHead>
                                <TableHead className="px-3 text-xs">Hazard Classification</TableHead>
                                <TableHead className="px-3 text-xs">Other Files</TableHead>
                                <TableHead className="w-12 px-3 text-xs" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sds.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                        No SDS records found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {sds.data.map((record) => {
                                const otherFiles = getOtherFiles(record.media);
                                const expired = isExpired(record.expires_at);
                                return (
                                    <TableRow key={record.id} className="group">
                                        <TableCell className="px-3">
                                            <div className="text-sm font-medium">{record.product_name}</div>
                                            <div className="text-muted-foreground text-xs">{record.manufacturer}</div>
                                            {record.locations.length > 0 && (
                                                <div className="text-muted-foreground mt-0.5 text-xs">
                                                    {record.locations.map((l) => l.name).join(', ')}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className={`px-3 text-xs font-medium ${expired ? 'text-red-600' : ''}`}>
                                            {formatDate(record.expires_at)}
                                            {expired && <span className="ml-1 text-[10px]">(Expired)</span>}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-[200px] truncate px-3 text-xs">
                                            {record.description || '—'}
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <div className="flex flex-wrap gap-1">
                                                {(record.hazard_classifications ?? []).map((h) => (
                                                    <Badge key={h} variant="outline" className="text-[10px]">
                                                        {h}
                                                    </Badge>
                                                ))}
                                                {(!record.hazard_classifications || record.hazard_classifications.length === 0) && (
                                                    <span className="text-muted-foreground text-xs">—</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <div className="flex flex-col gap-0.5">
                                                {otherFiles.map((f) => (
                                                    <a
                                                        key={f.id}
                                                        href={`/sds/${record.id}/files/${f.id}`}
                                                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                                                    >
                                                        <FileText size={10} />
                                                        {f.file_name}
                                                    </a>
                                                ))}
                                                {otherFiles.length === 0 && <span className="text-muted-foreground text-xs">—</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-3">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                        <MoreVertical size={14} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <a href={`/sds/${record.id}/download`}>
                                                            <Download className="mr-2 h-3.5 w-3.5" />
                                                            Download SDS
                                                        </a>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => openEdit(record)}>
                                                        <Pencil className="mr-2 h-3.5 w-3.5" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteId(record.id)}>
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {sds.data.length > 0 && <PaginationComponent pagination={sds as PaginationData} />}
            </div>

            {/* Create / Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="sm:max-w-lg p-0">
                    <DialogHeader className="px-6 pt-6 pb-0">
                        <DialogTitle>{editingId ? 'Edit SDS' : 'Add SDS'}</DialogTitle>
                    </DialogHeader>

                    <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-4">
                        {/* Product Name */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-sm font-semibold">Product name</Label>
                            <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} />
                        </div>

                        {/* Manufacturer */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-sm font-semibold">Manufacturer</Label>
                            <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Description</Label>
                                <span className="text-muted-foreground text-xs">Optional</span>
                            </div>
                            <Textarea
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        {/* Hazard Classification — multi-select list */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Hazard classification</Label>
                                <span className="text-muted-foreground text-xs">Optional</span>
                            </div>
                            {form.hazard_classifications.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {form.hazard_classifications.map((h) => (
                                        <Badge key={h} variant="secondary" className="gap-1 text-xs">
                                            {h}
                                            <button onClick={() => toggleHazard(h)} className="hover:text-destructive ml-0.5">
                                                <X size={10} />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <div className="rounded-md border">
                                <div className="border-b px-3 py-2">
                                    <span className="text-muted-foreground text-sm">Select hazard classification</span>
                                </div>
                                <div className="max-h-[140px] overflow-y-auto">
                                    {hazardClassifications.map((h) => (
                                        <label
                                            key={h}
                                            className="hover:bg-accent flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.hazard_classifications.includes(h)}
                                                onChange={() => toggleHazard(h)}
                                                className="rounded border-gray-300"
                                            />
                                            {h}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Expiry Date */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-sm font-semibold">Expiry date</Label>
                            <Input
                                type="date"
                                value={form.expires_at ? format(form.expires_at, 'yyyy-MM-dd') : ''}
                                onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value) : undefined })}
                            />
                        </div>

                        {/* Locations */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Projects / Locations</Label>
                                <span className="text-muted-foreground text-xs">Optional</span>
                            </div>
                            {form.location_ids.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {form.location_ids.map((id) => {
                                        const loc = locations.find((l) => l.id === id);
                                        return loc ? (
                                            <Badge key={id} variant="secondary" className="gap-1 text-xs">
                                                {loc.name}
                                                <button
                                                    onClick={() => setForm((prev) => ({ ...prev, location_ids: prev.location_ids.filter((lid) => lid !== id) }))}
                                                    className="hover:text-destructive ml-0.5"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </Badge>
                                        ) : null;
                                    })}
                                </div>
                            )}
                            <div className="rounded-md border">
                                <div className="border-b px-3 py-2">
                                    <span className="text-muted-foreground text-sm">Select locations to apply this SDS</span>
                                </div>
                                <div className="max-h-[140px] overflow-y-auto">
                                    {locations.map((loc) => (
                                        <label
                                            key={loc.id}
                                            className="hover:bg-accent flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form.location_ids.includes(loc.id)}
                                                onChange={() =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        location_ids: prev.location_ids.includes(loc.id)
                                                            ? prev.location_ids.filter((lid) => lid !== loc.id)
                                                            : [...prev.location_ids, loc.id],
                                                    }))
                                                }
                                                className="rounded border-gray-300"
                                            />
                                            {loc.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SDS File */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-sm font-semibold">SDS file</Label>
                            {form.sds_file ? (
                                <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                                    <FileText size={16} className="text-muted-foreground shrink-0" />
                                    <span className="flex-1 truncate text-sm">{form.sds_file.name}</span>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setForm({ ...form, sds_file: null })}>
                                        <X size={14} />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {editingId && <p className="text-muted-foreground text-xs">Current file will be kept. Drop a new file to replace.</p>}
                                    <Dropzone onDrop={(files) => files.length > 0 && setForm({ ...form, sds_file: files[0] })} maxFiles={1} multiple={false} />
                                </>
                            )}
                        </div>

                        {/* Other Files */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">Other files</Label>
                                <span className="text-muted-foreground text-xs">Optional</span>
                            </div>
                            {editingMedia.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    {editingMedia.map((f) => (
                                        <div key={f.id} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${form.remove_other_files.includes(f.id) ? 'line-through opacity-50' : ''}`}>
                                            <FileText size={14} className="text-muted-foreground shrink-0" />
                                            <span className="flex-1 truncate">{f.file_name}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-red-500"
                                                onClick={() =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        remove_other_files: prev.remove_other_files.includes(f.id)
                                                            ? prev.remove_other_files.filter((id) => id !== f.id)
                                                            : [...prev.remove_other_files, f.id],
                                                    }))
                                                }
                                            >
                                                {form.remove_other_files.includes(f.id) ? <Plus size={12} /> : <X size={12} />}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {form.other_files.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    {form.other_files.map((f, idx) => (
                                        <div key={idx} className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                                            <FileText size={14} className="text-muted-foreground shrink-0" />
                                            <span className="flex-1 truncate">{f.name}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => setForm((prev) => ({ ...prev, other_files: prev.other_files.filter((_, i) => i !== idx) }))}
                                            >
                                                <X size={12} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Dropzone
                                onDrop={(files) => setForm((prev) => ({ ...prev, other_files: [...prev.other_files, ...files] }))}
                                multiple={true}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 border-t px-6 py-4">
                        <Button
                            onClick={handleSubmit}
                            disabled={submitting || !form.product_name || !form.manufacturer || !form.expires_at || (!editingId && !form.sds_file)}
                        >
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingId ? 'Update SDS' : 'Create SDS'}
                        </Button>
                        <Button variant="link" onClick={() => setShowDialog(false)} disabled={submitting}>
                            Cancel
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Public QR Dialog */}
            <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5" />
                            Public SDS Register QR
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-2">
                        <p className="text-muted-foreground text-center text-sm">
                            Print this QR code and post it on site. Anyone who scans it can view and download SDS files without logging in.
                        </p>
                        <div className="rounded-xl border-2 border-primary/20 bg-white p-4 shadow-lg shadow-primary/5">
                            <QRCodeSVG id="sds-public-qr" value={publicUrl} size={240} level="M" includeMargin={false} />
                        </div>
                        <div className="w-full rounded-lg bg-muted/50 p-3">
                            <p className="text-muted-foreground text-center text-xs break-all">{publicUrl}</p>
                        </div>
                        <div className="flex w-full gap-2">
                            <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => { navigator.clipboard.writeText(publicUrl); }}>
                                <FileText className="h-4 w-4" />
                                Copy Link
                            </Button>
                            <Button size="sm" className="flex-1 gap-2" onClick={handlePrintQr}>
                                <Printer className="h-4 w-4" />
                                Print
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete SDS Record</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground text-sm">Are you sure you want to delete this SDS record? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
