import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useInitials } from '@/hooks/use-initials';
import { Link } from '@inertiajs/react';
import { CircleCheck, EllipsisVertical, TruckIcon } from 'lucide-react';
import AddNoteButton from './addNoteButton';
import LatestNoteButton from './latestNoteButton';
import { Requisition } from './types';
interface RequisitionCardProps {
    requisition: Requisition;
}

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'success':
            return { bg: 'bg-amber-500', text: 'Awaiting', color: 'text-amber-600' };
        case 'sent':
            return { bg: 'bg-emerald-500', text: 'Sent', color: 'text-emerald-600' };
        case 'pending':
            return { bg: 'bg-slate-400', text: 'Pending', color: 'text-slate-500' };
        default:
            return { bg: 'bg-slate-400', text: status, color: 'text-slate-500' };
    }
};

const RequisitionCard = ({ requisition }: RequisitionCardProps) => {
    useInitials();
    const statusConfig = getStatusConfig(requisition.status);
    const cost = Number(requisition.line_items_sum_total_cost) || 0;

    return (
        <Link href={`/requisition/${requisition.id}`} className="block max-w-full min-w-0">
            <Card className="group dark:border-border dark:bg-card dark:hover:bg-muted/50 relative overflow-hidden border-l-4 border-l-transparent bg-white transition-all duration-200 hover:border-l-blue-500 hover:shadow-md active:scale-[0.99] dark:hover:border-l-blue-400">
                {/* Status indicator dot */}
                <div className={`absolute top-3 right-3 h-3 w-3 rounded-full md:h-2.5 md:w-2.5 ${statusConfig.bg}`} title={statusConfig.text} />

                <div className="p-3 sm:p-3">
                    {/* Row 1: Amount + PO */}
                    <div className="mb-2 flex items-baseline justify-between gap-2">
                        <span className="text-lg font-bold text-slate-900 tabular-nums sm:text-xl dark:text-white">
                            ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {requisition.po_number ? (
                            <span className="shrink-0 rounded-md bg-blue-100 px-2 py-1 font-mono text-xs font-bold text-blue-700 sm:text-sm dark:bg-blue-900/50 dark:text-blue-300">
                                PO{requisition.po_number}
                            </span>
                        ) : (
                            <span className="text-xs text-slate-400">No PO</span>
                        )}
                    </div>

                    {/* Row 2: Supplier */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{requisition.supplier?.name}</span>
                        <span className="dark:bg-muted hidden shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500 sm:inline dark:text-slate-400">
                            {requisition.supplier?.code}
                        </span>
                    </div>

                    {/* Row 3: Metadata line */}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">
                        <span className="font-mono font-medium">#{requisition.id}</span>
                        <span className="hidden text-slate-300 sm:inline dark:text-slate-600">|</span>
                        <span className="truncate">{requisition.location?.name || 'No project'}</span>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <span className="tabular-nums">{new Date(requisition.date_required).toLocaleDateString('en-GB')}</span>
                    </div>

                    {/* Notes indicator */}
                    {requisition.notes && requisition.notes.length > 0 && (
                        <div className="mt-2">
                            <LatestNoteButton requisition={requisition} />
                        </div>
                    )}
                </div>

                {/* Footer: Actions */}
                <div className="dark:border-border dark:bg-muted/30 flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-3 py-2 sm:py-1.5">
                    <span className={`text-xs font-medium capitalize sm:text-[11px] ${statusConfig.color}`}>{statusConfig.text}</span>
                    <div
                        className="flex items-center gap-1 sm:gap-0.5"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                    >
                        <AddNoteButton requisition_id={requisition.id} />

                        {requisition.status === 'success' && (
                            <Link href={`/requisition/${requisition.id}/mark-sent-to-supplier`}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 rounded text-slate-400 transition-colors hover:bg-emerald-100 hover:text-emerald-600 sm:h-6 sm:w-6 dark:hover:bg-emerald-900/50 dark:hover:text-emerald-400"
                                >
                                    <CircleCheck className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                </Button>
                            </Link>
                        )}
                        {requisition.status === 'sent' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 rounded text-emerald-500 sm:h-6 sm:w-6" disabled>
                                <TruckIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 sm:h-6 sm:w-6 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                >
                                    <EllipsisVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 sm:w-40">
                                <Link href={`/requisition/${requisition.id}`}>
                                    <DropdownMenuItem className="py-2.5 text-sm sm:py-1.5 sm:text-xs">View Details</DropdownMenuItem>
                                </Link>
                                <Link href={`/requisition/${requisition.id}/copy`}>
                                    <DropdownMenuItem className="py-2.5 text-sm sm:py-1.5 sm:text-xs">Duplicate</DropdownMenuItem>
                                </Link>
                                <Link href={`/requisition/${requisition.id}/toggle-requisition-template`}>
                                    <DropdownMenuItem className="py-2.5 text-sm sm:py-1.5 sm:text-xs">
                                        {requisition.is_template ? 'Remove Template' : 'Save as Template'}
                                    </DropdownMenuItem>
                                </Link>
                                <DropdownMenuSeparator />
                                <Link href={`/requisition/${requisition.id}/delete`}>
                                    <DropdownMenuItem className="py-2.5 text-sm text-red-600 focus:text-red-600 sm:py-1.5 sm:text-xs">
                                        Delete
                                    </DropdownMenuItem>
                                </Link>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </Card>
        </Link>
    );
};

export default RequisitionCard;
