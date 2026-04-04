import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Camera, Download, FileText, Loader2, AlertCircle, CheckCircle2, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const ReceiptScanner = lazy(() => import('@/components/receipt-scanner/receipt-scanner'));

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Credit Card Receipts', href: '/credit-card-receipts' },
];

interface User {
    id: number;
    name: string;
}

interface Receipt {
    id: number;
    user_id: number;
    user: User;
    merchant_name: string | null;
    total_amount: string | null;
    gst_amount: string | null;
    currency: string;
    transaction_date: string | null;
    card_last_four: string | null;
    category: string | null;
    description: string | null;
    extraction_status: 'pending' | 'completed' | 'failed';
    image_url: string;
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
}

interface Props {
    receipts: {
        data: Receipt[];
    } & PaginationData;
    filters: Filters;
    canViewAll: boolean;
    categories: string[];
    users: User[];
}

export default function CreditCardReceiptsIndex({ receipts, filters, canViewAll, categories, users }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [uploadCurrency, setUploadCurrency] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [isScannerOpen, setIsScannerOpen] = useState(false);
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

    // Poll for pending extractions
    useEffect(() => {
        const hasPending = receipts.data.some((r) => r.extraction_status === 'pending');
        if (!hasPending) return;

        const interval = setInterval(() => {
            router.reload({ only: ['receipts'] });
        }, 5000);

        return () => clearInterval(interval);
    }, [receipts.data]);

    const handleUpload = () => {
        if (files.length === 0) return;
        setIsSubmitting(true);

        const formData = new FormData();
        files.forEach((file, i) => formData.append(`receipts[${i}]`, file));
        if (uploadCurrency) formData.append('currency', uploadCurrency);

        router.post('/credit-card-receipts', formData, {
            forceFormData: true,
            onSuccess: () => {
                setIsUploadOpen(false);
                setFiles([]);
                setUploadCurrency('');
                setIsSubmitting(false);
            },
            onError: (errors) => {
                toast.error(Object.values(errors).flat().join(', '));
                setIsSubmitting(false);
            },
            onFinish: () => setIsSubmitting(false),
        });
    };

    const openEditDialog = (receipt: Receipt) => {
        setSelectedReceipt(receipt);
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

        router.put(`/credit-card-receipts/${selectedReceipt.id}`, {
            ...editForm,
            total_amount: editForm.total_amount ? parseFloat(editForm.total_amount) : null,
            gst_amount: editForm.gst_amount ? parseFloat(editForm.gst_amount) : null,
            category: editForm.category || null,
        }, {
            onSuccess: () => {
                setIsEditOpen(false);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    const handleDelete = () => {
        if (!selectedReceipt) return;
        setIsSubmitting(true);

        router.delete(`/credit-card-receipts/${selectedReceipt.id}`, {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    const applyFilters = () => {
        router.get('/credit-card-receipts', Object.fromEntries(Object.entries(localFilters).filter(([, v]) => v)), {
            preserveState: true,
        });
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setLocalFilters({});
        router.get('/credit-card-receipts', {}, { preserveState: true });
        setIsFilterOpen(false);
    };

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
        }
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const formatAmount = (value: string | null, currency: string = 'AUD') => {
        if (!value) return '-';
        const formatted = `$${parseFloat(value).toFixed(2)}`;
        return currency !== 'AUD' ? `${formatted} ${currency}` : formatted;
    };

    const formatDate = (value: string | null) => {
        if (!value) return '-';
        return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const StatusBadge = ({ status }: { status: Receipt['extraction_status'] }) => {
        switch (status) {
            case 'pending':
                return (
                    <Badge variant="outline" className="gap-1 text-yellow-600">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Extracting
                    </Badge>
                );
            case 'completed':
                return (
                    <Badge variant="outline" className="gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Extracted
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge variant="outline" className="gap-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        Failed
                    </Badge>
                );
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Credit Card Receipts" />

            <div className="mt-2 mr-2 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setIsFilterOpen(true)}>
                    <Search className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>
                    )}
                </Button>
                {canViewAll && (
                    <Button variant="outline" asChild>
                        <a href={`/credit-card-receipts/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </a>
                    </Button>
                )}
                <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
                    <Camera className="mr-2 h-4 w-4" />
                    Scan Receipt
                </Button>
                <Button onClick={() => setIsUploadOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Receipts
                </Button>
            </div>

            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-2">
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                {canViewAll && <TableHead>Employee</TableHead>}
                                <TableHead>Merchant</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">GST</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {receipts.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={canViewAll ? 8 : 7} className="text-muted-foreground py-8 text-center">
                                        No receipts found. Upload your first receipt to get started.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                receipts.data.map((receipt) => (
                                    <TableRow key={receipt.id} className="cursor-pointer" onClick={() => openEditDialog(receipt)}>
                                        <TableCell>{formatDate(receipt.transaction_date)}</TableCell>
                                        {canViewAll && <TableCell>{receipt.user?.name}</TableCell>}
                                        <TableCell>
                                            {receipt.extraction_status === 'pending' ? (
                                                <span className="text-muted-foreground italic">Extracting...</span>
                                            ) : (
                                                receipt.merchant_name || '-'
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{formatAmount(receipt.total_amount, receipt.currency)}</TableCell>
                                        <TableCell className="text-right">{formatAmount(receipt.gst_amount, receipt.currency)}</TableCell>
                                        <TableCell>
                                            {receipt.category ? (
                                                <Badge variant="secondary" className="capitalize">{receipt.category}</Badge>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell><StatusBadge status={receipt.extraction_status} /></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEditDialog(receipt); }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedReceipt(receipt);
                                                    setIsDeleteOpen(true);
                                                }}>
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
                {receipts.last_page > 1 && <PaginationComponent pagination={receipts} />}
            </div>

            {/* Upload Dialog */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Upload Receipts</DialogTitle>
                        <DialogDescription>
                            Upload receipt images. Data will be automatically extracted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div
                            className="border-muted-foreground/25 hover:border-muted-foreground/50 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Plus className="text-muted-foreground mb-2 h-8 w-8" />
                            <p className="text-muted-foreground text-sm">Click to select images</p>
                            <p className="text-muted-foreground text-xs">JPG, PNG, WebP, PDF up to 20MB each</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        <div className="grid gap-2">
                            <Label>Currency (optional)</Label>
                            <Select value={uploadCurrency} onValueChange={setUploadCurrency}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Auto-detect from receipt" />
                                </SelectTrigger>
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
                                        <Button variant="ghost" size="icon" onClick={() => removeFile(index)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setIsUploadOpen(false); setFiles([]); setUploadCurrency(''); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpload} disabled={isSubmitting || files.length === 0}>
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                            ) : (
                                <><Upload className="mr-2 h-4 w-4" />Upload {files.length} receipt{files.length !== 1 ? 's' : ''}</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Receipt</DialogTitle>
                        <DialogDescription>Review and update the extracted receipt data.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdate}>
                        <div className="grid gap-4 py-4">
                            {selectedReceipt?.image_url && (
                                <div className="flex justify-center">
                                    {selectedReceipt.image_url.endsWith('.pdf') ? (
                                        <a href={selectedReceipt.image_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border px-4 py-3 text-sm hover:bg-accent">
                                            <FileText className="h-5 w-5" />
                                            View PDF Receipt
                                        </a>
                                    ) : (
                                        <a href={selectedReceipt.image_url} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={selectedReceipt.image_url}
                                                alt="Receipt"
                                                className="max-h-48 rounded-md border object-contain"
                                            />
                                        </a>
                                    )}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="merchant_name">Merchant</Label>
                                    <Input
                                        id="merchant_name"
                                        value={editForm.merchant_name}
                                        onChange={(e) => setEditForm({ ...editForm, merchant_name: e.target.value })}
                                        placeholder="Business name"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="total_amount">Total Amount ($)</Label>
                                    <Input
                                        id="total_amount"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editForm.total_amount}
                                        onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="gst_amount">GST Amount ($)</Label>
                                    <Input
                                        id="gst_amount"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editForm.gst_amount}
                                        onChange={(e) => setEditForm({ ...editForm, gst_amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Input
                                        id="currency"
                                        maxLength={3}
                                        value={editForm.currency}
                                        onChange={(e) => setEditForm({ ...editForm, currency: e.target.value.toUpperCase().slice(0, 3) })}
                                        placeholder="AUD"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="transaction_date">Transaction Date</Label>
                                    <Input
                                        id="transaction_date"
                                        type="date"
                                        value={editForm.transaction_date}
                                        onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="card_last_four">Card Last 4 Digits</Label>
                                    <Input
                                        id="card_last_four"
                                        maxLength={4}
                                        value={editForm.card_last_four}
                                        onChange={(e) => setEditForm({ ...editForm, card_last_four: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                        placeholder="1234"
                                    />
                                </div>
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={editForm.category} onValueChange={(value) => setEditForm({ ...editForm, category: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 grid gap-2">
                                    <Label htmlFor="description">Notes</Label>
                                    <Textarea
                                        id="description"
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        placeholder="Optional notes about this purchase"
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : 'Update'}
                            </Button>
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
                        <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                            {isSubmitting ? 'Deleting...' : 'Delete'}
                        </Button>
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
                            <Input
                                value={localFilters.search || ''}
                                onChange={(e) => setLocalFilters({ ...localFilters, search: e.target.value })}
                                placeholder="Search by merchant name"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Date From</Label>
                                <Input
                                    type="date"
                                    value={localFilters.date_from || ''}
                                    onChange={(e) => setLocalFilters({ ...localFilters, date_from: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Date To</Label>
                                <Input
                                    type="date"
                                    value={localFilters.date_to || ''}
                                    onChange={(e) => setLocalFilters({ ...localFilters, date_to: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Min Amount ($)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={localFilters.amount_min || ''}
                                    onChange={(e) => setLocalFilters({ ...localFilters, amount_min: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Max Amount ($)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={localFilters.amount_max || ''}
                                    onChange={(e) => setLocalFilters({ ...localFilters, amount_max: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <Select value={localFilters.category || ''} onValueChange={(value) => setLocalFilters({ ...localFilters, category: value })}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All categories" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat} value={cat} className="capitalize">{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {canViewAll && (
                            <div className="grid gap-2">
                                <Label>Employee</Label>
                                <Select value={localFilters.user_id || ''} onValueChange={(value) => setLocalFilters({ ...localFilters, user_id: value })}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All employees" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user) => (
                                            <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
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
                        <div className="flex items-center gap-2 text-white">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Loading scanner...
                        </div>
                    </div>
                }>
                    <ReceiptScanner
                        open={isScannerOpen}
                        onClose={() => setIsScannerOpen(false)}
                        onCapture={(file: File) => {
                            setIsScannerOpen(false);
                            setFiles([file]);
                            setIsUploadOpen(true);
                        }}
                    />
                </Suspense>
            )}
        </AppLayout>
    );
}
