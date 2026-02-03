import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import {
    AlertCircleIcon,
    ArrowUpDown,
    Building,
    Building2,
    Calendar,
    ChevronDown,
    ChevronRight,
    CircleCheck,
    CirclePlus,
    Clock,
    Copy,
    Cuboid,
    Edit3,
    FileSpreadsheet,
    FileText,
    GitCompare,
    HelpCircle,
    History,
    Lock,
    MapPin,
    Package,
    Pencil,
    Phone,
    RefreshCw,
    RotateCcw,
    Send,
    Trash2,
    User,
    UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import ComparisonTab from './show-partials/ComparisonTab';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisition/all',
    },
];

export default function RequisitionShow() {
    const { requisition, activities, flash, auth } = usePage().props as unknown as {
        requisition: {
            id: number;
            po_number: string;
            project_number: string;
            supplier_number: number;
            delivery_contact: string;
            requested_by: string;
            deliver_to: string;
            date_required: string;
            order_reference: string;
            status: string;
            premier_po_id: string | null;
            submitted_at: string | null;
            processed_at: string | null;
            created_at: string;
            location: { name: string };
            supplier: { name: string };
            creator: { name: string };
            submitter: { name: string } | null;
            processor: { name: string } | null;
            line_items: {
                id: number;
                code: string;
                description: string;
                qty: number;
                unit_cost: number;
                total_cost: number;
                cost_code: string;
                price_list: string;
                is_locked: boolean;
            }[];
            line_items_sum_total_cost: number;
        };
        activities: any[];
        flash: {
            success?: string;
            error?: string;
            message?: string;
        };
        auth: {
            permissions: string[];
        };
    };

    // Check if any line items have base price (not from project list)
    const hasBasePriceItems = requisition.line_items?.some(
        (item) => !item.price_list || item.price_list === 'base_price'
    );

    // Check if user can process requisitions (send to Premier)
    const canProcessRequisitions = auth?.permissions?.includes('requisitions.process');

    // Check if user can approve pricing and send from office review (backoffice only)
    const canApprovePricing = auth?.permissions?.includes('requisitions.approve-pricing');

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());

    function handleSort(key: string) {
        if (sortKey === key) {
            if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else if (sortDirection === 'desc') {
                setSortKey(null);
                setSortDirection(null);
            } else {
                setSortDirection('asc');
            }
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    }

    function getSortedItems() {
        if (!sortKey || !sortDirection) return requisition.line_items;

        return [...requisition.line_items].sort((a, b) => {
            const aVal = a[sortKey as keyof typeof a];
            const bVal = b[sortKey as keyof typeof b];

            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }

            return sortDirection === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
        });
    }

    const toggleActivity = (id: number) => {
        setExpandedActivities((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'success':
                return { bg: 'bg-amber-500', bgLight: 'bg-amber-50 dark:bg-amber-950', text: 'Awaiting', textColor: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' };
            case 'sent':
                return { bg: 'bg-emerald-500', bgLight: 'bg-emerald-50 dark:bg-emerald-950', text: 'Sent', textColor: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800' };
            case 'pending':
                return { bg: 'bg-slate-400', bgLight: 'bg-slate-50 dark:bg-slate-900', text: 'Pending', textColor: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' };
            case 'failed':
                return { bg: 'bg-red-500', bgLight: 'bg-red-50 dark:bg-red-950', text: 'Failed', textColor: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800' };
            case 'office_review':
                return { bg: 'bg-purple-500', bgLight: 'bg-purple-50 dark:bg-purple-950', text: 'Waiting for Review', textColor: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800' };
            default:
                return { bg: 'bg-slate-400', bgLight: 'bg-slate-50 dark:bg-slate-900', text: status, textColor: 'text-slate-600 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-700' };
        }
    };

    const getEventConfig = (event: string) => {
        switch (event) {
            case 'created':
                return {
                    icon: CirclePlus,
                    bg: 'bg-emerald-100 dark:bg-emerald-950',
                    iconColor: 'text-emerald-600 dark:text-emerald-400',
                    lineColor: 'bg-emerald-200 dark:bg-emerald-800',
                    label: 'Created',
                    badgeBg: 'bg-emerald-50 dark:bg-emerald-950',
                    badgeText: 'text-emerald-700 dark:text-emerald-400',
                    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
                };
            case 'updated':
                return {
                    icon: Edit3,
                    bg: 'bg-blue-100 dark:bg-blue-950',
                    iconColor: 'text-blue-600 dark:text-blue-400',
                    lineColor: 'bg-blue-200 dark:bg-blue-800',
                    label: 'Updated',
                    badgeBg: 'bg-blue-50 dark:bg-blue-950',
                    badgeText: 'text-blue-700 dark:text-blue-400',
                    badgeBorder: 'border-blue-200 dark:border-blue-800',
                };
            case 'deleted':
                return {
                    icon: Trash2,
                    bg: 'bg-red-100 dark:bg-red-950',
                    iconColor: 'text-red-600 dark:text-red-400',
                    lineColor: 'bg-red-200 dark:bg-red-800',
                    label: 'Deleted',
                    badgeBg: 'bg-red-50 dark:bg-red-950',
                    badgeText: 'text-red-700 dark:text-red-400',
                    badgeBorder: 'border-red-200 dark:border-red-800',
                };
            default:
                return {
                    icon: History,
                    bg: 'bg-slate-100 dark:bg-slate-800',
                    iconColor: 'text-slate-600 dark:text-slate-400',
                    lineColor: 'bg-slate-200 dark:bg-slate-700',
                    label: event,
                    badgeBg: 'bg-slate-50 dark:bg-slate-900',
                    badgeText: 'text-slate-700 dark:text-slate-400',
                    badgeBorder: 'border-slate-200 dark:border-slate-700',
                };
        }
    };

    const statusConfig = getStatusConfig(requisition.status);
    const totalCost = Number(requisition.line_items_sum_total_cost) || requisition.line_items?.reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;
    const itemCount = requisition.line_items?.length || 0;

    useEffect(() => {
        if (flash.error) {
            toast.error(flash.error);
        }
        if (flash.success) {
            toast.success(flash.success);
        }
    }, []);

    // Format datetime for display
    const formatDateTime = (dateString: string | null) => {
        if (!dateString) return null;
        try {
            return new Date(dateString).toLocaleString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return null;
        }
    };

    // Detail items
    const detailItems = [
        { icon: Building2, label: 'Project', value: requisition.location?.name },
        { icon: Package, label: 'Supplier', value: requisition.supplier?.name },
        { icon: MapPin, label: 'Deliver To', value: requisition.deliver_to },
        { icon: User, label: 'Requested By', value: requisition.requested_by },
        { icon: Phone, label: 'Contact', value: requisition.delivery_contact },
        { icon: FileText, label: 'Reference', value: requisition.order_reference },
        { icon: Calendar, label: 'Required', value: requisition.date_required },
        { icon: User, label: 'Created By', value: requisition.creator?.name },
        { icon: Clock, label: 'Created At', value: formatDateTime(requisition.created_at) },
        { icon: UserCheck, label: 'Submitted By', value: requisition.submitter?.name },
        { icon: Clock, label: 'Submitted At', value: formatDateTime(requisition.submitted_at) },
        { icon: UserCheck, label: 'Processed By', value: requisition.processor?.name },
        { icon: Clock, label: 'Processed At', value: formatDateTime(requisition.processed_at) },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Requisition #${requisition.id}`} />

            <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100/50 dark:from-background dark:via-background dark:to-background">
                {/* Compact Header Bar */}
                <div className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/95 backdrop-blur-xl dark:border-border dark:bg-background/95">
                    <div className="max-w-full px-3 py-3 sm:px-6 md:px-8">
                        {/* Top row: ID, Status, Key Stats */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                                        #{requisition.id}
                                    </span>
                                    {requisition.po_number && (
                                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                                            PO{requisition.po_number}
                                        </Badge>
                                    )}
                                </div>
                                <Badge className={cn('font-medium', statusConfig.bgLight, statusConfig.textColor, statusConfig.border)}>
                                    <div className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', statusConfig.bg)} />
                                    {statusConfig.text}
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-sm sm:gap-4">
                                <div className="hidden items-center gap-1.5 sm:flex">
                                    <span className="text-slate-500 dark:text-slate-400">Items:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{itemCount}</span>
                                </div>
                                <div className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-border" />
                                <div className="flex items-center gap-1">
                                    <span className="hidden text-slate-500 xs:inline dark:text-slate-400">Total:</span>
                                    <span className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                                        ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="-mx-1 mt-3 flex flex-wrap items-center gap-1.5 sm:mx-0 sm:gap-2">
                            <Link
                                href={`/requisition/${requisition.id}/edit`}
                                className={requisition.status !== 'pending' && requisition.status !== 'failed' ? 'pointer-events-none' : ''}
                            >
                                <Button size="sm" variant="outline" disabled={requisition.status !== 'pending' && requisition.status !== 'failed'} className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
                                    <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    Edit
                                </Button>
                            </Link>
                            <a href={`/requisition/excel/${requisition.id}`}>
                                <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
                                    <FileSpreadsheet className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="hidden sm:inline">Excel</span>
                                </Button>
                            </a>
                            <Link href={`/requisition/${requisition.id}/print`}>
                                <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
                                    <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="hidden sm:inline">Print</span>
                                </Button>
                            </Link>
                            <Link href={`/requisition/${requisition.id}/copy`}>
                                <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
                                    <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="hidden sm:inline">Duplicate</span>
                                </Button>
                            </Link>
                            {canProcessRequisitions && (requisition.status === 'pending' || requisition.status === 'failed' || requisition.status === 'office_review') && (
                                <Link href={`/requisition/${requisition.id}/refresh-pricing`}>
                                    <Button size="sm" variant="outline" className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
                                        <RefreshCw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        <span className="hidden sm:inline">Refresh Pricing</span>
                                    </Button>
                                </Link>
                            )}

                            <div className="flex-1" />

                            {requisition.status === 'failed' && (
                                <Link href={`/requisition/${requisition.id}/api-send`}>
                                    <Button size="sm" className="h-8 gap-1 bg-amber-500 px-2 text-xs text-white hover:bg-amber-600 sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
                                        <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        Retry
                                    </Button>
                                </Link>
                            )}
                            {requisition.status === 'pending' && hasBasePriceItems && (
                                <div className="flex items-center gap-1">
                                    <Link href={`/requisition/${requisition.id}/send-to-office`}>
                                        <Button size="sm" className="h-8 gap-1.5 rounded-r-none bg-gradient-to-r from-purple-600 to-violet-600 px-3 text-xs text-white shadow-lg shadow-purple-600/30 transition-all hover:from-purple-700 hover:to-violet-700 hover:shadow-xl hover:shadow-purple-600/40 sm:h-9 sm:gap-2 sm:px-4 sm:text-sm">
                                            <Building className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                            Send to Office
                                        </Button>
                                    </Link>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-8 rounded-l-none border-l-0 px-2 sm:h-9">
                                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Building className="h-5 w-5 text-purple-600" />
                                                    Why Send to Office?
                                                </DialogTitle>
                                                <DialogDescription>
                                                    This requisition requires office review
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4 space-y-4">
                                                <p className="text-sm text-muted-foreground">
                                                    This requisition contains items with <strong>base prices</strong> (not from the project price list).
                                                    These orders require review by an office administrator before being sent to Premier.
                                                </p>
                                                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/50">
                                                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300">What happens next:</p>
                                                    <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-purple-600 dark:text-purple-400">
                                                        <li>Order is sent to the office for review</li>
                                                        <li>An admin will verify pricing and details</li>
                                                        <li>Admin sends the order to Premier</li>
                                                    </ol>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            )}
                            {requisition.status === 'pending' && !hasBasePriceItems && (
                                <div className="flex items-center gap-1">
                                    <Link href={`/requisition/${requisition.id}/api-send`}>
                                        <Button size="sm" className="h-8 gap-1.5 rounded-r-none bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-xs text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-600/40 sm:h-9 sm:gap-2 sm:px-4 sm:text-sm">
                                            <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                            Send to Premier
                                        </Button>
                                    </Link>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-8 rounded-l-none border-l-0 px-2 sm:h-9">
                                                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Send className="h-5 w-5 text-blue-600" />
                                                    What happens next?
                                                </DialogTitle>
                                                <DialogDescription>
                                                    Understanding the purchase order workflow
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4 space-y-4">
                                                {/* Step 1 */}
                                                <div className="flex gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                                        1
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">Sent to Premier</h4>
                                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                                            After clicking send, the order is received in Premier Construction Software (Superior's ERP suite).
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Step 2 */}
                                                <div className="flex gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                                                        2
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">Admin Review</h4>
                                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                                            A procurement admin will review the requisition and convert it to a purchase order.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Step 3 */}
                                                <div className="flex gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                                                        3
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-foreground">Sent to Supplier</h4>
                                                        <p className="mt-0.5 text-sm text-muted-foreground">
                                                            Once approved, the purchase order is sent to the supplier. The status will update to "Sent".
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Status info */}
                                                <div className="rounded-lg border border-border bg-muted/30 p-3">
                                                    <p className="text-xs font-medium text-muted-foreground">Status meanings:</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <Badge variant="outline" className="gap-1 border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                            Pending
                                                        </Badge>
                                                        <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                            Awaiting
                                                        </Badge>
                                                        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            Sent
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            )}
                            {requisition.status === 'office_review' && canApprovePricing && (
                                <Link href={`/requisition/${requisition.id}/api-send`}>
                                    <Button size="sm" className="h-8 gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 text-xs text-white shadow-lg shadow-blue-600/30 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-600/40 sm:h-9 sm:gap-2 sm:px-4 sm:text-sm">
                                        <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        Send to Premier
                                    </Button>
                                </Link>
                            )}
                            {requisition.status === 'office_review' && !canApprovePricing && (
                                <Badge variant="outline" className="gap-1 border-purple-200 bg-purple-50 px-2 py-1 text-xs text-purple-700 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400">
                                    <Building className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    Waiting for Review
                                </Badge>
                            )}
                            {requisition.status !== 'pending' && requisition.status !== 'failed' && requisition.status !== 'office_review' && (
                                <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                                    <CircleCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="hidden xs:inline">Sent to</span> Premier
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Alert */}
                {flash.error && (
                    <div className="px-3 pt-3 sm:px-6 sm:pt-4 md:px-8">
                        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50">
                            <AlertCircleIcon className="h-4 w-4" />
                            <AlertTitle>Errors found in PO</AlertTitle>
                            <AlertDescription>{flash.error}</AlertDescription>
                        </Alert>
                    </div>
                )}

                {/* Main Content - Two Column Layout */}
                <div className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 lg:p-8">
                    <div className="grid min-w-0 gap-4 md:gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
                        {/* Left Column - Details */}
                        <div className="space-y-3 md:space-y-4">
                            {/* Mobile: Stacked cards, Desktop: Sidebar */}
                            <div className="flex flex-col gap-3 lg:gap-4">
                                {/* Details Card */}
                                <Card className="overflow-hidden border-slate-200/60 dark:border-border">
                                    <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-3 py-2.5 sm:px-4 sm:py-3 dark:border-border dark:bg-muted/30">
                                        <CardTitle className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:text-sm dark:text-slate-300">
                                            <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
                                            Details
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {/* Compact grid on mobile, list on desktop */}
                                        <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 lg:grid-cols-1 lg:gap-0 lg:bg-transparent dark:bg-border">
                                            {detailItems.map((item) => (
                                                <div key={item.label} className="flex items-start gap-2 bg-white px-2.5 py-2 sm:px-3 lg:gap-3 lg:border-b lg:border-slate-100 lg:px-4 lg:py-2.5 lg:last:border-0 dark:bg-card dark:lg:border-border">
                                                    <item.icon className="mt-0.5 h-3 w-3 shrink-0 text-slate-400 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 dark:text-slate-500" />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 sm:text-[10px] lg:text-[11px] dark:text-slate-500">
                                                            {item.label}
                                                        </p>
                                                        <p className="mt-0.5 break-words text-[11px] font-medium text-slate-700 sm:text-xs lg:text-sm dark:text-slate-200">
                                                            {item.value || <span className="text-slate-400">—</span>}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Value Summary - Hidden on mobile since it's in header */}
                                <Card className="hidden border-slate-200/60 bg-gradient-to-br from-blue-50 to-indigo-50 lg:block dark:border-border dark:from-blue-950/30 dark:to-indigo-950/30">
                                    <CardContent className="p-4">
                                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Total Value
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                                            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                            {itemCount} line {itemCount === 1 ? 'item' : 'items'}
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Right Column - Tabs */}
                        <div className="min-w-0">
                            <Tabs defaultValue="items" className="w-full">
                                <TabsList className="mb-3 inline-flex h-auto w-full max-w-full justify-start overflow-x-auto rounded-lg border border-slate-200/50 bg-slate-100/80 p-1 sm:mb-4 sm:w-auto dark:border-border dark:bg-muted/50">
                                    <TabsTrigger
                                        value="items"
                                        className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
                                    >
                                        <Cuboid className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        Items
                                        <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[9px] sm:ml-1 sm:h-5 sm:px-1.5 sm:text-[10px]">
                                            {itemCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="log"
                                        className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
                                    >
                                        <History className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        Activity
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="compare"
                                        className="flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all sm:gap-1.5 sm:px-3 sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
                                    >
                                        <GitCompare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        Compare
                                    </TabsTrigger>
                                </TabsList>

                                {/* Line Items Tab */}
                                <TabsContent value="items" className="mt-0">
                                    <Card className="max-w-full overflow-hidden border-slate-200/60 dark:border-border">
                                        <div className="-mx-px overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-b border-slate-100 bg-slate-50/80 hover:bg-slate-50/80 dark:border-border dark:bg-muted/30">
                                                        <TableHead
                                                            className="cursor-pointer whitespace-nowrap px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 sm:px-4 sm:py-3 sm:text-xs dark:text-slate-400"
                                                            onClick={() => handleSort('code')}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                Code
                                                                <ArrowUpDown className="hidden h-3 w-3 opacity-40 sm:block" />
                                                            </div>
                                                        </TableHead>
                                                        <TableHead
                                                            className="cursor-pointer whitespace-nowrap px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-700 sm:px-4 sm:py-3 sm:text-xs dark:text-slate-400"
                                                            onClick={() => handleSort('description')}
                                                        >
                                                            <div className="flex items-center gap-1">
                                                                <span className="sm:hidden">Desc</span>
                                                                <span className="hidden sm:inline">Description</span>
                                                                <ArrowUpDown className="hidden h-3 w-3 opacity-40 sm:block" />
                                                            </div>
                                                        </TableHead>
                                                        <TableHead
                                                            className="cursor-pointer whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4 sm:py-3 sm:text-xs dark:text-slate-400"
                                                            onClick={() => handleSort('qty')}
                                                        >
                                                            <div className="flex items-center justify-end gap-1">
                                                                Qty
                                                                <ArrowUpDown className="hidden h-3 w-3 opacity-40 sm:block" />
                                                            </div>
                                                        </TableHead>
                                                        <TableHead
                                                            className="hidden cursor-pointer whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:table-cell sm:px-4 sm:py-3 sm:text-xs dark:text-slate-400"
                                                            onClick={() => handleSort('unit_cost')}
                                                        >
                                                            <div className="flex items-center justify-end gap-1">
                                                                Unit
                                                                <ArrowUpDown className="h-3 w-3 opacity-40" />
                                                            </div>
                                                        </TableHead>
                                                        <TableHead
                                                            className="cursor-pointer whitespace-nowrap px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:px-4 sm:py-3 sm:text-xs dark:text-slate-400"
                                                            onClick={() => handleSort('total_cost')}
                                                        >
                                                            <div className="flex items-center justify-end gap-1">
                                                                Total
                                                                <ArrowUpDown className="hidden h-3 w-3 opacity-40 sm:block" />
                                                            </div>
                                                        </TableHead>
                                                        <TableHead className="hidden whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell dark:text-slate-400">
                                                            Cost Code
                                                        </TableHead>
                                                        <TableHead className="hidden whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell dark:text-slate-400">
                                                            Price List
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {getSortedItems().map((item, index) => (
                                                        <TableRow
                                                            key={item.id}
                                                            className={cn(
                                                                'transition-colors',
                                                                item.is_locked
                                                                    ? 'bg-amber-50/70 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50'
                                                                    : cn(
                                                                        index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-slate-50/50 dark:bg-muted/10',
                                                                        'hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
                                                                    ),
                                                            )}
                                                        >
                                                            <TableCell className="px-2 py-2 font-mono text-xs text-slate-700 sm:px-4 sm:py-2.5 sm:text-sm dark:text-slate-300">
                                                                <div className="flex items-center gap-1.5">
                                                                    {item.is_locked ? (
                                                                        <Lock className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                                                                    ) : null}
                                                                    <span>{item.code}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="max-w-[120px] px-2 py-2 text-xs text-slate-600 sm:max-w-[200px] sm:px-4 sm:py-2.5 sm:text-sm dark:text-slate-400">
                                                                <span className="line-clamp-2">{item.description}</span>
                                                                {item.price_list && (
                                                                    <span className="mt-1 block text-[10px] text-slate-400 lg:hidden dark:text-slate-500">
                                                                        {item.price_list}
                                                                    </span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="px-2 py-2 text-right text-xs font-medium tabular-nums text-slate-700 sm:px-4 sm:py-2.5 sm:text-sm dark:text-slate-300">
                                                                {item.qty}
                                                            </TableCell>
                                                            <TableCell className="hidden px-2 py-2 text-right text-xs tabular-nums text-slate-600 sm:table-cell sm:px-4 sm:py-2.5 sm:text-sm dark:text-slate-400">
                                                                <div className="flex items-center justify-end gap-1.5" title={item.is_locked ? 'Project locked price' : undefined}>
                                                                    {item.is_locked ? (
                                                                        <Lock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                                                    ) : null}
                                                                    <span className={item.is_locked ? 'text-amber-700 dark:text-amber-300' : ''}>
                                                                        ${Number(item.unit_cost)?.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-900 sm:px-4 sm:py-2.5 sm:text-sm dark:text-white">
                                                                ${Number(item.total_cost)?.toFixed(2)}
                                                            </TableCell>
                                                            <TableCell className="hidden px-4 py-2.5 text-sm text-slate-500 md:table-cell dark:text-slate-400">
                                                                {item.cost_code || '—'}
                                                            </TableCell>
                                                            <TableCell className="hidden px-4 py-2.5 text-sm text-slate-500 lg:table-cell dark:text-slate-400">
                                                                {item.price_list || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {/* Total Row */}
                                                    <TableRow className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-border dark:bg-muted/50">
                                                        <TableCell colSpan={3} className="px-2 py-2.5 text-right text-xs text-slate-700 sm:hidden dark:text-slate-300">
                                                            Total ({itemCount})
                                                        </TableCell>
                                                        <TableCell colSpan={4} className="hidden px-4 py-3 text-right text-sm text-slate-700 sm:table-cell dark:text-slate-300">
                                                            Total ({itemCount} items)
                                                        </TableCell>
                                                        <TableCell className="px-2 py-2.5 text-right text-sm tabular-nums text-slate-900 sm:px-4 sm:py-3 sm:text-base dark:text-white">
                                                            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                        <TableCell className="hidden md:table-cell" />
                                                        <TableCell className="hidden lg:table-cell" />
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </Card>
                                </TabsContent>

                                {/* Activity Log Tab - Timeline Style */}
                                <TabsContent value="log" className="mt-0">
                                    <Card className="overflow-hidden border-slate-200/60 dark:border-border">
                                        <CardContent className="p-0">
                                            {activities.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:py-16">
                                                    <div className="mb-3 rounded-full bg-slate-100 p-2.5 sm:mb-4 sm:p-3 dark:bg-slate-800">
                                                        <History className="h-5 w-5 text-slate-400 sm:h-6 sm:w-6 dark:text-slate-500" />
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">No activity recorded</p>
                                                    <p className="mt-1 text-[10px] text-slate-400 sm:text-xs dark:text-slate-500">Activity will appear here once changes are made</p>
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    {/* Timeline */}
                                                    {activities.map((activity, index) => {
                                                        const eventConfig = getEventConfig(activity.event);
                                                        const EventIcon = eventConfig.icon;
                                                        const isExpanded = expandedActivities.has(activity.id);
                                                        const hasChanges = activity.properties?.attributes || activity.properties?.old;
                                                        const isLast = index === activities.length - 1;

                                                        return (
                                                            <div key={activity.id} className="relative flex gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
                                                                {/* Timeline line */}
                                                                {!isLast && (
                                                                    <div
                                                                        className={cn(
                                                                            'absolute top-10 left-[23px] w-0.5 sm:top-12 sm:left-[37px]',
                                                                            eventConfig.lineColor,
                                                                        )}
                                                                        style={{ height: 'calc(100% - 16px)' }}
                                                                    />
                                                                )}

                                                                {/* Icon */}
                                                                <div className={cn('relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8', eventConfig.bg)}>
                                                                    <EventIcon className={cn('h-3 w-3 sm:h-4 sm:w-4', eventConfig.iconColor)} />
                                                                </div>

                                                                {/* Content */}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={cn('px-1.5 py-0 text-[10px] font-medium capitalize sm:px-2 sm:py-0.5 sm:text-xs', eventConfig.badgeBg, eventConfig.badgeText, eventConfig.badgeBorder)}
                                                                        >
                                                                            {eventConfig.label}
                                                                        </Badge>
                                                                        <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
                                                                            {activity.log_name}
                                                                        </span>
                                                                        <span className="text-[10px] tabular-nums text-slate-400 sm:text-xs dark:text-slate-500">
                                                                            {new Date(activity.created_at).toLocaleString()}
                                                                        </span>
                                                                    </div>

                                                                    {activity.causer && (
                                                                        <div className="mt-2 flex items-center gap-2">
                                                                            <UserInfo user={{ ...activity.causer }} />
                                                                        </div>
                                                                    )}

                                                                    {/* Collapsible Changes */}
                                                                    {hasChanges && (
                                                                        <Collapsible open={isExpanded} onOpenChange={() => toggleActivity(activity.id)} className="mt-2 sm:mt-3">
                                                                            <CollapsibleTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-6 gap-1 px-1.5 text-[10px] text-slate-500 hover:text-slate-700 sm:h-7 sm:gap-1.5 sm:px-2 sm:text-xs dark:text-slate-400"
                                                                                >
                                                                                    {isExpanded ? (
                                                                                        <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                                                                    ) : (
                                                                                        <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                                                                    )}
                                                                                    {isExpanded ? 'Hide' : 'Show'} changes
                                                                                </Button>
                                                                            </CollapsibleTrigger>
                                                                            <CollapsibleContent className="mt-2 space-y-2 sm:space-y-3">
                                                                                {activity.properties?.attributes && (
                                                                                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 sm:p-3 dark:border-border dark:bg-muted/30">
                                                                                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:mb-2 sm:text-[10px] dark:text-slate-400">
                                                                                            New Values
                                                                                        </p>
                                                                                        <div className="grid gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
                                                                                            {Object.entries(activity.properties.attributes).map(([key, value]) => (
                                                                                                <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
                                                                                                    <span className="font-medium text-slate-500 dark:text-slate-400">{key}:</span>
                                                                                                    <span className="break-all text-slate-700 dark:text-slate-200">{String(value)}</span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {activity.properties?.old && (
                                                                                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 sm:p-3 dark:border-amber-800 dark:bg-amber-950/30">
                                                                                        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 sm:mb-2 sm:text-[10px] dark:text-amber-400">
                                                                                            Previous Values
                                                                                        </p>
                                                                                        <div className="grid gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
                                                                                            {Object.entries(activity.properties.old).map(([key, value]) => (
                                                                                                <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
                                                                                                    <span className="font-medium text-amber-600 dark:text-amber-400">{key}:</span>
                                                                                                    <span className="break-all text-amber-700 dark:text-amber-300">{String(value)}</span>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </CollapsibleContent>
                                                                        </Collapsible>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>

                                {/* Compare Tab */}
                                <TabsContent value="compare" className="mt-0">
                                    <ComparisonTab requisitionId={requisition.id} premierPoId={requisition.premier_po_id} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
