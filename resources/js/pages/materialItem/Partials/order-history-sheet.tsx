import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Link } from '@inertiajs/react';
import { FileClock } from 'lucide-react';

const OrderHistorySheet = ({ orderHistory }: { orderHistory: any[] }) => {
    const fullOrders = orderHistory.filter((o) => o.requisition !== null);
    const sentOrders = fullOrders.filter((o) => o.requisition.status === 'sent');
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <FileClock />
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Order History</SheetTitle>
                    <SheetDescription>Here is a list of order history for this material item.</SheetDescription>
                </SheetHeader>
                <div className="mx-4 -mt-6">
                    <Card className="m-0 mt-4 max-w-96 p-0 text-sm sm:max-w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableCell>Price</TableCell>
                                    <TableCell>PO</TableCell>
                                    <TableCell>Req Id</TableCell>
                                    <TableCell>Price List</TableCell>
                                </TableRow>
                            </TableHeader>
                            {sentOrders.map((o) => {
                                return (
                                    <TableRow>
                                        <TableCell>${o.unit_cost}</TableCell>
                                        <TableCell>PO{o.requisition.po_number}</TableCell>
                                        <TableCell>
                                            <Link href={`/requisition/${o.requisition.id}`} className="text-blue-700 hover:underline">
                                                {o.requisition.id}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{o.price_list}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </Table>
                    </Card>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export default OrderHistorySheet;
