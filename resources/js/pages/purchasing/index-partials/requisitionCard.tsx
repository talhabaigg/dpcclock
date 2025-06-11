import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
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
import { Link } from '@inertiajs/react';
import { EllipsisVertical } from 'lucide-react';
import { Requisition } from './types';
interface RequisitionCardProps {
    requisition: Requisition;
}

const RequisitionCard = ({ requisition }: RequisitionCardProps) => {
    return (
        <Card className="p-3">
            <CardTitle className="flex justify-between">
                <div>{requisition.id}</div>
                {requisition.po_number ? <>PO{requisition.po_number}</> : 'Not generated'}
            </CardTitle>{' '}
            {/* Replace 'title' with an actual field from Requisition */}
            <CardDescription>
                <div className="flex justify-between">
                    <Label>Project</Label>
                    <Label className="">{requisition.location.name}</Label>
                </div>
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
            </CardDescription>
            <CardFooter className="flex justify-between p-0">
                <div className="space-x-2">
                    <Badge> {requisition.supplier.code}</Badge>
                    <Badge variant="secondary">${requisition.line_items_sum_total_cost?.toFixed(2)}</Badge>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild className="rounded-sm p-1 hover:bg-gray-200">
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
            </CardFooter>
        </Card>
    );
};

export default RequisitionCard;
