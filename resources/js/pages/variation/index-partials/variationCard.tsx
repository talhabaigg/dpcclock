import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { Copy, Download, EllipsisVertical, MapPin, Pencil, Send, Trash } from 'lucide-react';

export interface Variation {
    id: number;
    co_number: string;
    co_date: string;
    status: string;
    description: string;
    type: string;
    line_items_sum_total_cost: number | string;
    line_items_sum_revenue: number | string;
    location?: { name: string };
}

const isSentOrApproved = (status: string) => status === 'sent' || status === 'Approved';

const statusConfig: Record<string, { label: string; classes: string }> = {
    pending: {
        label: 'Pending',
        classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    },
    sent: {
        label: 'Sent',
        classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    },
    Approved: {
        label: 'Approved',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    },
    draft: {
        label: 'Draft',
        classes: 'bg-muted text-muted-foreground border',
    },
    rejected: {
        label: 'Rejected',
        classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
    },
};

function getStatus(status: string) {
    return statusConfig[status] ?? { label: status, classes: 'bg-muted text-muted-foreground border' };
}

function formatCurrency(value: number | string) {
    return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const VariationCard = ({ variation }: { variation: Variation }) => {
    const status = getStatus(variation.status);
    const locked = isSentOrApproved(variation.status);
    const cost = Number(variation.line_items_sum_total_cost) || 0;
    const revenue = Number(variation.line_items_sum_revenue) || 0;
    const margin = revenue - cost;

    return (
        <Link href={`/variations/${variation.id}/edit`} className="block max-w-full min-w-0">
            <Card className="group relative gap-0 overflow-hidden py-0 transition-all duration-150 hover:shadow-md hover:ring-1 hover:ring-ring/20 active:scale-[0.99]">
                <div className="space-y-2 px-3 py-3">
                    {/* Row 1: CO Number + Status badge */}
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold">
                            {variation.co_number}
                        </span>
                        <Badge variant="outline" className={cn('text-[10px] capitalize', status.classes)}>
                            {status.label}
                        </Badge>
                    </div>

                    {/* Row 2: Description */}
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                        {variation.description || 'No description'}
                    </p>

                    {/* Row 3: Financials */}
                    <div className="flex flex-col gap-0.5 text-xs tabular-nums">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cost</span>
                            <span className="font-semibold">{formatCurrency(cost)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Revenue</span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t pt-0.5">
                            <span className="text-muted-foreground">Margin</span>
                            <span className={cn('font-bold', margin >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                                {formatCurrency(margin)}
                            </span>
                        </div>
                    </div>

                    {/* Row 4: Location + Date + Actions */}
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                        <div className="flex min-w-0 flex-1 items-center gap-x-2 text-[11px] text-muted-foreground">
                            {variation.location && (
                                <span className="flex items-center gap-1 truncate">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    {variation.location.name}
                                </span>
                            )}
                            <span className="shrink-0 tabular-nums">{new Date(variation.co_date).toLocaleDateString('en-GB')}</span>
                        </div>

                        <div
                            className="shrink-0"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                            }}
                        >
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 text-muted-foreground"
                                    >
                                        <EllipsisVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                    <a href={`/variations/${variation.id}/download/excel`}>
                                        <DropdownMenuItem className="gap-2">
                                            <Download className="h-4 w-4" />
                                            Download Excel
                                        </DropdownMenuItem>
                                    </a>
                                    <DropdownMenuItem
                                        disabled={locked}
                                        className="gap-2"
                                        onClick={() => router.visit(`/variations/${variation.id}/edit`)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="gap-2"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to duplicate this variation?')) {
                                                router.visit(`/variations/${variation.id}/duplicate`);
                                            }
                                        }}
                                    >
                                        <Copy className="h-4 w-4" />
                                        Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        disabled={locked}
                                        className="gap-2"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to send this variation to Premier?')) {
                                                router.visit(`/variations/${variation.id}/send-to-premier`);
                                            }
                                        }}
                                    >
                                        <Send className="h-4 w-4" />
                                        Send to Premier
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="gap-2 text-red-600 focus:text-red-600"
                                        onClick={() => {
                                            if (confirm('Are you sure you want to delete this variation?')) {
                                                router.visit(`/variations/${variation.id}`);
                                            }
                                        }}
                                    >
                                        <Trash className="h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </Card>
        </Link>
    );
};

export default VariationCard;