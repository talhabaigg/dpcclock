import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchSelect } from '@/components/search-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import {
    AlertCircle, Calendar, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
    Coffee, CreditCard, DollarSign, Download, ExternalLink, Eye, FileText, Filter, Fuel,
    Hammer, Loader2, Package, Pencil, Plane, Receipt, Send, ShoppingBag, Sparkles, Trash2, User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ────────────────────────────────────────────────────────────────────────── */

interface UserType {
    id: number;
    name: string;
}

interface PremierVendorType {
    id: number;
    premier_vendor_id: string;
    code: string;
    name: string;
}

interface PremierGlAccountType {
    id: number;
    premier_account_id: string;
    account_number: string;
    description: string | null;
}

interface ReceiptType {
    id: number;
    user_id: number;
    user: UserType & { premier_vendor_id?: number | null };
    merchant_name: string | null;
    merchant_website: string | null;
    merchant_logo_url: string | null;
    total_amount: string | null;
    gst_amount: string | null;
    currency: string;
    transaction_date: string | null;
    card_last_four: string | null;
    category: string | null;
    description: string | null;
    extraction_status: 'pending' | 'completed' | 'failed';
    is_reconciled: boolean;
    premier_invoice_id: string | null;
    invoice_status: string | null;
    gl_account_id: number | null;
    mime_type?: string;
    image_url: string;
    processed_image_url?: string;
    created_at: string;
}

interface Filters {
    date_from?: string;
    date_to?: string;
    amount_min?: string;
    amount_max?: string;
    user_id?: string;
    category?: string;
    search?: string;
    status?: string;
}

type StatusTab = 'pending' | 'sent' | 'failed' | 'all';

interface Props {
    receipts: { data: ReceiptType[] } & PaginationData;
    filters: Filters;
    statusCounts: Record<StatusTab, number>;
    categories: string[];
    users: UserType[];
    vendors: PremierVendorType[];
    glAccounts: PremierGlAccountType[];
}

/* ──────────────────────────────────────────────────────────────────────────
   Pure helpers (module scope — stable across renders)
   ────────────────────────────────────────────────────────────────────────── */

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Manage Receipts', href: '/manage-receipts' }];

const formatAmount = (value: string | null, currency: string = 'AUD') => {
    if (!value) return '—';
    const formatted = `$${parseFloat(value).toFixed(2)}`;
    return currency !== 'AUD' ? `${formatted} ${currency}` : formatted;
};

const formatDate = (value: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const CATEGORY_COLOR: Record<string, string> = {
    fuel: 'bg-orange-100 text-orange-700',
    food: 'bg-green-100 text-green-700',
    meals: 'bg-green-100 text-green-700',
    office: 'bg-blue-100 text-blue-700',
    travel: 'bg-purple-100 text-purple-700',
    tools: 'bg-amber-100 text-amber-700',
    materials: 'bg-rose-100 text-rose-700',
    other: 'bg-gray-100 text-gray-600',
};

const getCategoryColor = (category: string | null) =>
    (category && CATEGORY_COLOR[category]) || 'bg-gray-100 text-gray-600';

/* ──────────────────────────────────────────────────────────────────────────
   Pure presentational components (module scope)
   ────────────────────────────────────────────────────────────────────────── */

function CategoryIcon({ category, className = 'h-4 w-4' }: { category: string | null; className?: string }) {
    switch (category) {
        case 'fuel': return <Fuel className={className} />;
        case 'materials': return <Package className={className} />;
        case 'meals': return <Coffee className={className} />;
        case 'travel': return <Plane className={className} />;
        case 'tools': return <Hammer className={className} />;
        case 'office': return <ShoppingBag className={className} />;
        default: return <Receipt className={className} />;
    }
}

function MerchantLogo({ receipt, size = 'sm' }: { receipt: ReceiptType; size?: 'sm' | 'lg' }) {
    const [imgError, setImgError] = useState(false);
    const dim = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
    const iconCls = size === 'lg' ? 'h-5 w-5 text-muted-foreground' : 'h-4 w-4 text-muted-foreground';

    if (receipt.merchant_logo_url && !imgError) {
        return (
            <img
                src={receipt.merchant_logo_url}
                alt=""
                className={`${dim} shrink-0 rounded-md object-contain`}
                onError={() => setImgError(true)}
            />
        );
    }

    return (
        <div className={`${dim} shrink-0 rounded-md bg-muted flex items-center justify-center`}>
            <CategoryIcon category={receipt.category} className={iconCls} />
        </div>
    );
}

/** Single source of truth for every status pill on the page. */
function StatusPill({
    tone,
    icon,
    children,
}: {
    tone: 'yellow' | 'green' | 'red' | 'blue' | 'emerald' | 'gray';
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    const tones: Record<string, string> = {
        yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        red: 'bg-red-50 text-red-700 border-red-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        gray: 'bg-muted text-muted-foreground border-border',
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium leading-4 ${tones[tone]}`}>
            {icon}
            {children}
        </span>
    );
}

/** Renders all relevant status pills for a receipt — used in both row header and details. */
function StatusPills({ receipt }: { receipt: ReceiptType }) {
    return (
        <>
            {receipt.extraction_status === 'pending' && (
                <StatusPill tone="yellow" icon={<Loader2 className="h-3 w-3 animate-spin" />}>Extracting</StatusPill>
            )}
            {receipt.extraction_status === 'failed' && (
                <StatusPill tone="red" icon={<AlertCircle className="h-3 w-3" />}>Extraction failed</StatusPill>
            )}
            {receipt.invoice_status === 'processing' && (
                <StatusPill tone="yellow" icon={<Loader2 className="h-3 w-3 animate-spin" />}>Sending</StatusPill>
            )}
            {receipt.invoice_status === 'success' && (
                <StatusPill tone="blue" icon={<Send className="h-3 w-3" />}>Sent to Premier</StatusPill>
            )}
            {receipt.invoice_status === 'failed' && (
                <StatusPill tone="red" icon={<AlertCircle className="h-3 w-3" />}>Send failed</StatusPill>
            )}
            {receipt.is_reconciled && !receipt.invoice_status && (
                <StatusPill tone="emerald" icon={<Check className="h-3 w-3" />}>Reconciled</StatusPill>
            )}
            {receipt.extraction_status === 'completed'
                && !receipt.invoice_status
                && !receipt.is_reconciled
                && <StatusPill tone="green" icon={<CheckCircle2 className="h-3 w-3" />}>Ready</StatusPill>
            }
        </>
    );
}

function CategoryPill({ category }: { category: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium capitalize leading-4 ${getCategoryColor(category)}`}>
            {category}
        </span>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
   PDF viewer (canvas-based, sidesteps browser PDF settings)
   ────────────────────────────────────────────────────────────────────────── */

function PdfCanvasViewer({ url }: { url: string }) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const task = getDocument(url);
        setLoading(true);
        setError(null);
        setDoc(null);
        setPage(1);

        task.promise
            .then((pdf) => { if (!cancelled) setDoc(pdf); })
            .catch(() => { if (!cancelled) setError('PDF preview could not be loaded.'); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; task.destroy(); };
    }, [url]);

    useEffect(() => {
        if (!doc || !canvasRef.current) return;
        let cancelled = false;
        (async () => {
            const p = await doc.getPage(page);
            if (cancelled || !canvasRef.current) return;
            const viewport = p.getViewport({ scale: 1.5 });
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await p.render({ canvas, canvasContext: ctx, viewport }).promise;
        })().catch(() => { if (!cancelled) setError('Failed to render PDF page.'); });
        return () => { cancelled = true; };
    }, [doc, page]);

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center min-h-[480px]">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground min-h-[480px] p-6">
                <FileText className="h-10 w-10" />
                <p className="text-sm">{error ?? 'PDF preview unavailable.'}</p>
                <Button variant="outline" size="sm" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Open in new tab
                    </a>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col min-h-0">
            <div className="flex h-9 items-center justify-between gap-2 border-b bg-background px-3 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{doc.numPages} page{doc.numPages !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page">
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-xs tabular-nums text-muted-foreground w-10 text-center select-none">{page} / {doc.numPages}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage((p) => Math.min(doc.numPages, p + 1))} disabled={page >= doc.numPages} aria-label="Next page">
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <span className="mx-1 h-4 w-px bg-border" />
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" asChild>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />Open
                        </a>
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted/20 p-3" style={{ minHeight: 0 }}>
                <canvas ref={canvasRef} className="mx-auto block h-auto max-w-full rounded-sm bg-white shadow-sm" />
            </div>
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────────────────────────── */

export default function ManageReceipts({ receipts, filters, statusCounts, categories, users, vendors, glAccounts }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [editingReceipt, setEditingReceipt] = useState<ReceiptType | null>(null);
    const [deletingReceipt, setDeletingReceipt] = useState<ReceiptType | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState<Record<number, { vendor_id: string; gl_account_id: string }>>({});
    const [showProcessedImage, setShowProcessedImage] = useState<Record<number, boolean>>({});
    const [localFilters, setLocalFilters] = useState<Filters>(filters);
    const activeStatus: StatusTab = (filters.status as StatusTab) || 'pending';

    const switchStatus = (status: StatusTab) => {
        const params = { ...filters, status };
        router.get('/manage-receipts', Object.fromEntries(Object.entries(params).filter(([, v]) => v)), { preserveState: true });
    };

    const [editForm, setEditForm] = useState({
        merchant_name: '',
        total_amount: '',
        gst_amount: '',
        currency: 'AUD',
        transaction_date: '',
        card_last_four: '',
        category: '',
        description: '',
    });

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    useEffect(() => {
        const hasPending = receipts.data.some((r) => r.extraction_status === 'pending' || r.invoice_status === 'processing');
        if (!hasPending) return;
        const interval = setInterval(() => { router.reload({ only: ['receipts'] }); }, 5000);
        return () => clearInterval(interval);
    }, [receipts.data]);

    // Auto-select first receipt on initial mount or when current selection drops out of the page.
    useEffect(() => {
        if (receipts.data.length === 0) return;
        const stillVisible = expandedId !== null && receipts.data.some((r) => r.id === expandedId);
        if (!stillVisible) {
            const first = receipts.data[0];
            setExpandedId(first.id);
            primeReceiptForms(first);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [receipts.data]);

    const primeReceiptForms = (receipt: ReceiptType) => {
        setInvoiceForm((prev) => ({
            ...prev,
            [receipt.id]: prev[receipt.id] || {
                vendor_id: receipt.user?.premier_vendor_id ? String(receipt.user.premier_vendor_id) : '',
                gl_account_id: receipt.gl_account_id ? String(receipt.gl_account_id) : '',
            },
        }));
        setShowProcessedImage((prev) => ({
            ...prev,
            [receipt.id]: prev[receipt.id] ?? !!receipt.processed_image_url,
        }));
    };

    const toggleExpand = (receipt: ReceiptType) => {
        if (expandedId === receipt.id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(receipt.id);
        primeReceiptForms(receipt);
    };

    const openEditDialog = (receipt: ReceiptType) => {
        setEditingReceipt(receipt);
        setEditForm({
            merchant_name: receipt.merchant_name || '',
            total_amount: receipt.total_amount || '',
            gst_amount: receipt.gst_amount || '',
            currency: receipt.currency || 'AUD',
            transaction_date: receipt.transaction_date || '',
            card_last_four: receipt.card_last_four || '',
            category: receipt.category || '',
            description: receipt.description || '',
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingReceipt) return;
        setIsSubmitting(true);
        router.put(`/manage-receipts/${editingReceipt.id}`, {
            ...editForm,
            total_amount: editForm.total_amount ? parseFloat(editForm.total_amount) : null,
            gst_amount: editForm.gst_amount ? parseFloat(editForm.gst_amount) : null,
            category: editForm.category || null,
        }, {
            onSuccess: () => { setEditingReceipt(null); setIsSubmitting(false); },
            onError: () => setIsSubmitting(false),
        });
    };

    const handleDelete = () => {
        if (!deletingReceipt) return;
        setIsSubmitting(true);
        router.delete(`/manage-receipts/${deletingReceipt.id}`, {
            onSuccess: () => {
                if (expandedId === deletingReceipt.id) setExpandedId(null);
                setDeletingReceipt(null);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    const handleCreateInvoice = (receipt: ReceiptType) => {
        const form = invoiceForm[receipt.id];
        if (!form) return;
        setIsSubmitting(true);
        router.post(`/manage-receipts/${receipt.id}/create-invoice`, {
            vendor_id: form.vendor_id ? parseInt(form.vendor_id) : null,
            gl_account_id: form.gl_account_id ? parseInt(form.gl_account_id) : null,
        }, {
            onSuccess: () => setIsSubmitting(false),
            onError: () => setIsSubmitting(false),
        });
    };

    const applyFilters = () => {
        const params = { ...localFilters, status: activeStatus };
        router.get('/manage-receipts', Object.fromEntries(Object.entries(params).filter(([, v]) => v)), { preserveState: true });
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setLocalFilters({});
        router.get('/manage-receipts', { status: activeStatus }, { preserveState: true });
        setIsFilterOpen(false);
    };

    const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'status').length;

    /* ── Invoice fields (closure-bound — kept inside component) ── */
    const InvoiceFields = ({ receipt, failed = false }: { receipt: ReceiptType; failed?: boolean }) => {
        const form = invoiceForm[receipt.id] || { vendor_id: '', gl_account_id: '' };
        const setForm = (patch: Partial<typeof form>) =>
            setInvoiceForm((prev) => ({ ...prev, [receipt.id]: { ...form, ...patch } }));

        return (
            <div className="space-y-2.5">
                <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">CC Vendor</Label>
                    <SearchSelect
                        options={vendors.map((v) => ({ value: String(v.id), label: `${v.code} — ${v.name}` }))}
                        optionName="vendor"
                        selectedOption={form.vendor_id}
                        onValueChange={(value) => setForm({ vendor_id: value })}
                    />
                </div>
                <div>
                    <Label className="mb-1 block text-xs font-medium text-muted-foreground">GL Account</Label>
                    <SearchSelect
                        options={glAccounts.map((a) => ({ value: String(a.id), label: `${a.account_number}${a.description ? ` — ${a.description}` : ''}` }))}
                        optionName="GL account"
                        selectedOption={form.gl_account_id}
                        onValueChange={(value) => setForm({ gl_account_id: value })}
                    />
                </div>
                <Button
                    size="sm"
                    variant={failed ? 'destructive' : 'default'}
                    className="w-full"
                    disabled={isSubmitting || !form.vendor_id || !form.gl_account_id}
                    onClick={() => handleCreateInvoice(receipt)}
                >
                    {isSubmitting
                        ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending…</>
                        : <><Send className="mr-1.5 h-3.5 w-3.5" />{failed ? 'Retry send' : 'Approve & send to Premier'}</>
                    }
                </Button>
            </div>
        );
    };

    /* ── Attachment viewer (image or PDF) ── */
    const ImageViewer = ({ receipt, className = '' }: { receipt: ReceiptType; className?: string }) => {
        const showProcessed = showProcessedImage[receipt.id] ?? !!receipt.processed_image_url;
        const viewerImageUrl = showProcessed && receipt.processed_image_url ? receipt.processed_image_url : receipt.image_url;
        const isPdf = receipt.mime_type === 'application/pdf';

        if (isPdf) {
            return (
                <div className={`bg-muted/30 flex flex-col ${className}`}>
                    <PdfCanvasViewer url={receipt.image_url} />
                </div>
            );
        }

        return (
            <div className={`relative bg-muted/30 flex items-center justify-center p-4 ${className}`}>
                {viewerImageUrl ? (
                    <img
                        src={viewerImageUrl}
                        alt={receipt.merchant_name ?? 'Receipt'}
                        className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Receipt className="h-10 w-10" />
                        <p className="text-sm">No image available</p>
                    </div>
                )}
                {receipt.processed_image_url && (
                    <div className="absolute right-3 top-3">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 gap-1.5 rounded-full text-xs shadow-md"
                            onClick={() => setShowProcessedImage((prev) => ({ ...prev, [receipt.id]: !showProcessed }))}
                        >
                            {showProcessed ? <><Eye className="h-3.5 w-3.5" />Original</> : <><Sparkles className="h-3.5 w-3.5" />Enhanced</>}
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    /* ── A row in the master list ── */
    const ReceiptRow = ({ receipt }: { receipt: ReceiptType }) => {
        const isExpanded = expandedId === receipt.id;
        const isPending = receipt.extraction_status === 'pending';
        const metaParts = [
            receipt.user?.name,
            receipt.transaction_date && formatDate(receipt.transaction_date),
            receipt.card_last_four && `•••• ${receipt.card_last_four}`,
        ].filter(Boolean);

        return (
            <div className={`border-b transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}>
                {/* Header — always visible */}
                <button
                    type="button"
                    onClick={() => toggleExpand(receipt)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-4"
                    aria-expanded={isExpanded}
                >
                    <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                    />
                    <MerchantLogo receipt={receipt} />
                    <div className="min-w-0 flex-1">
                        {isPending ? (
                            <div className="flex items-center gap-1.5">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                <span className="text-sm italic text-muted-foreground">Extracting…</span>
                            </div>
                        ) : (
                            <p className="truncate text-sm font-semibold text-foreground">
                                {receipt.merchant_name || 'Unknown merchant'}
                            </p>
                        )}
                        {metaParts.length > 0 && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {metaParts.join(' · ')}
                            </p>
                        )}
                    </div>
                    {/* Pills cluster — hidden on mobile to save space; shown in details when expanded */}
                    <div className="hidden shrink-0 items-center gap-1 sm:flex">
                        {receipt.category && <CategoryPill category={receipt.category} />}
                        <StatusPills receipt={receipt} />
                    </div>
                    <p className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                        {formatAmount(receipt.total_amount, receipt.currency)}
                    </p>
                </button>

                {/* Expanded details — shown inline below the header */}
                {isExpanded && (
                    <div className="px-3 pb-4 sm:px-4">
                        {/* Mobile-only inline image viewer (desktop uses the right pane) */}
                        <div className="mb-3 overflow-hidden rounded-lg border bg-background lg:hidden">
                            <ImageViewer receipt={receipt} className="h-[480px]" />
                        </div>

                        <div className="space-y-3 rounded-lg border bg-background p-4">
                            {/* Status pills (mobile shows them here since they're hidden in the row) */}
                            <div className="flex flex-wrap gap-1.5 sm:hidden">
                                {receipt.category && <CategoryPill category={receipt.category} />}
                                <StatusPills receipt={receipt} />
                            </div>

                            {/* Key/value grid */}
                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <Detail icon={<DollarSign className="h-3.5 w-3.5" />} label="Total">
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {formatAmount(receipt.total_amount, receipt.currency)}
                                    </span>
                                </Detail>
                                <Detail label="GST">
                                    <span className="font-medium text-foreground tabular-nums">
                                        {formatAmount(receipt.gst_amount, receipt.currency)}
                                    </span>
                                </Detail>
                                <Detail icon={<Calendar className="h-3.5 w-3.5" />} label="Date">
                                    {formatDate(receipt.transaction_date)}
                                </Detail>
                                <Detail icon={<User className="h-3.5 w-3.5" />} label="Employee">
                                    <span className="truncate">{receipt.user?.name ?? '—'}</span>
                                </Detail>
                                {receipt.card_last_four && (
                                    <Detail icon={<CreditCard className="h-3.5 w-3.5" />} label="Card">
                                        •••• {receipt.card_last_four}
                                    </Detail>
                                )}
                            </dl>

                            {receipt.description && (
                                <p className="border-t pt-3 text-sm text-muted-foreground">{receipt.description}</p>
                            )}

                            {receipt.extraction_status === 'completed' && !receipt.premier_invoice_id && (
                                <div className="border-t pt-3">
                                    <InvoiceFields receipt={receipt} />
                                </div>
                            )}
                            {receipt.invoice_status === 'failed' && (
                                <div className="border-t pt-3">
                                    <InvoiceFields receipt={receipt} failed />
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 border-t pt-3">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(receipt)}>
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => setDeletingReceipt(receipt)}
                                >
                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const selectedReceipt = receipts.data.find((r) => r.id === expandedId) ?? null;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Manage Receipts" />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Top bar */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
                    <div className="flex items-center gap-0.5 overflow-x-auto rounded-lg border bg-muted/40 p-0.5">
                        {([
                            { key: 'pending', label: 'Pending' },
                            { key: 'sent', label: 'Sent' },
                            { key: 'failed', label: 'Failed' },
                            { key: 'all', label: 'All' },
                        ] as { key: StatusTab; label: string }[]).map(({ key, label }) => {
                            const isActive = activeStatus === key;
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => switchStatus(key)}
                                    aria-pressed={isActive}
                                    className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        isActive
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {label}
                                    {statusCounts[key] > 0 && (
                                        <span className={`inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${
                                            isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                        }`}>
                                            {statusCounts[key]}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setIsFilterOpen(true)}>
                        <Filter className="mr-1.5 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full" asChild>
                        <a href={`/manage-receipts/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`}>
                            <Download className="mr-1.5 h-4 w-4" />
                            Export
                        </a>
                    </Button>
                    <span className="ml-auto shrink-0 text-sm tabular-nums text-muted-foreground">
                        {receipts.total} receipt{receipts.total !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Master/detail body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left pane — receipt list */}
                    <div className="flex flex-1 flex-col overflow-y-auto lg:flex-none lg:w-[480px] lg:border-r xl:w-[560px]">
                        {receipts.data.length === 0 ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                    <Receipt className="h-7 w-7 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">No receipts found</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Try a different status or clear the filters.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            receipts.data.map((receipt) => <ReceiptRow key={receipt.id} receipt={receipt} />)
                        )}
                        {receipts.last_page > 1 && (
                            <div className="border-t p-3">
                                <PaginationComponent pagination={receipts} />
                            </div>
                        )}
                    </div>

                    {/* Right pane — attachment viewer (desktop only) */}
                    <div className="hidden flex-1 overflow-hidden bg-muted/20 lg:flex">
                        {selectedReceipt ? (
                            <ImageViewer receipt={selectedReceipt} className="h-full flex-1" />
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm">
                                    <Receipt className="h-7 w-7 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">No receipt selected</p>
                                    <p className="mt-0.5 text-xs">Pick one from the list to view its attachment.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingReceipt} onOpenChange={(open) => !open && setEditingReceipt(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit receipt</DialogTitle>
                        <DialogDescription>Update the receipt details.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="merchant_name">Merchant</Label>
                                    <Input id="merchant_name" value={editForm.merchant_name} onChange={(e) => setEditForm({ ...editForm, merchant_name: e.target.value })} placeholder="Business name" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="total_amount">Total amount ($)</Label>
                                    <Input id="total_amount" type="number" step="0.01" min="0" value={editForm.total_amount} onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })} placeholder="0.00" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="gst_amount">GST amount ($)</Label>
                                    <Input id="gst_amount" type="number" step="0.01" min="0" value={editForm.gst_amount} onChange={(e) => setEditForm({ ...editForm, gst_amount: e.target.value })} placeholder="0.00" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Input id="currency" maxLength={3} value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase().slice(0, 3) })} placeholder="AUD" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="transaction_date">Transaction date</Label>
                                    <DatePicker id="transaction_date" value={editForm.transaction_date} onChange={(value) => setEditForm({ ...editForm, transaction_date: value })} clearable />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="card_last_four">Card last 4 digits</Label>
                                    <Input id="card_last_four" maxLength={4} value={editForm.card_last_four} onChange={(e) => setEditForm({ ...editForm, card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="1234" />
                                </div>
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={editForm.category} onValueChange={(value) => setEditForm({ ...editForm, category: value })}>
                                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                        <SelectContent>{categories.map((cat) => <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="description">Notes</Label>
                                    <Textarea id="description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Optional notes about this purchase" rows={2} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setEditingReceipt(null)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Update'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={!!deletingReceipt} onOpenChange={(open) => !open && setDeletingReceipt(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete receipt</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this receipt{deletingReceipt?.merchant_name ? ` from "${deletingReceipt.merchant_name}"` : ''}? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingReceipt(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? 'Deleting…' : 'Delete'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Filters Dialog */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Filter receipts</DialogTitle>
                        <DialogDescription>Narrow down receipts by date, amount, or other criteria.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Merchant search</Label>
                            <Input value={localFilters.search || ''} onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })} placeholder="Search by merchant name" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Date from</Label>
                                <DatePicker value={localFilters.date_from || ''} onChange={(value) => setLocalFilters({ ...localFilters, date_from: value })} clearable />
                            </div>
                            <div className="grid gap-2">
                                <Label>Date to</Label>
                                <DatePicker value={localFilters.date_to || ''} onChange={(value) => setLocalFilters({ ...localFilters, date_to: value })} clearable />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Min amount ($)</Label>
                                <Input type="number" step="0.01" min="0" value={localFilters.amount_min || ''} onChange={(e) => setLocalFilters({ ...localFilters, amount_min: e.target.value })} placeholder="0.00" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Max amount ($)</Label>
                                <Input type="number" step="0.01" min="0" value={localFilters.amount_max || ''} onChange={(e) => setLocalFilters({ ...localFilters, amount_max: e.target.value })} placeholder="0.00" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <Select value={localFilters.category || ''} onValueChange={(value) => setLocalFilters({ ...localFilters, category: value })}>
                                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                                <SelectContent>{categories.map((cat) => <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Employee</Label>
                            <Select value={localFilters.user_id || ''} onValueChange={(value) => setLocalFilters({ ...localFilters, user_id: value })}>
                                <SelectTrigger><SelectValue placeholder="All employees" /></SelectTrigger>
                                <SelectContent>{users.map((user) => <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={clearFilters}>Clear all</Button>
                        <Button onClick={applyFilters}>Apply filters</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

/* ──────────────────────────────────────────────────────────────────────────
   Local helpers
   ────────────────────────────────────────────────────────────────────────── */

function Detail({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="flex min-w-0 items-center gap-1.5">
            {icon ? (
                <span className="text-muted-foreground" aria-hidden>{icon}</span>
            ) : (
                <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground" aria-hidden>{label}</span>
            )}
            <span className="sr-only">{label}: </span>
            <span className="min-w-0 truncate text-foreground">{children}</span>
        </div>
    );
}
