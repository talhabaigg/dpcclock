import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useInitials } from '@/hooks/use-initials';
import { Link } from '@inertiajs/react';
import { CircleCheck, EllipsisVertical, TruckIcon } from 'lucide-react';
import AddNoteButton from './addNoteButton';
import LatestNoteButton from './latestNoteButton';
import { Requisition } from './types';
interface RequisitionCardProps {
    requisition: Requisition;
}

const RequisitionCard = ({ requisition }: RequisitionCardProps) => {
    useInitials();
    return (
        <Card className="p-2 shadow-md">
            <CardTitle className="flex justify-between">
                <div>{requisition.id}</div>
                {requisition.po_number ? <>PO{requisition.po_number}</> : 'Not generated'}
            </CardTitle>{' '}
            {/* Replace 'title' with an actual field from Requisition */}
            <CardDescription className="p-0">
                <div className="flex justify-between">
                    <Label>Project</Label>
                    <Label className="">{requisition.location.name}</Label>
                </div>

                {requisition.notes.length > 0 && (
                    <div className="mt-2">
                        <LatestNoteButton requisition={requisition} />
                    </div>
                )}

                <div>
                    <Accordion type="single" collapsible className="p-0">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>View Details</AccordionTrigger>
                            <AccordionContent>
                                <div className="flex justify-between">
                                    <Label>Template</Label>
                                    <Label>{requisition.is_template ? 'yes' : 'no'}</Label>
                                </div>

                                <div className="flex justify-between">
                                    <Label>Supplier</Label>
                                    <Label>{requisition.supplier.name}</Label>
                                </div>
                                <div className="flex justify-between">
                                    <Label>Status</Label>
                                    <Label>{requisition.status}</Label>
                                </div>
                                <div className="flex justify-between">
                                    <Label>Order Ref</Label>
                                    <Label>{requisition.order_reference ? requisition.order_reference : '-'}</Label>
                                </div>
                                <div className="flex justify-between">
                                    <Label>Required Date</Label>
                                    <Label>{new Date(requisition.date_required).toLocaleDateString('en-GB')}</Label>
                                </div>
                                <div className="flex justify-between">
                                    <Label>Create Date</Label>
                                    <Label>{new Date(requisition.created_at).toLocaleDateString('en-GB')}</Label>
                                </div>
                                <div className="flex justify-between">
                                    <Label>Created by</Label>
                                    <Label>{requisition.creator.name}</Label>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </CardDescription>
            <CardFooter className="-mt-8 flex justify-between p-0">
                <div className="space-x-2">
                    <Badge> {requisition.supplier.code}</Badge>
                    <Badge variant="secondary">${(Number(requisition.line_items_sum_total_cost) || 0).toFixed(2)}</Badge>
                </div>

                <div className="flex items-center">
                    <div className="mr-1">
                        <AddNoteButton requisition_id={requisition.id} />
                    </div>
                    <div className="flex items-center">
                        {requisition.status === 'success' && (
                            <Link href={`/requisition/${requisition.id}/mark-sent-to-supplier`}>
                                <Button variant="ghost" className="size-8">
                                    <CircleCheck className="h-24 w-24" />
                                </Button>
                            </Link>
                        )}
                        {requisition.status === 'sent' && (
                            <Button variant="ghost" className="size-8" disabled title="Sent to supplier">
                                <TruckIcon />
                            </Button>
                        )}
                        <div className="flex items-center gap-2 sm:hidden">
                            <Link href={`/requisition/${requisition.id}`}>
                                <Button>Open</Button>
                            </Link>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild className="hidden rounded-sm p-1 hover:bg-gray-200 sm:block">
                            <EllipsisVertical size={24} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <Link href={`/requisition/${requisition.id}`}>
                                <DropdownMenuItem>View </DropdownMenuItem>
                            </Link>
                            <Link href={`/requisition/${requisition.id}/copy`}>
                                <DropdownMenuItem>Copy </DropdownMenuItem>
                            </Link>{' '}
                            <Link href={`/requisition/${requisition.id}/toggle-requisition-template`}>
                                <DropdownMenuItem>{requisition.is_template ? 'Remove template' : 'Mark template'}</DropdownMenuItem>
                            </Link>
                            <Link href={`/requisition/${requisition.id}/delete`} className="text-red-500">
                                <DropdownMenuItem> Delete</DropdownMenuItem>
                            </Link>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardFooter>
        </Card>
    );
};

export default RequisitionCard;
