import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
    Cuboid,
    EllipsisVertical,
    HelpCircle,
    Info,
    Loader2,
    Lock,
    RotateCcw,
    Send,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { SmartPricingWizard } from '@/components/SmartPricingWizard';
import { getStatus } from './index-partials/statusConfig';
import ComparisonTab from './show-partials/ComparisonTab';
import { DeliveryOrganizationPanel } from './show-partials/DeliveryOrganizationPanel';
import { SmartPricingCards } from './show-partials/SmartPricingCards';

function InlineDetail({ label, value, noTruncate }: { label: string; value: string | null | undefined; noTruncate?: boolean }) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">{label}</span>
            <span
                className={cn('text-foreground text-xs font-medium', !noTruncate && 'truncate')}
                title={!noTruncate ? value ?? undefined : undefined}
            >
                {value || '—'}
            </span>
        </div>
    );
}

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
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Requisitions',
            href: '/requisition/all',
        },
        {
            title: `${requisition.id}`,
            href: '#',
        },
    ];
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

    const hasPendingSmartPricing = requisition.line_items?.some((item) => item.resolution_context?.status === 'pending_review');

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

    const getEventConfig = (event: string) => {
        switch (event) {
            case 'created':
                return { dotColor: 'bg-primary', label: 'Created' };
            case 'updated':
                return { dotColor: 'bg-muted-foreground', label: 'Updated' };
            case 'deleted':
                return { dotColor: 'bg-destructive', label: 'Deleted' };
            default:
                return { dotColor: 'bg-muted-foreground', label: event };
        }
    };

    const statusInfo = getStatus(requisition.status);
    const totalCost =
        Number(requisition.line_items_sum_total_cost) || requisition.line_items?.reduce((sum, item) => sum + Number(item.total_cost || 0), 0) || 0;
    const itemCount = requisition.line_items?.length || 0;

    const renderSortIcon = (key: string) => {
        if (sortKey !== key) {
            return <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-70" />;
        }
        return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />;
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

    const details: { label: string; value: ReactNode; tabular?: boolean }[] = [
        { label: 'Project', value: requisition.location?.name },
        { label: 'Supplier', value: requisition.supplier?.name },
        { label: 'Required', value: requisition.date_required },
        { label: 'Reference', value: requisition.order_reference },
        { label: 'Deliver To', value: requisition.deliver_to },
        { label: 'Contact', value: requisition.delivery_contact },
        { label: 'Requested By', value: requisition.requested_by },
        { label: 'Created By', value: requisition.creator?.name },
        { label: 'Created', value: formatDateTime(requisition.created_at), tabular: true },
        { label: 'Submitted By', value: requisition.submitter?.name },
        { label: 'Submitted', value: formatDateTime(requisition.submitted_at), tabular: true },
        { label: 'Processed By', value: requisition.processor?.name },
        { label: 'Processed', value: formatDateTime(requisition.processed_at), tabular: true },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Requisition #${requisition.id}`} />

            <div className="dark:bg-background flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-slate-50/40 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-footer]]:px-0 [&_[data-slot=card-header]]:px-0 [&_[data-slot=card]]:gap-0 [&_[data-slot=card]]:py-0">
                {/* Compact Header Bar */}
                <div className="dark:bg-background sticky top-0 z-10 bg-white">
                    <div className="mx-auto w-full max-w-5xl px-3 py-3 sm:px-6 md:px-8">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-slate-900 sm:text-xl dark:text-white">#{requisition.id}</span>
                                {requisition.po_number && (
                                    <Badge variant="outline" className="font-mono text-xs font-semibold">
                                        PO{requisition.po_number}
                                    </Badge>
                                )}
                            </div>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    'text-[11px] font-medium',
                                    statusInfo.key === 'sent' && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                                )}
                            >
                                {statusInfo.label}
                            </Badge>

                            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
                            {requisition.status === 'failed' && (
                                <Link href={`/requisition/${requisition.id}/api-send`}>
                                    <Button size="sm" className="h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm">
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
                                        <Button size="sm" className="h-8 gap-1.5 rounded-r-none px-3 text-xs sm:h-9 sm:gap-2 sm:px-4 sm:text-sm">
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
                                                        <Badge variant="secondary" className="text-[11px] font-medium">
                                                            {getStatus('pending').label}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-[11px] font-medium">
                                                            {getStatus('processed').label}
                                                        </Badge>
                                                        <Badge
                                                            variant="secondary"
                                                            className="bg-emerald-500/10 text-[11px] font-medium text-emerald-700 dark:text-emerald-400"
                                                        >
                                                            {getStatus('sent').label}
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
                                    <Button size="sm" className="h-8 gap-1.5 px-3 text-xs sm:h-9 sm:gap-2 sm:px-4 sm:text-sm">
                                        <Send className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                        Send to Premier
                                    </Button>
                                </Link>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" aria-label="More actions" className="h-8 sm:h-9">
                                        <EllipsisVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-max">
                                    <DropdownMenuItem
                                        className="whitespace-nowrap"
                                        onClick={() => router.visit(`/requisition/${requisition.id}/edit`)}
                                        disabled={
                                            requisition.status !== 'pending' &&
                                            requisition.status !== 'failed' &&
                                            !(requisition.status === 'office_review' && canApprovePricing)
                                        }
                                    >
                                        Edit
                                    </DropdownMenuItem>
                                    {canProcessRequisitions &&
                                        (requisition.status === 'pending' ||
                                            requisition.status === 'failed' ||
                                            requisition.status === 'office_review') && (
                                            <DropdownMenuItem
                                                className="whitespace-nowrap"
                                                onClick={() => router.visit(`/requisition/${requisition.id}/refresh-pricing`)}
                                            >
                                                Refresh Pricing
                                            </DropdownMenuItem>
                                        )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="whitespace-nowrap" asChild>
                                        <a href={`/requisition/excel/${requisition.id}`}>Excel</a>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="whitespace-nowrap" asChild>
                                        <Link href={`/requisition/${requisition.id}/print`}>Print</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="whitespace-nowrap" onClick={() => setDuplicateOpen(true)}>
                                        Duplicate
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
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

                {/* Main Content */}
                <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 md:gap-6 md:p-6 lg:p-8">
                    {/* Inline summary strip + Details sheet */}
                    <div className="flex items-start justify-between gap-4 text-xs">
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <InlineDetail label="Project" value={requisition.location?.name} />
                            <InlineDetail label="Supplier" value={requisition.supplier?.name} />
                            <InlineDetail label="Required" value={requisition.date_required} />
                            <InlineDetail label="Reference" value={requisition.order_reference} noTruncate />
                        </div>
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                                    <Info className="h-3.5 w-3.5" />
                                    Details
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                                <SheetHeader>
                                    <SheetTitle>Requisition Details</SheetTitle>
                                </SheetHeader>
                                <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 pb-6 sm:grid-cols-2">
                                    {details.map(({ label, value, tabular }) => (
                                        <div key={label} className="flex min-w-0 flex-col gap-0.5">
                                            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                                                {label}
                                            </span>
                                            <span
                                                className={cn(
                                                    'text-sm font-medium break-words text-slate-700 dark:text-slate-200',
                                                    tabular && 'tabular-nums',
                                                )}
                                            >
                                                {value || <span className="text-slate-400">—</span>}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    {/* Tabs — full width */}
                    <div className="min-w-0">
                            <Tabs defaultValue="items" className="w-full">
                                <TabsList className="mb-3 w-full justify-start sm:mb-4 sm:w-auto">
                                    <TabsTrigger value="items" className="gap-1.5">
                                        Items
                                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                                            {itemCount}
                                        </Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="log">Activity</TabsTrigger>
                                    <TabsTrigger value="compare">Compare</TabsTrigger>
                                    <TabsTrigger value="delivery">Delivery</TabsTrigger>
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
                                                <p className="text-muted-foreground mt-1 text-xs">Items added to this requisition will appear here</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <Table className="text-xs [&_td]:py-1.5 [&_th]:py-1.5">
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead aria-sort={getAriaSort('code')} className="h-10 pl-4">
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
                                                                <TableCell className="pl-4 font-mono">
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
                                                                <TableCell className="text-muted-foreground max-w-[140px] sm:max-w-[220px]">
                                                                    <span className="line-clamp-2">{item.description}</span>
                                                                    {item.price_list && (
                                                                        <span className="text-muted-foreground/70 mt-1 block lg:hidden">
                                                                            {item.price_list}
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium tabular-nums">
                                                                    {Number(item.qty).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground hidden text-right tabular-nums sm:table-cell">
                                                                    ${Number(item.unit_cost)?.toFixed(2)}
                                                                </TableCell>
                                                                <TableCell className="text-right font-semibold tabular-nums">
                                                                    ${Number(item.total_cost)?.toFixed(2)}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground hidden md:table-cell">
                                                                    {item.cost_code || <span className="text-muted-foreground/50">—</span>}
                                                                </TableCell>
                                                                <TableCell className="text-muted-foreground hidden lg:table-cell">
                                                                    {item.price_list || <span className="text-muted-foreground/50">—</span>}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                        <TableRow className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                                            <TableCell colSpan={4} className="text-muted-foreground text-right">
                                                                <span className="sm:hidden">Total ({itemCount})</span>
                                                                <span className="hidden sm:inline">
                                                                    Total ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums">
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

                                {/* Activity Log Tab */}
                                <TabsContent value="log" className="mt-0">
                                    <Card className="overflow-hidden">
                                        <CardContent className="p-0">
                                            {activities.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                                                    <p className="text-muted-foreground text-xs font-medium">No activity recorded</p>
                                                    <p className="text-muted-foreground/70 mt-1 text-xs">
                                                        Activity will appear here once changes are made
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="py-2">
                                                    {activities.map((activity, index) => {
                                                        const eventConfig = getEventConfig(activity.event);
                                                        const isExpanded = expandedActivities.has(activity.id);
                                                        const hasChanges = activity.properties?.attributes || activity.properties?.old;
                                                        const isLast = index === activities.length - 1;

                                                        return (
                                                            <div key={activity.id} className="flex gap-3 px-4 py-2">
                                                                {/* Dot + line */}
                                                                <div className="flex flex-col items-center pt-1.5">
                                                                    <div
                                                                        className={cn('h-2 w-2 shrink-0 rounded-full', eventConfig.dotColor)}
                                                                    />
                                                                    {!isLast && <div className="bg-border mt-1 w-px flex-1" />}
                                                                </div>

                                                                {/* Content */}
                                                                <div className="min-w-0 flex-1 pb-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="text-[11px] font-medium capitalize"
                                                                        >
                                                                            {eventConfig.label}
                                                                        </Badge>
                                                                        <span className="text-muted-foreground hidden text-xs sm:inline">
                                                                            {activity.log_name}
                                                                        </span>
                                                                        <span className="text-muted-foreground text-xs tabular-nums">
                                                                            {new Date(activity.created_at).toLocaleString()}
                                                                        </span>
                                                                    </div>

                                                                    {activity.causer && (
                                                                        <div className="mt-1.5 flex items-center gap-2">
                                                                            <UserInfo user={{ ...activity.causer }} />
                                                                        </div>
                                                                    )}

                                                                    {hasChanges && (
                                                                        <Collapsible
                                                                            open={isExpanded}
                                                                            onOpenChange={() => toggleActivity(activity.id)}
                                                                            className="mt-2"
                                                                        >
                                                                            <CollapsibleTrigger asChild>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs"
                                                                                >
                                                                                    {isExpanded ? (
                                                                                        <ChevronDown className="h-3 w-3" />
                                                                                    ) : (
                                                                                        <ChevronRight className="h-3 w-3" />
                                                                                    )}
                                                                                    {isExpanded ? 'Hide' : 'Show'} changes
                                                                                </Button>
                                                                            </CollapsibleTrigger>
                                                                            <CollapsibleContent className="mt-2 space-y-2">
                                                                                {activity.properties?.attributes && (
                                                                                    <div className="bg-muted/30 rounded-md border p-2.5">
                                                                                        <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                                                                                            New Values
                                                                                        </p>
                                                                                        <div className="grid gap-1.5 text-xs">
                                                                                            {Object.entries(activity.properties.attributes).map(
                                                                                                ([key, value]) => (
                                                                                                    <div
                                                                                                        key={key}
                                                                                                        className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2"
                                                                                                    >
                                                                                                        <span className="text-muted-foreground font-medium">
                                                                                                            {key}:
                                                                                                        </span>
                                                                                                        <span className="text-foreground break-all">
                                                                                                            {String(value)}
                                                                                                        </span>
                                                                                                    </div>
                                                                                                ),
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {activity.properties?.old && (
                                                                                    <div className="bg-muted/30 rounded-md border p-2.5">
                                                                                        <p className="text-muted-foreground mb-1.5 text-[10px] font-semibold tracking-wider uppercase">
                                                                                            Previous Values
                                                                                        </p>
                                                                                        <div className="grid gap-1.5 text-xs">
                                                                                            {Object.entries(activity.properties.old).map(
                                                                                                ([key, value]) => (
                                                                                                    <div
                                                                                                        key={key}
                                                                                                        className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2"
                                                                                                    >
                                                                                                        <span className="text-muted-foreground font-medium">
                                                                                                            {key}:
                                                                                                        </span>
                                                                                                        <span className="text-muted-foreground break-all line-through">
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
                        <AlertDialogAction onClick={() => router.post(`/requisition/${requisition.id}/copy`)}>Duplicate</AlertDialogAction>
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
