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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { CircleCheck, EllipsisVertical, TruckIcon } from 'lucide-react';
import { useState } from 'react';

import AddNoteButton from './addNoteButton';
import LatestNoteButton from './latestNoteButton';
import { getStatus, TONE_STYLES } from './statusConfig';
import { Requisition } from './types';

interface RequisitionCardProps {
    requisition: Requisition;
    index?: number;
}

const RequisitionCard = ({ requisition, index = 0 }: RequisitionCardProps) => {
    const status = getStatus(requisition.status);
    const tone = TONE_STYLES[status.tone];
    const cost = Number(requisition.line_items_sum_total_cost) || 0;
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <>
            <Link
                href={`/requisition/${requisition.id}`}
                className="card-enter block max-w-full min-w-0"
                style={{ ['--card-index' as string]: index }}
            >
                <Card className="group bg-card hover:bg-muted/30 relative overflow-hidden rounded-md border py-0 transition-colors duration-150 ease-out">
                    <span
                        className={cn('absolute inset-y-0 left-0 w-[2px]', tone.band)}
                        aria-hidden
                    />

                    <div className="px-3 pt-2.5 pb-2 pl-[13px]">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="tabular-nums text-base font-semibold">
                                ${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            {requisition.po_number ? (
                                <span className="bg-muted text-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                                    PO{requisition.po_number}
                                </span>
                            ) : (
                                <span className="text-muted-foreground text-[11px]">No PO</span>
                            )}
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{requisition.supplier?.name}</span>
                            {requisition.supplier?.code && (
                                <span className="bg-muted text-muted-foreground hidden shrink-0 rounded px-1 py-0.5 text-[10px] font-medium sm:inline">
                                    {requisition.supplier.code}
                                </span>
                            )}
                        </div>

                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                            <span className="font-mono">#{requisition.id}</span>
                            <span className="text-border">·</span>
                            <span className="truncate">{requisition.location?.name || 'No project'}</span>
                            <span className="text-border">·</span>
                            <span className="tabular-nums">{new Date(requisition.date_required).toLocaleDateString('en-GB')}</span>
                        </div>

                        {requisition.notes && requisition.notes.length > 0 && (
                            <div className="mt-1.5">
                                <LatestNoteButton requisition={requisition} />
                            </div>
                        )}
                    </div>

                    <div className="bg-muted/20 border-border/50 flex items-center justify-between border-t px-3 py-1 pl-[13px]">
                        <span className={cn('text-[11px] font-medium', tone.text)}>
                            {status.label}
                        </span>
                        <div
                            className="flex items-center gap-0.5"
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
                                        className="text-muted-foreground hover:text-emerald-600 h-6 w-6 rounded dark:hover:text-emerald-400"
                                        title="Mark sent"
                                    >
                                        <CircleCheck className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            )}
                            {requisition.status === 'sent' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded text-emerald-500/80"
                                    disabled
                                >
                                    <TruckIcon className="h-3.5 w-3.5" />
                                </Button>
                            )}

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground h-6 w-6 rounded"
                                    >
                                        <EllipsisVertical className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    <Link href={`/requisition/${requisition.id}`}>
                                        <DropdownMenuItem className="text-xs">View Details</DropdownMenuItem>
                                    </Link>
                                    <DropdownMenuItem
                                        className="text-xs"
                                        onSelect={() => router.post(`/requisition/${requisition.id}/copy`)}
                                    >
                                        Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-xs"
                                        onSelect={() => router.post(`/requisition/${requisition.id}/toggle-requisition-template`)}
                                    >
                                        {requisition.is_template ? 'Remove Template' : 'Save as Template'}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive text-xs"
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            setDeleteOpen(true);
                                        }}
                                    >
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </Card>
            </Link>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Requisition #{requisition.id}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the requisition and all associated line items.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => router.delete(`/requisition/${requisition.id}`)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default RequisitionCard;
