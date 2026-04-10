import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchSelect } from '@/components/search-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Calendar, Check, CreditCard, Coffee, Download, Eye, FileText, Fuel, Hammer, Loader2, AlertCircle, CheckCircle2, Package, Pencil, Plane, Send, Sparkles, Trash2, User, Receipt, Filter, DollarSign, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Manage Receipts', href: '/manage-receipts' },
];

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
    show_reconciled?: string;
}

interface Props {
    receipts: {
        data: ReceiptType[];
    } & PaginationData;
    filters: Filters;
    categories: string[];
    users: UserType[];
    vendors: PremierVendorType[];
    glAccounts: PremierGlAccountType[];
}

export default function ManageReceipts({ receipts, filters, categories, users, vendors, glAccounts }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptType | null>(null);
    const [mobileViewerOpen, setMobileViewerOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [invoiceForm, setInvoiceForm] = useState({ vendor_id: '', gl_account_id: '' });
    const [showProcessedImage, setShowProcessedImage] = useState(true);
    const [localFilters, setLocalFilters] = useState<Filters>(filters);

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
        const hasPending = receipts.data.some((r) => r.extraction_status === 'pending');
        if (!hasPending) return;
        const interval = setInterval(() => { router.reload({ only: ['receipts'] }); }, 5000);
        return () => clearInterval(interval);
    }, [receipts.data]);

    const syncInvoiceForm = (receipt: ReceiptType) => {
        setInvoiceForm({
            vendor_id: receipt.user?.premier_vendor_id ? String(receipt.user.premier_vendor_id) : '',
            gl_account_id: receipt.gl_account_id ? String(receipt.gl_account_id) : '',
        });
    };

    // Auto-select first receipt on desktop
    useEffect(() => {
        if (!selectedReceipt && receipts.data.length > 0) {
            setSelectedReceipt(receipts.data[0]);
            syncInvoiceForm(receipts.data[0]);
        }
    }, [receipts.data]);

    // Keep selected receipt in sync after reload
    useEffect(() => {
        if (selectedReceipt) {
            const updated = receipts.data.find(r => r.id === selectedReceipt.id);
            if (updated) {
                setSelectedReceipt(updated);
                syncInvoiceForm(updated);
            }
        }
    }, [receipts.data]);

    const selectReceipt = (receipt: ReceiptType) => {
        setSelectedReceipt(receipt);
        setShowProcessedImage(!!receipt.processed_image_url);
        syncInvoiceForm(receipt);
        setMobileViewerOpen(true);
    };

    const openEditDialog = () => {
        if (!selectedReceipt) return;
        setEditForm({
            merchant_name: selectedReceipt.merchant_name || '',
            total_amount: selectedReceipt.total_amount || '',
            gst_amount: selectedReceipt.gst_amount || '',
            currency: selectedReceipt.currency || 'AUD',
            transaction_date: selectedReceipt.transaction_date || '',
            card_last_four: selectedReceipt.card_last_four || '',
            category: selectedReceipt.category || '',
            description: selectedReceipt.description || '',
        });
        setIsEditOpen(true);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReceipt) return;
        setIsSubmitting(true);
        router.put(`/manage-receipts/${selectedReceipt.id}`, {
            ...editForm,
            total_amount: editForm.total_amount ? parseFloat(editForm.total_amount) : null,
            gst_amount: editForm.gst_amount ? parseFloat(editForm.gst_amount) : null,
            category: editForm.category || null,
        }, {
            onSuccess: () => { setIsEditOpen(false); setIsSubmitting(false); },
            onError: () => setIsSubmitting(false),
        });
    };

    const handleDelete = () => {
        if (!selectedReceipt) return;
        setIsSubmitting(true);
        router.delete(`/manage-receipts/${selectedReceipt.id}`, {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setIsSubmitting(false);
                setSelectedReceipt(null);
                setMobileViewerOpen(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    const handleCreateInvoice = () => {
        if (!selectedReceipt) return;
        setIsSubmitting(true);
        router.post(`/manage-receipts/${selectedReceipt.id}/create-invoice`, {
            vendor_id: invoiceForm.vendor_id ? parseInt(invoiceForm.vendor_id) : null,
            gl_account_id: invoiceForm.gl_account_id ? parseInt(invoiceForm.gl_account_id) : null,
        }, {
            onSuccess: () => setIsSubmitting(false),
            onError: () => setIsSubmitting(false),
        });
    };

    const applyFilters = () => {
        router.get('/manage-receipts', Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v)), { preserveState: true });
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setLocalFilters({});
        router.get('/manage-receipts', {}, { preserveState: true });
        setIsFilterOpen(false);
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    const formatAmount = (value: string | null, currency: string = 'AUD') => {
        if (!value) return '-';
        const formatted = `$${parseFloat(value).toFixed(2)}`;
        return currency !== 'AUD' ? `${formatted} ${currency}` : formatted;
    };

    const formatDate = (value: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getCategoryColor = (category: string | null) => {
        if (!category) return 'bg-gray-100 text-gray-600';
        const colors: Record<string, string> = {
            fuel: 'bg-orange-100 text-orange-700', food: 'bg-green-100 text-green-700', meals: 'bg-green-100 text-green-700',
            office: 'bg-blue-100 text-blue-700', travel: 'bg-purple-100 text-purple-700',
            tools: 'bg-amber-100 text-amber-700', materials: 'bg-rose-100 text-rose-700', other: 'bg-gray-100 text-gray-600',
        };
        return colors[category] || 'bg-gray-100 text-gray-600';
    };

    const CategoryIcon = ({ category, className = 'h-4 w-4' }: { category: string | null; className?: string }) => {
        switch (category) {
            case 'fuel': return <Fuel className={className} />;
            case 'materials': return <Package className={className} />;
            case 'meals': return <Coffee className={className} />;
            case 'travel': return <Plane className={className} />;
            case 'tools': return <Hammer className={className} />;
            case 'office': return <ShoppingBag className={className} />;
            default: return <Receipt className={className} />;
        }
    };

    const MerchantLogo = ({ receipt, size = 'sm' }: { receipt: ReceiptType; size?: 'sm' | 'lg' }) => {
        const [imgError, setImgError] = useState(false);
        const dim = size === 'lg' ? 'h-8 w-8' : 'h-8 w-8';

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
                <CategoryIcon category={receipt.category} className="h-4 w-4 text-muted-foreground" />
            </div>
        );
    };

    const StatusBadge = ({ status }: { status: ReceiptType['extraction_status'] }) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-200 bg-yellow-50"><Loader2 className="h-3 w-3 animate-spin" />Extracting</Badge>;
            case 'completed':
                return <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="h-3 w-3" />Done</Badge>;
            case 'failed':
                return <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50"><AlertCircle className="h-3 w-3" />Failed</Badge>;
        }
    };

    const viewerImageUrl = selectedReceipt
        ? (showProcessedImage && selectedReceipt.processed_image_url ? selectedReceipt.processed_image_url : selectedReceipt.image_url)
        : null;

    // Receipt list item — shared between mobile and desktop
    const ReceiptListItem = ({ receipt }: { receipt: ReceiptType }) => (
        <div
            className={`cursor-pointer border-b px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted/70 ${
                selectedReceipt?.id === receipt.id ? 'bg-muted border-l-2 border-l-primary' : ''
            }`}
            onClick={() => selectReceipt(receipt)}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="mt-0.5">
                    <MerchantLogo receipt={receipt} />
                </div>
                <div className="min-w-0 flex-1">
                    {receipt.extraction_status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                            <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
                            <span className="text-muted-foreground text-sm italic">Extracting...</span>
                        </div>
                    ) : (
                        <p className="truncate text-sm font-semibold">{receipt.merchant_name || 'Unknown Merchant'}</p>
                    )}
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{receipt.user?.name}</span>
                        {receipt.transaction_date && (
                            <><span>·</span><span>{formatDate(receipt.transaction_date)}</span></>
                        )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                        {receipt.category && (
                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${getCategoryColor(receipt.category)}`}>
                                {receipt.category}
                            </span>
                        )}
                        {receipt.extraction_status !== 'completed' && <StatusBadge status={receipt.extraction_status} />}
                        {receipt.invoice_status === 'success' && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                                <Send className="h-2.5 w-2.5" />Sent
                            </span>
                        )}
                        {receipt.invoice_status === 'failed' && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                                <AlertCircle className="h-2.5 w-2.5" />Failed
                            </span>
                        )}
                        {receipt.is_reconciled && !receipt.invoice_status && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                                <Check className="h-2.5 w-2.5" />Reconciled
                            </span>
                        )}
                    </div>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">{formatAmount(receipt.total_amount, receipt.currency)}</p>
            </div>
        </div>
    );

    // Invoice fields — shared between normal and failed states
    const InvoiceFields = ({ failed = false }: { failed?: boolean }) => (
        <div className="space-y-2">
            <div>
                <Label className="text-xs text-muted-foreground mb-1 block">CC Vendor</Label>
                <SearchSelect
                    options={vendors.map((v) => ({ value: String(v.id), label: `${v.code} — ${v.name}` }))}
                    optionName="vendor"
                    selectedOption={invoiceForm.vendor_id}
                    onValueChange={(value) => setInvoiceForm({ ...invoiceForm, vendor_id: value })}
                />
            </div>
            <div>
                <Label className="text-xs text-muted-foreground mb-1 block">GL Account</Label>
                <SearchSelect
                    options={glAccounts.map((a) => ({ value: String(a.id), label: `${a.account_number}${a.description ? ` — ${a.description}` : ''}` }))}
                    optionName="GL account"
                    selectedOption={invoiceForm.gl_account_id}
                    onValueChange={(value) => setInvoiceForm({ ...invoiceForm, gl_account_id: value })}
                />
            </div>
            <Button
                size="sm"
                variant={failed ? 'destructive' : 'default'}
                className="w-full"
                disabled={isSubmitting || !invoiceForm.vendor_id || !invoiceForm.gl_account_id}
                onClick={handleCreateInvoice}
            >
                {isSubmitting
                    ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending...</>
                    : <><Send className="mr-1.5 h-3.5 w-3.5" />{failed ? 'Retry Send' : 'Approve & Send to Premier'}</>
                }
            </Button>
        </div>
    );

    // Viewer content — shared between mobile overlay and desktop panel
    const ViewerContent = ({ compact = false }: { compact?: boolean }) => {
        if (!selectedReceipt) return null;

        const imageViewer = (
            <div className="flex-1 bg-muted/30 flex items-center justify-center overflow-auto p-3 sm:p-4 relative min-h-0">
                {selectedReceipt.mime_type === 'application/pdf' ? (
                    <object
                        data={selectedReceipt.image_url}
                        type="application/pdf"
                        className="h-full w-full rounded-lg border"
                    >
                        <div className="flex flex-col items-center justify-center gap-3 h-full">
                            <FileText className="h-12 w-12 text-muted-foreground" />
                            <p className="text-muted-foreground text-sm">PDF preview not available</p>
                            <Button variant="outline" size="sm" asChild>
                                <a href={selectedReceipt.image_url} target="_blank" rel="noopener noreferrer">Open PDF</a>
                            </Button>
                        </div>
                    </object>
                ) : viewerImageUrl ? (
                    <img
                        src={viewerImageUrl}
                        alt="Receipt"
                        className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Receipt className="h-12 w-12" />
                        <p>No image available</p>
                    </div>
                )}
                {selectedReceipt.processed_image_url && selectedReceipt.mime_type !== 'application/pdf' && (
                    <div className="absolute top-5 right-5">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 rounded-full shadow-md text-xs"
                            onClick={() => setShowProcessedImage(!showProcessedImage)}
                        >
                            {showProcessedImage ? <><Eye className="h-3.5 w-3.5" />Original</> : <><Sparkles className="h-3.5 w-3.5" />Enhanced</>}
                        </Button>
                    </div>
                )}
            </div>
        );

        const detailsPanel = (
            <div className="p-3 space-y-3 overflow-y-auto">
                {/* Header + badges */}
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <MerchantLogo receipt={selectedReceipt} size="lg" />
                        <h3 className={`font-semibold truncate ${compact ? 'text-base' : 'text-lg'}`}>
                            {selectedReceipt.merchant_name || 'Unknown Merchant'}
                        </h3>
                        <StatusBadge status={selectedReceipt.extraction_status} />
                        {selectedReceipt.invoice_status === 'success' && (
                            <Badge className="gap-1 bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">
                                <Send className="h-3 w-3" />Sent to Premier
                            </Badge>
                        )}
                        {selectedReceipt.invoice_status === 'failed' && (
                            <Badge className="gap-1 bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
                                <AlertCircle className="h-3 w-3" />Invoice Failed
                            </Badge>
                        )}
                        {selectedReceipt.is_reconciled && !selectedReceipt.invoice_status && (
                            <Badge className="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                <Check className="h-3 w-3" />Reconciled
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Receipt details */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium text-foreground">{formatAmount(selectedReceipt.total_amount, selectedReceipt.currency)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="text-xs">GST</span>
                        <span className="font-medium text-foreground">{formatAmount(selectedReceipt.gst_amount, selectedReceipt.currency)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>{formatDate(selectedReceipt.transaction_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span>{selectedReceipt.user?.name}</span>
                    </div>
                    {selectedReceipt.card_last_four && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CreditCard className="h-3.5 w-3.5 shrink-0" />
                            <span>****{selectedReceipt.card_last_four}</span>
                        </div>
                    )}
                    {selectedReceipt.category && (
                        <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getCategoryColor(selectedReceipt.category)}`}>
                                {selectedReceipt.category}
                            </span>
                        </div>
                    )}
                </div>
                {selectedReceipt.description && (
                    <p className="text-muted-foreground text-sm">{selectedReceipt.description}</p>
                )}

                {/* Invoice fields */}
                {(selectedReceipt.extraction_status === 'completed' && !selectedReceipt.premier_invoice_id) && (
                    <div className="border-t pt-3">
                        <InvoiceFields />
                    </div>
                )}
                {selectedReceipt.invoice_status === 'failed' && (
                    <div className="border-t pt-3">
                        <InvoiceFields failed />
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap border-t pt-3">
                    <Button variant="outline" size="sm" onClick={openEditDialog}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setIsDeleteOpen(true)}>
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                    </Button>
                </div>
            </div>
        );

        if (compact) {
            // Mobile: vertical stack
            return (
                <>
                    {imageViewer}
                    <div className="border-t bg-background shrink-0">
                        {detailsPanel}
                    </div>
                </>
            );
        }

        // Desktop: horizontal split — image left, details right
        return (
            <div className="flex flex-1 overflow-hidden">
                {imageViewer}
                <div className="w-80 xl:w-96 shrink-0 border-l bg-background overflow-y-auto">
                    {detailsPanel}
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Manage Receipts" />

            {/* ========== DESKTOP LAYOUT (md+) ========== */}
            <div className="hidden md:flex h-[calc(100vh-4rem)] flex-col">
                {/* Top bar */}
                <div className="border-b px-4 py-2 flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setIsFilterOpen(true)}>
                        <Filter className="mr-1.5 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeFilterCount}</Badge>}
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full" asChild>
                        <a href={`/manage-receipts/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`}>
                            <Download className="mr-1.5 h-4 w-4" />
                            Export CSV
                        </a>
                    </Button>
                    <span className="text-muted-foreground ml-auto text-sm">{receipts.total} receipt{receipts.total !== 1 ? 's' : ''}</span>
                </div>

                {/* Split layout */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left panel — receipt list */}
                    <div className="w-80 shrink-0 border-r flex flex-col lg:w-96">
                        <ScrollArea className="flex-1">
                            <div className="flex flex-col">
                                {receipts.data.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                        <Receipt className="text-muted-foreground mb-2 h-8 w-8" />
                                        <p className="text-muted-foreground text-sm">No receipts found</p>
                                    </div>
                                ) : (
                                    receipts.data.map((receipt) => <ReceiptListItem key={receipt.id} receipt={receipt} />)
                                )}
                            </div>
                            {receipts.last_page > 1 && (
                                <div className="p-3">
                                    <PaginationComponent pagination={receipts} />
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Right panel — viewer */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {selectedReceipt ? (
                            <ViewerContent />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                                <Receipt className="h-12 w-12 mb-3" />
                                <p className="text-lg font-medium">Select a receipt</p>
                                <p className="text-sm">Choose a receipt from the list to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ========== MOBILE LAYOUT (< md) ========== */}
            <div className="flex flex-col md:hidden h-[calc(100vh-4rem)]">
                {/* Top bar */}
                <div className="border-b px-3 py-2 flex items-center gap-2 shrink-0 overflow-x-auto">
                    <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setIsFilterOpen(true)}>
                        <Filter className="mr-1.5 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeFilterCount}</Badge>}
                    </Button>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-full" asChild>
                        <a href={`/manage-receipts/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`}>
                            <Download className="mr-1.5 h-4 w-4" />
                            Export
                        </a>
                    </Button>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">{receipts.total} receipt{receipts.total !== 1 ? 's' : ''}</span>
                </div>

                {/* Receipt list */}
                <ScrollArea className="flex-1">
                    <div className="flex flex-col">
                        {receipts.data.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                <Receipt className="text-muted-foreground mb-2 h-8 w-8" />
                                <p className="text-muted-foreground text-sm">No receipts found</p>
                            </div>
                        ) : (
                            receipts.data.map((receipt) => <ReceiptListItem key={receipt.id} receipt={receipt} />)
                        )}
                    </div>
                    {receipts.last_page > 1 && (
                        <div className="p-3">
                            <PaginationComponent pagination={receipts} />
                        </div>
                    )}
                </ScrollArea>

                {/* Mobile viewer overlay */}
                {mobileViewerOpen && selectedReceipt && (
                    <div className="fixed inset-0 z-50 bg-background flex flex-col">
                        {/* Mobile viewer header */}
                        <div className="border-b px-3 py-2 flex items-center gap-3 shrink-0">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0"
                                onClick={() => setMobileViewerOpen(false)}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{selectedReceipt.merchant_name || 'Unknown Merchant'}</p>
                                <p className="text-muted-foreground text-xs">{formatAmount(selectedReceipt.total_amount, selectedReceipt.currency)}</p>
                            </div>
                        </div>
                        <ViewerContent compact />
                    </div>
                )}
            </div>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Receipt</DialogTitle>
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
                                    <Label htmlFor="total_amount">Total Amount ($)</Label>
                                    <Input id="total_amount" type="number" step="0.01" min="0" value={editForm.total_amount} onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })} placeholder="0.00" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="gst_amount">GST Amount ($)</Label>
                                    <Input id="gst_amount" type="number" step="0.01" min="0" value={editForm.gst_amount} onChange={(e) => setEditForm({ ...editForm, gst_amount: e.target.value })} placeholder="0.00" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Input id="currency" maxLength={3} value={editForm.currency} onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase().slice(0, 3) })} placeholder="AUD" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="transaction_date">Transaction Date</Label>
                                    <Input id="transaction_date" type="date" value={editForm.transaction_date} onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="card_last_four">Card Last 4 Digits</Label>
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
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Update'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Receipt</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this receipt{selectedReceipt?.merchant_name ? ` from "${selectedReceipt.merchant_name}"` : ''}? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Filters Dialog */}
            <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Filter Receipts</DialogTitle>
                        <DialogDescription>Narrow down receipts by date, amount, or other criteria.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Merchant Search</Label>
                            <Input value={localFilters.search || ''} onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })} placeholder="Search by merchant name" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Date From</Label>
                                <Input type="date" value={localFilters.date_from || ''} onChange={(e) => setLocalFilters({ ...localFilters, date_from: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Date To</Label>
                                <Input type="date" value={localFilters.date_to || ''} onChange={(e) => setLocalFilters({ ...localFilters, date_to: e.target.value })} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Min Amount ($)</Label>
                                <Input type="number" step="0.01" min="0" value={localFilters.amount_min || ''} onChange={(e) => setLocalFilters({ ...localFilters, amount_min: e.target.value })} placeholder="0.00" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Max Amount ($)</Label>
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
                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label htmlFor="show_reconciled" className="text-sm font-medium">Show Reconciled</Label>
                                <p className="text-muted-foreground text-xs">Include receipts already marked as reconciled</p>
                            </div>
                            <Switch
                                id="show_reconciled"
                                checked={localFilters.show_reconciled === '1'}
                                onCheckedChange={(checked) => setLocalFilters({ ...localFilters, show_reconciled: checked ? '1' : undefined })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={clearFilters}>Clear All</Button>
                        <Button onClick={applyFilters}>Apply Filters</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
