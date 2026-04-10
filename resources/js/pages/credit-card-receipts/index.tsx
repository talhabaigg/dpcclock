import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Camera, Coffee, CreditCard, Eye, FileText, Fuel, Hammer, Loader2, AlertCircle, CheckCircle2, Package, Pencil, Plane, Plus, ShoppingBag, Sparkles, Upload, X, Receipt, Filter } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const ReceiptScanner = lazy(() => import('@/components/receipt-scanner/receipt-scanner'));

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'My Receipts', href: '/my-receipts' },
];

interface Receipt {
    id: number;
    user_id: number;
    merchant_name: string | null;
    total_amount: string | null;
    gst_amount: string | null;
    currency: string;
    transaction_date: string | null;
    card_last_four: string | null;
    category: string | null;
    description: string | null;
    extraction_status: 'pending' | 'completed' | 'failed';
    merchant_logo_url: string | null;
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
    category?: string;
    search?: string;
}

interface Props {
    receipts: {
        data: Receipt[];
    } & PaginationData;
    filters: Filters;
    categories: string[];
}

export default function MyReceiptsIndex({ receipts, filters, categories }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploadCurrency, setUploadCurrency] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isScannerOpen, setIsScannerOpen] = useState(false);
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

    const handleUpload = () => {
        if (files.length === 0) return;
        setIsSubmitting(true);
        const formData = new FormData();
        files.forEach((file, i) => formData.append(`receipts[${i}]`, file));
        if (uploadCurrency) formData.append('currency', uploadCurrency);
        router.post('/my-receipts', formData, {
            forceFormData: true,
            onSuccess: () => { setIsUploadOpen(false); setFiles([]); setUploadCurrency(''); setIsSubmitting(false); },
            onError: (errors) => { toast.error(Object.values(errors).flat().join(', ')); setIsSubmitting(false); },
            onFinish: () => setIsSubmitting(false),
        });
    };

    const openEditDialog = (receipt: Receipt) => {
        setSelectedReceipt(receipt);
        setShowProcessedImage(!!receipt.processed_image_url);
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
        setIsEditOpen(true);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReceipt) return;
        setIsSubmitting(true);
        router.put(`/my-receipts/${selectedReceipt.id}`, {
            ...editForm,
            total_amount: editForm.total_amount ? parseFloat(editForm.total_amount) : null,
            gst_amount: editForm.gst_amount ? parseFloat(editForm.gst_amount) : null,
            category: editForm.category || null,
        }, {
            onSuccess: () => { setIsEditOpen(false); setIsSubmitting(false); },
            onError: () => setIsSubmitting(false),
        });
    };

    const applyFilters = () => {
        router.get('/my-receipts', Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v)), { preserveState: true });
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setLocalFilters({});
        router.get('/my-receipts', {}, { preserveState: true });
        setIsFilterOpen(false);
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        e.target.value = '';
    };

    const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

    const formatAmount = (value: string | null, currency: string = 'AUD') => {
        if (!value) return '-';
        const formatted = `$${parseFloat(value).toFixed(2)}`;
        return currency !== 'AUD' ? `${formatted} ${currency}` : formatted;
    };

    const formatDate = (value: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
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

    const MerchantLogo = ({ receipt }: { receipt: Receipt }) => {
        const [imgError, setImgError] = useState(false);

        if (receipt.merchant_logo_url && !imgError) {
            return (
                <img
                    src={receipt.merchant_logo_url}
                    alt=""
                    className="h-full w-full object-contain p-2"
                    onError={() => setImgError(true)}
                />
            );
        }

        return <CategoryIcon category={receipt.category} className="h-7 w-7 text-muted-foreground" />;
    };

    const StatusBadge = ({ status }: { status: Receipt['extraction_status'] }) => {
        switch (status) {
            case 'pending':
                return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-200 bg-yellow-50"><Loader2 className="h-3 w-3 animate-spin" />Extracting</Badge>;
            case 'completed':
                return <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50"><CheckCircle2 className="h-3 w-3" />Done</Badge>;
            case 'failed':
                return <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50"><AlertCircle className="h-3 w-3" />Failed</Badge>;
        }
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Receipts" />

            <div className="flex flex-col gap-4 p-3 pb-28 sm:p-4 sm:pb-28">
                {/* Action buttons */}
                <div className="flex items-center gap-2 overflow-x-auto">
                    <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setIsFilterOpen(true)}>
                        <Filter className="mr-1.5 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs">{activeFilterCount}</Badge>}
                    </Button>
                    <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={() => setIsUploadOpen(true)}>
                        <Upload className="mr-1.5 h-4 w-4" />
                        Upload
                    </Button>
                </div>

                {/* Receipt cards */}
                {receipts.data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="bg-muted mb-4 rounded-full p-4">
                            <Receipt className="text-muted-foreground h-10 w-10" />
                        </div>
                        <p className="text-muted-foreground text-lg font-medium">No receipts yet</p>
                        <p className="text-muted-foreground mt-1 text-sm">Snap a photo of your receipt to get started</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {receipts.data.map((receipt) => (
                            <Card key={receipt.id} className="cursor-pointer py-0 transition-shadow active:shadow-md hover:shadow-md" onClick={() => openEditDialog(receipt)}>
                                <CardContent className="flex items-center gap-3 p-3 sm:p-4">
                                    <div className="bg-muted flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:h-16 sm:w-16">
                                        <MerchantLogo receipt={receipt} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                {receipt.extraction_status === 'pending' ? (
                                                    <div className="flex items-center gap-2">
                                                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                                                        <span className="text-muted-foreground text-sm italic">Extracting data...</span>
                                                    </div>
                                                ) : (
                                                    <p className="truncate text-base font-semibold leading-tight">{receipt.merchant_name || 'Unknown Merchant'}</p>
                                                )}
                                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                                    {receipt.transaction_date && <span className="text-muted-foreground text-xs">{formatDate(receipt.transaction_date)}</span>}
                                                    {receipt.card_last_four && (
                                                        <span className="text-muted-foreground flex items-center gap-0.5 text-xs">
                                                            <CreditCard className="h-3 w-3" />****{receipt.card_last_four}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="text-base font-bold tabular-nums">{formatAmount(receipt.total_amount, receipt.currency)}</p>
                                                {receipt.gst_amount && parseFloat(receipt.gst_amount) > 0 && (
                                                    <p className="text-muted-foreground text-xs tabular-nums">GST {formatAmount(receipt.gst_amount, receipt.currency)}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2">
                                            {receipt.category && (
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${getCategoryColor(receipt.category)}`}>{receipt.category}</span>
                                            )}
                                            {receipt.extraction_status !== 'completed' && <StatusBadge status={receipt.extraction_status} />}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => { e.stopPropagation(); openEditDialog(receipt); }}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {receipts.last_page > 1 && <PaginationComponent pagination={receipts} />}
            </div>

            {/* Floating Snap Receipt Button */}
            <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
                <Button size="lg" className="h-14 gap-2.5 rounded-full px-8 text-base font-semibold shadow-lg shadow-primary/25 active:scale-95 transition-transform sm:h-12 sm:px-6 sm:text-sm" onClick={() => setIsScannerOpen(true)}>
                    <Camera className="h-6 w-6 sm:h-5 sm:w-5" />
                    Snap Receipt
                </Button>
            </div>

            {/* Upload Dialog */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Upload Receipts</DialogTitle>
                        <DialogDescription>Upload receipt images. Data will be automatically extracted.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors active:bg-muted/50" onClick={() => fileInputRef.current?.click()}>
                            <Plus className="text-muted-foreground mb-2 h-8 w-8" />
                            <p className="text-muted-foreground text-sm">Tap to select images</p>
                            <p className="text-muted-foreground text-xs">JPG, PNG, WebP, PDF up to 20MB each</p>
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={handleFileSelect} />
                        <div className="grid gap-2">
                            <Label>Currency (optional)</Label>
                            <Select value={uploadCurrency} onValueChange={setUploadCurrency}>
                                <SelectTrigger><SelectValue placeholder="Auto-detect from receipt" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                                    <SelectItem value="NZD">NZD - New Zealand Dollar</SelectItem>
                                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {files.length > 0 && (
                            <div className="space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between rounded-md border p-2">
                                        <span className="max-w-[350px] truncate text-sm">{file.name}</span>
                                        <Button variant="ghost" size="icon" onClick={() => removeFile(index)}><X className="h-4 w-4" /></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsUploadOpen(false); setFiles([]); setUploadCurrency(''); }}>Cancel</Button>
                        <Button onClick={handleUpload} disabled={isSubmitting || files.length === 0}>
                            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : <><Upload className="mr-2 h-4 w-4" />Upload {files.length} receipt{files.length !== 1 ? 's' : ''}</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Receipt</DialogTitle>
                        <DialogDescription>Review and update the extracted receipt data.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate}>
                        <div className="grid gap-4 py-4">
                            {selectedReceipt?.image_url && (
                                <div className="flex flex-col items-center gap-2">
                                    {selectedReceipt.mime_type === 'application/pdf' ? (
                                        <a href={selectedReceipt.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border px-4 py-3 text-sm hover:bg-accent active:bg-accent">
                                            <FileText className="h-5 w-5" />View PDF Receipt
                                        </a>
                                    ) : (
                                        <>
                                            <a href={showProcessedImage && selectedReceipt.processed_image_url ? selectedReceipt.processed_image_url : selectedReceipt.image_url} target="_blank" rel="noopener noreferrer">
                                                <img src={showProcessedImage && selectedReceipt.processed_image_url ? selectedReceipt.processed_image_url : selectedReceipt.image_url} alt="Receipt" className="max-h-48 rounded-md border object-contain" />
                                            </a>
                                            {selectedReceipt.processed_image_url && (
                                                <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-full text-xs" onClick={() => setShowProcessedImage(!showProcessedImage)}>
                                                    {showProcessedImage ? <><Eye className="h-3.5 w-3.5" />View Original</> : <><Sparkles className="h-3.5 w-3.5" />View Enhanced</>}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={clearFilters}>Clear All</Button>
                        <Button onClick={applyFilters}>Apply Filters</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Receipt Scanner */}
            {isScannerOpen && (
                <Suspense fallback={
                    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black">
                        <div className="flex items-center gap-2 text-white"><Loader2 className="h-5 w-5 animate-spin" />Loading scanner...</div>
                    </div>
                }>
                    <ReceiptScanner open={isScannerOpen} onClose={() => setIsScannerOpen(false)} onCapture={(file: File) => { setIsScannerOpen(false); setFiles([file]); setIsUploadOpen(true); }} />
                </Suspense>
            )}
        </AppLayout>
    );
}
