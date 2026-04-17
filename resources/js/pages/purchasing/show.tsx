import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { UserInfo } from '@/components/user-info';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    AlertCircleIcon,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Building,
    ChevronDown,
    ChevronRight,
    CirclePlus,
    Copy,
    Cuboid,
    Edit3,
    FileSpreadsheet,
    FileText,
    GitCompare,
    HelpCircle,
    History,
    Loader2,
    Lock,
    MoreHorizontal,
    Package,
    Pencil,
    RefreshCw,
    RotateCcw,
    Send,
    Trash2,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import ComparisonTab from './show-partials/ComparisonTab';
import { SmartPricingCards } from './show-partials/SmartPricingCards';
import { SmartPricingWizard } from '@/components/SmartPricingWizard';
import { DeliveryOrganizationPanel } from './show-partials/DeliveryOrganizationPanel';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisition/all',
    },
];

export default function RequisitionShow() {
    const { requisition, activities, flash, auth, costCodes } = usePage().props as unknown as {
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
            location: { name: string; external_id: string };
            supplier: { name: string };
            creator: { name: string };
            submitter: { name: string } | null;
            processor: { name: string } | null;
            line_items: {
                id: number;
                serial_number: number;
                code: string;
                description: string;
                qty: number;
                unit_cost: number;
                total_cost: number;
                cost_code: string;
                price_list: string;
                is_locked: boolean;
                resolution_context: any;
                deliver_to?: string | null;
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
            isAdmin: boolean;
        };
        costCodes: { id: number; code: string; description: string }[];
    };

    // Check if any line items have base price (not from project list)
    const hasBasePriceItems = requisition.line_items?.some((item) => !item.price_list || item.price_list === 'base_price');

    // Check if user can process requisitions (send to Premier)
    const canProcessRequisitions = auth?.permissions?.includes('requisitions.process');

    // Check if user can approve pricing and send from office review (office-admin only)
    const canApprovePricing = auth?.permissions?.includes('requisitions.approve-pricing');

    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [expandedActivities, setExpandedActivities] = useState<Set<number>>(new Set());
    const [duplicateOpen, setDuplicateOpen] = useState(false);
    // Smart Pricing state
    const [smartPricingWizardOpen, setSmartPricingWizardOpen] = useState(false);
    const [smartPricingProblems, setSmartPricingProblems] = useState<any[]>([]);
    const [smartPricingChecking, setSmartPricingChecking] = useState(false);

    const handleSendToOffice = async () => {
        setSmartPricingChecking(true);
        try {
            const res = await fetch(`/requisition/${requisition.id}/smart-pricing-check`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();

            if (data.count > 0) {
                setSmartPricingProblems(data.problems);
                setSmartPricingWizardOpen(true);
            } else {
                // No problems — proceed directly
                router.visit(`/requisition/${requisition.id}/send-to-office`);
            }
        } catch {
            // If check fails, proceed anyway
            router.visit(`/requisition/${requisition.id}/send-to-office`);
        } finally {
            setSmartPricingChecking(false);
        }
    };

    const hasPendingSmartPricing = requisition.line_items?.some(
        (item) => item.resolution_context?.status === 'pending_review',
    );

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
        const neutral = {
            bgLight: 'bg-slate-50 dark:bg-slate-900/50',
            textColor: 'text-slate-700 dark:text-slate-300',
            border: 'border-slate-200 dark:border-slate-700',
        };
        switch (status) {
            case 'pending':
                return {
                    ...neutral,
                    bg: 'bg-slate-400',
                    text: 'Pending',
                    description: 'Not yet sent. Edit line items and send to office or Premier.',
                };
            case 'office_review':
                return {
                    ...neutral,
                    bg: 'bg-purple-500',
                    text: 'Waiting for Review',
                    description: 'An office admin is verifying pricing before sending to Premier.',
                };
            case 'processed':
            case 'success':
                return {
                    ...neutral,
                    bg: 'bg-amber-500',
                    text: 'Awaiting in Premier',
                    description: 'Sent to Premier. An admin will convert it into a purchase order.',
                };
            case 'sent':
                return {
                    ...neutral,
                    bg: 'bg-emerald-500',
                    text: 'Sent',
                    description: 'Purchase order has been sent to the supplier.',
                };
            case 'failed':
                return {
                    ...neutral,
                    bg: 'bg-red-500',
                    text: 'Failed',
                    description: 'The last send attempt failed. Use Retry once the issue is fixed.',
                };
            default:
                return {
                    ...neutral,
                    bg: 'bg-slate-400',
                    text: 'Unknown',
                    description: `Unrecognised status: ${status}`,
                };
        }
    };

    const getEventConfig = (event: string) => {
        const base = {
            bg: 'bg-slate-100 dark:bg-slate-800',
            lineColor: 'bg-slate-200 dark:bg-slate-700',
            badgeBg: 'bg-slate-50 dark:bg-slate-900/50',
            badgeText: 'text-slate-700 dark:text-slate-300',
            badgeBorder: 'border-slate-200 dark:border-slate-700',
        };
        switch (event) {
            case 'created':
                return { ...base, icon: CirclePlus, iconColor: 'text-emerald-600 dark:text-emerald-500', label: 'Created' };
            case 'updated':
                return { ...base, icon: Edit3, iconColor: 'text-blue-600 dark:text-blue-500', label: 'Updated' };
            case 'deleted':
                return { ...base, icon: Trash2, iconColor: 'text-red-600 dark:text-red-500', label: 'Deleted' };
            default:
                return { ...base, icon: History, iconColor: 'text-slate-500 dark:text-slate-400', label: event };
        }
    };

    const statusConfig = getStatusConfig(requisition.status);
    const totalCost =
        Number(requisition.line_items_sum_total_cost) || requisition.line_items?.reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;
    const itemCount = requisition.line_items?.length || 0;

    const renderSortIcon = (key: string) => {
        if (sortKey !== key) {
            return <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-70" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" />
        ) : (
            <ArrowDown className="h-3 w-3 shrink-0" />
        );
    };

    const getAriaSort = (key: string): 'ascending' | 'descending' | 'none' => {
        if (sortKey !== key) return 'none';
        return sortDirection === 'asc' ? 'ascending' : 'descending';
    };

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

    // Grouped detail items
    const orderDetails = [
        { label: 'Project', value: requisition.location?.name },
        { label: 'Supplier', value: requisition.supplier?.name },
        { label: 'Deliver To', value: requisition.deliver_to },
        { label: 'Contact', value: requisition.delivery_contact },
        { label: 'Reference', value: requisition.order_reference },
        { label: 'Required', value: requisition.date_required },
    ];

    const peopleDetails = [
        { label: 'Requested By', value: requisition.requested_by },
        { label: 'Created By', value: requisition.creator?.name },
        { label: 'Submitted By', value: requisition.submitter?.name },
        { label: 'Processed By', value: requisition.processor?.name },
    ];

    const timelineDetails = [
        { label: 'Created', value: formatDateTime(requisition.created_at) },
        { label: 'Submitted', value: formatDateTime(requisition.submitted_at) },
        { label: 'Processed', value: formatDateTime(requisition.processed_at) },
    ];

    const renderDetailRow = (
        { label, value }: { label: string; value: ReactNode },
        tabular = false,
    ) => (
        <div key={label} className="flex items-start justify-between gap-3 px-4 py-2">
            <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
            <span
                className={cn(
                    'break-words text-right text-sm font-medium text-slate-700 dark:text-slate-200',
                    tabular && 'tabular-nums',
                )}
            >
                {value || <span className="text-slate-400">—</span>}
            </span>
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Requisition #${requisition.id}`} />

            <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-slate-50/40 dark:bg-background [&_[data-slot=card]]:gap-0 [&_[data-slot=card]]:py-0 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-footer]]:px-0 [&_[data-slot=card-header]]:px-0">
                {/* Compact Header Bar */}
                <div className="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-border dark:bg-background">
                    <div className="max-w-full px-3 py-3 sm:px-6 md:px-8">
                        {/* Top row: ID, Status, Key Stats */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">#{requisition.id}</span>
                                    {requisition.po_number && (
                                        <Badge variant="outline" className="font-mono text-xs font-semibold">
                                            PO{requisition.po_number}
                                        </Badge>
                                    )}
                                </div>
                                <TooltipProvider delayDuration={200}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge
                                                className={cn(
                                                    'cursor-default font-medium',
                                                    statusConfig.bgLight,
                                                    statusConfig.textColor,
                                                    statusConfig.border,
                                                )}
                                            >
                                                <div className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', statusConfig.bg)} />
                                                {statusConfig.text}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">{statusConfig.description}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                            </div>

                            <div className="flex items-center gap-2 text-sm sm:gap-4">
                                <div className="hidden items-center gap-1.5 sm:flex">
                                    <span className="text-slate-500 dark:text-slate-400">Items:</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{itemCount}</span>
                                </div>
                                <div className="dark:bg-border hidden h-4 w-px bg-slate-200 sm:block" />
                                <div className="flex items-center gap-1">
                                    <span className="xs:inline hidden text-slate-500 dark:text-slate-400">Total:</span>
                                    <span className="text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                                        ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="-mx-1 mt-3 flex flex-wrap items-center gap-1.5 sm:mx-0 sm:gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
                                    >
                                        <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                        <span className="hidden sm:inline">More</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-48">
                                    <DropdownMenuItem
                                        onSelect={() => router.visit(`/requisition/${requisition.id}/edit`)}
                                        disabled={
                                            requisition.status !== 'pending' &&
                                            requisition.status !== 'failed' &&
                                            !(requisition.status === 'office_review' && canApprovePricing)
                                        }
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    {canProcessRequisitions &&
                                        (requisition.status === 'pending' ||
                                            requisition.status === 'failed' ||
                                            requisition.status === 'office_review') && (
                                            <DropdownMenuItem
                                                onSelect={() => router.visit(`/requisition/${requisition.id}/refresh-pricing`)}
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Refresh Pricing
                                            </DropdownMenuItem>
                                        )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <a href={`/requisition/excel/${requisition.id}`}>
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel
                                        </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => router.visit(`/requisition/${requisition.id}/print`)}
                                    >
                                        <FileText className="h-4 w-4" />
                                        Print
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>
                                        <Copy className="h-4 w-4" />
                                        Duplicate
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="flex-1" />

                            {requisition.status === 'failed' && (
                                <Link href={`/requisition/${requisition.id}/api-send`}>
                                    <Button
                                        size="sm"
                                        className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
                                    >
                                        <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        Retry
                                    </Button>
                                </Link>
                            )}
                            {requisition.status === 'pending' && hasBasePriceItems && (
                                <div className="flex items-center gap-1">
                                    <Button
                                        size="sm"
                                        onClick={handleSendToOffice}
                                        disabled={smartPricingChecking}
                                        className="h-8 gap-1.5 rounded-r-none px-3 text-xs sm:h-9 sm:gap-2 sm:px-4 sm:text-sm"
                                    >
                                        {smartPricingChecking ? (
                                            <Loader2 className="h-3 w-3 animate-spin sm:h-3.5 sm:w-3.5" />
                                        ) : (
                                            <Building className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        )}
                                        {smartPricingChecking ? 'Checking...' : 'Send to Office'}
                                    </Button>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-8 rounded-l-none border-l-0 px-2 sm:h-9">
                                                <HelpCircle className="text-muted-foreground h-3.5 w-3.5" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Building className="h-5 w-5 text-slate-500" />
                                                    Why Send to Office?
                                                </DialogTitle>
                                                <DialogDescription>This requisition requires office review</DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4 space-y-4">
                                                <p className="text-muted-foreground text-sm">
                                                    This requisition contains items with <strong>base prices</strong> (not from the project price
                                                    list). These orders require review by an office administrator before being sent to Premier.
                                                </p>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
                                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">What happens next:</p>
                                                    <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-slate-600 dark:text-slate-400">
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
                                        <Button
                                            size="sm"
                                            className="h-8 gap-1.5 rounded-r-none px-3 text-xs sm:h-9 sm:gap-2 sm:px-4 sm:text-sm"
                                        >
                                            <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                            Send to Premier
                                        </Button>
                                    </Link>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-8 rounded-l-none border-l-0 px-2 sm:h-9">
                                                <HelpCircle className="text-muted-foreground h-3.5 w-3.5" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Send className="h-5 w-5 text-slate-500" />
                                                    What happens next?
                                                </DialogTitle>
                                                <DialogDescription>Understanding the purchase order workflow</DialogDescription>
                                            </DialogHeader>
                                            <div className="mt-4 space-y-4">
                                                {/* Step 1 */}
                                                <div className="flex gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        1
                                                    </div>
                                                    <div>
                                                        <h4 className="text-foreground font-semibold">Sent to Premier</h4>
                                                        <p className="text-muted-foreground mt-0.5 text-sm">
                                                            After clicking send, the order is received in Premier Construction Software (Superior's
                                                            ERP suite).
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Step 2 */}
                                                <div className="flex gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        2
                                                    </div>
                                                    <div>
                                                        <h4 className="text-foreground font-semibold">Admin Review</h4>
                                                        <p className="text-muted-foreground mt-0.5 text-sm">
                                                            A procurement admin will review the requisition and convert it to a purchase order.
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Step 3 */}
                                                <div className="flex gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        3
                                                    </div>
                                                    <div>
                                                        <h4 className="text-foreground font-semibold">Sent to Supplier</h4>
                                                        <p className="text-muted-foreground mt-0.5 text-sm">
                                                            Once approved, the purchase order is sent to the supplier. The status will update to
                                                            "Sent".
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Status info */}
                                                <div className="border-border bg-muted/30 rounded-lg border p-3">
                                                    <p className="text-muted-foreground text-xs font-medium">Status meanings:</p>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1 border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                                                        >
                                                            <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                            Pending
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1 border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                                                        >
                                                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                            Awaiting in Premier
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1 border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
                                                        >
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
                                    <Button
                                        size="sm"
                                        className="h-8 gap-1.5 px-3 text-xs sm:h-9 sm:gap-2 sm:px-4 sm:text-sm"
                                    >
                                        <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        Send to Premier
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Alert */}
                {flash.error && (
                    <div className="px-3 pt-3 sm:px-6 sm:pt-4 md:px-8">
                        <Alert variant="destructive" className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50">
                            <AlertCircleIcon className="h-4 w-4" />
                            <AlertTitle>Couldn't complete that action</AlertTitle>
                            <AlertDescription>{flash.error}</AlertDescription>
                        </Alert>
                    </div>
                )}

                {/* Main Content - Two Column Layout */}
                <div className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 lg:p-8">
                    <div className="grid min-w-0 gap-4 md:gap-6 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr]">
                        {/* Left Column - Details */}
                        <div>
                            {/* Details Card */}
                            <Card className="overflow-hidden border-slate-200/60 dark:border-border">
                                <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:border-slate-800 dark:text-slate-400">
                                    Order
                                </div>
                                <div className="py-1">{orderDetails.map((item) => renderDetailRow(item))}</div>
                                <Collapsible>
                                    <CollapsibleTrigger className="group flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900/50">
                                        <span>People</span>
                                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-t border-slate-100 py-1 dark:border-slate-800">
                                        {peopleDetails.map((item) => renderDetailRow(item))}
                                    </CollapsibleContent>
                                </Collapsible>
                                <Collapsible>
                                    <CollapsibleTrigger className="group flex w-full items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900/50">
                                        <span>Timeline</span>
                                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="border-t border-slate-100 py-1 dark:border-slate-800">
                                        {timelineDetails.map((item) => renderDetailRow(item, true))}
                                    </CollapsibleContent>
                                </Collapsible>
                            </Card>
                        </div>

                        {/* Right Column - Tabs */}
                        <div className="min-w-0">
                            <Tabs defaultValue="items" className="w-full">
                                <TabsList className="mb-3 w-full justify-start overflow-x-auto sm:mb-4 sm:w-auto">
                                    <TabsTrigger value="items" className="gap-1.5">
                                        <Cuboid className="h-4 w-4" />
                                        Items
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                                            {itemCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="log" className="gap-1.5">
                                        <History className="h-4 w-4" />
                                        Activity
                                    </TabsTrigger>
                                    <TabsTrigger value="compare" className="gap-1.5">
                                        <GitCompare className="h-4 w-4" />
                                        Compare
                                    </TabsTrigger>
                                    <TabsTrigger value="delivery" className="gap-1.5">
                                        <Package className="h-4 w-4" />
                                        Delivery
                                    </TabsTrigger>
                                </TabsList>

                                {/* Line Items Tab */}
                                <TabsContent value="items" className="mt-0">
                                    {/* Smart Pricing Resolution Cards (office review) */}
                                    {requisition.status === 'office_review' && canApprovePricing && hasPendingSmartPricing && (
                                        <SmartPricingCards
                                            requisitionId={requisition.id}
                                            lineItems={requisition.line_items}
                                            projectNumber={requisition.location?.external_id ?? requisition.project_number}
                                            costCodes={costCodes ?? []}
                                            submitterName={requisition.submitter?.name ?? requisition.creator?.name ?? 'Field Worker'}
                                            onResolved={() => router.reload({ only: ['requisition'] })}
                                        />
                                    )}

                                    <Card className="max-w-full overflow-hidden py-0">
                                        {itemCount === 0 ? (
                                            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                                                <div className="bg-muted mb-3 rounded-full p-3">
                                                    <Cuboid className="text-muted-foreground h-5 w-5" />
                                                </div>
                                                <p className="text-sm font-medium">No line items yet</p>
                                                <p className="text-muted-foreground mt-1 text-xs">
                                                    Items added to this requisition will appear here
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead aria-sort={getAriaSort('code')} className="h-10">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSort('code')}
                                                                    className="text-muted-foreground group -ml-3 h-8 gap-1.5"
                                                                >
                                                                    Code
                                                                    {renderSortIcon('code')}
                                                                </Button>
                                                            </TableHead>
                                                            <TableHead aria-sort={getAriaSort('description')} className="h-10">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSort('description')}
                                                                    className="text-muted-foreground group -ml-3 h-8 gap-1.5"
                                                                >
                                                                    <span className="sm:hidden">Desc</span>
                                                                    <span className="hidden sm:inline">Description</span>
                                                                    {renderSortIcon('description')}
                                                                </Button>
                                                            </TableHead>
                                                            <TableHead aria-sort={getAriaSort('qty')} className="h-10 text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSort('qty')}
                                                                    className="text-muted-foreground group -mr-3 ml-auto flex h-8 gap-1.5"
                                                                >
                                                                    Qty
                                                                    {renderSortIcon('qty')}
                                                                </Button>
                                                            </TableHead>
                                                            <TableHead
                                                                aria-sort={getAriaSort('unit_cost')}
                                                                className="hidden h-10 text-right sm:table-cell"
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSort('unit_cost')}
                                                                    className="text-muted-foreground group -mr-3 ml-auto flex h-8 gap-1.5"
                                                                >
                                                                    Unit
                                                                    {renderSortIcon('unit_cost')}
                                                                </Button>
                                                            </TableHead>
                                                            <TableHead aria-sort={getAriaSort('total_cost')} className="h-10 text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleSort('total_cost')}
                                                                    className="text-muted-foreground group -mr-3 ml-auto flex h-8 gap-1.5"
                                                                >
                                                                    Total
                                                                    {renderSortIcon('total_cost')}
                                                                </Button>
                                                            </TableHead>
                                                            <TableHead className="hidden h-10 md:table-cell">Cost Code</TableHead>
                                                            <TableHead className="hidden h-10 lg:table-cell">Price List</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {getSortedItems().map((item) => (
                                                            <TableRow key={item.id}>
                                                                <TableCell className="font-mono text-xs sm:text-sm">
                                                                    <div className="flex items-center gap-1.5">
                                                                        {item.is_locked ? (
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Lock className="text-muted-foreground h-3 w-3 shrink-0" />
                                                                                </TooltipTrigger>
                                                                                <TooltipContent>Project locked price</TooltipContent>
                                                                            </Tooltip>
                                                                        ) : null}
                                                                        <span>{item.code}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground max-w-[140px] text-xs sm:max-w-[220px] sm:text-sm">
                                                                    <span className="line-clamp-2">{item.description}</span>
                                                                    {item.price_list && (
                                                                        <span className="text-muted-foreground/70 mt-1 block text-xs lg:hidden">
                                                                            {item.price_list}
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-medium tabular-nums sm:text-sm">
                                                                    {item.qty}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground hidden text-right text-xs tabular-nums sm:table-cell sm:text-sm">
                                                                    ${Number(item.unit_cost)?.toFixed(2)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-semibold tabular-nums sm:text-sm">
                                                                    ${Number(item.total_cost)?.toFixed(2)}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                                                                    {item.cost_code || <span className="text-muted-foreground/50">—</span>}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                                                                    {item.price_list || <span className="text-muted-foreground/50">—</span>}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        <TableRow className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                                            <TableCell colSpan={4} className="text-muted-foreground text-right text-xs sm:text-sm">
                                                                <span className="sm:hidden">Total ({itemCount})</span>
                                                                <span className="hidden sm:inline">
                                                                    Total ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right text-sm tabular-nums sm:text-base">
                                                                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </TableCell>
                                                            <TableCell className="hidden md:table-cell" />
                                                            <TableCell className="hidden lg:table-cell" />
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </Card>
                                </TabsContent>

                                {/* Activity Log Tab - Timeline Style */}
                                <TabsContent value="log" className="mt-0">
                                    <Card className="dark:border-border overflow-hidden border-slate-200/60">
                                        <CardContent className="p-0">
                                            {activities.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center px-4 py-10 text-center sm:py-16">
                                                    <div className="mb-3 rounded-full bg-slate-100 p-2.5 sm:mb-4 sm:p-3 dark:bg-slate-800">
                                                        <History className="h-5 w-5 text-slate-400 sm:h-6 sm:w-6 dark:text-slate-500" />
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-500 sm:text-sm dark:text-slate-400">
                                                        No activity recorded
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                                                        Activity will appear here once changes are made
                                                    </p>
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
                                                            <div key={activity.id} className="flex gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
                                                                {/* Icon + timeline line */}
                                                                <div className="flex flex-col items-center">
                                                                    <div
                                                                        className={cn(
                                                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full sm:h-8 sm:w-8',
                                                                            eventConfig.bg,
                                                                        )}
                                                                    >
                                                                        <EventIcon className={cn('h-3 w-3 sm:h-4 sm:w-4', eventConfig.iconColor)} />
                                                                    </div>
                                                                    {!isLast && <div className={cn('mt-2 w-px flex-1', eventConfig.lineColor)} />}
                                                                </div>

                                                                {/* Content */}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={cn(
                                                                                'px-2 py-0.5 text-xs font-medium capitalize',
                                                                                eventConfig.badgeBg,
                                                                                eventConfig.badgeText,
                                                                                eventConfig.badgeBorder,
                                                                            )}
                                                                        >
                                                                            {eventConfig.label}
                                                                        </Badge>
                                                                        <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
                                                                            {activity.log_name}
                                                                        </span>
                                                                        <span className="text-xs text-slate-400 tabular-nums dark:text-slate-500">
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
                                                                        <Collapsible
                                                                            open={isExpanded}
                                                                            onOpenChange={() => toggleActivity(activity.id)}
                                                                            className="mt-2 sm:mt-3"
                                                                        >
                                                                            <CollapsibleTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="h-7 gap-1.5 px-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
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
                                                                                    <div className="dark:border-border dark:bg-muted/30 rounded-lg border border-slate-200 bg-slate-50/50 p-2 sm:p-3">
                                                                                        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                                                            New Values
                                                                                        </p>
                                                                                        <div className="grid gap-2 text-sm">
                                                                                            {Object.entries(activity.properties.attributes).map(
                                                                                                ([key, value]) => (
                                                                                                    <div
                                                                                                        key={key}
                                                                                                        className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2"
                                                                                                    >
                                                                                                        <span className="font-medium text-slate-500 dark:text-slate-400">
                                                                                                            {key}:
                                                                                                        </span>
                                                                                                        <span className="break-all text-slate-700 dark:text-slate-200">
                                                                                                            {String(value)}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                ),
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {activity.properties?.old && (
                                                                                    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 sm:p-3 dark:border-slate-800 dark:bg-slate-900/30">
                                                                                        <p className="mb-2 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                                                            Previous Values
                                                                                        </p>
                                                                                        <div className="grid gap-2 text-sm">
                                                                                            {Object.entries(activity.properties.old).map(
                                                                                                ([key, value]) => (
                                                                                                    <div
                                                                                                        key={key}
                                                                                                        className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2"
                                                                                                    >
                                                                                                        <span className="font-medium text-slate-500 dark:text-slate-400">
                                                                                                            {key}:
                                                                                                        </span>
                                                                                                        <span className="break-all text-slate-600 line-through dark:text-slate-400">
                                                                                                            {String(value)}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                ),
                                                                                            )}
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

                                {/* Delivery Organization Tab */}
                                <TabsContent value="delivery" className="mt-0">
                                    <DeliveryOrganizationPanel requisitionId={requisition.id} lineItems={requisition.line_items} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </div>
            </div>
            <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate this requisition?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A new pending requisition will be created with the same line items. You'll be able to edit it before sending.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => router.post(`/requisition/${requisition.id}/copy`)}>
                            Duplicate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Smart Pricing Wizard (field worker — shown before send to office) */}
            {smartPricingWizardOpen && smartPricingProblems.length > 0 && (
                <SmartPricingWizard
                    open={smartPricingWizardOpen}
                    onClose={() => setSmartPricingWizardOpen(false)}
                    requisitionId={requisition.id}
                    problems={smartPricingProblems}
                    onComplete={() => {
                        setSmartPricingWizardOpen(false);
                        router.visit(`/requisition/${requisition.id}/send-to-office`);
                    }}
                />
            )}
        </AppLayout>
    );
}
