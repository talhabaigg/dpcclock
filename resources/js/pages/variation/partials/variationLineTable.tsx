import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { CircleDollarSign } from 'lucide-react';
const VariationLineTable = ({ data, costCodes, CostTypes, setData }) => {
    return (
        <Table className="m-2 max-w-96 min-w-full sm:max-w-full">
            <TableHeader>
                <TableRow>
                    <TableCell className="border-r">Line #</TableCell>
                    <TableCell className="border-r">Cost Item</TableCell>
                    <TableCell className="border-r">Cost Type</TableCell>
                    <TableCell className="border-r">Description</TableCell>
                    <TableCell className="border-r">Qty</TableCell>
                    <TableCell className="border-r">Unit Cost</TableCell>
                    <TableCell className="border-r">Total Cost</TableCell>
                    <TableCell>Revenue</TableCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.line_items.map((item, index) => (
                    <TableRow key={index}>
                        <TableCell className="max-w-16 border-r p-0">
                            <Label className="ml-2 border-0 shadow-none">{item.line_number} </Label>
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <Select
                                value={item.cost_item}
                                onValueChange={(value) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].cost_item = value;
                                    setData('line_items', newItems);
                                }}
                            >
                                <SelectTrigger className="w-full border-0 text-xs shadow-none">
                                    <SelectValue placeholder="Select cost item" />
                                </SelectTrigger>
                                <SelectContent>
                                    {costCodes.map((code) => (
                                        <SelectItem key={code.id} value={code.code}>
                                            <div className="flex flex-row text-xs">
                                                <Badge className="mr-2 text-[10px]">{code.code}</Badge>
                                                {code.description}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <Select
                                value={item.cost_type}
                                onValueChange={(value) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].cost_type = value;
                                    setData('line_items', newItems);
                                }}
                            >
                                <SelectTrigger className="w-full border-0 text-xs shadow-none">
                                    <SelectValue placeholder="Select cost type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CostTypes.map((code) => (
                                        <SelectItem key={code.id} value={code.value}>
                                            <div className="flex flex-row text-xs">
                                                <Badge className="mr-2 text-[10px]">{code.value}</Badge>
                                                {code.description}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="border-r p-0 text-[xs]">
                            <input
                                type="text"
                                className="ml-2 w-full border-0 py-2 shadow-none focus:outline-0"
                                value={item.description}
                                onInput={(e) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].description = (e.target as HTMLInputElement).value;
                                    setData('line_items', newItems);
                                }}
                            />
                        </TableCell>
                        <TableCell className="max-w-16 border-r p-0">
                            <input
                                type="number"
                                className="mx-2 ml-2 w-full border-0 py-2 pr-2 shadow-none focus:outline-0"
                                value={item.qty}
                                onInput={(e) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].qty = (e.target as HTMLInputElement).value;
                                    newItems[index].total_cost = parseFloat((e.target as HTMLInputElement).value) * item.unit_cost;
                                    setData('line_items', newItems);
                                }}
                            />
                        </TableCell>
                        <TableCell className="max-w-32 border-r p-0">
                            <div className="flex flex-row items-center">
                                {' '}
                                <CircleDollarSign className="mx-2 ml-2 h-6 w-6" />
                                <input
                                    type="number"
                                    className="mx-2 ml-2 w-full border-0 py-2 pr-2 shadow-none focus:outline-0"
                                    value={item.unit_cost}
                                    onInput={(e) => {
                                        const newItems = [...data.line_items];
                                        newItems[index].unit_cost = (e.target as HTMLInputElement).value;
                                        newItems[index].total_cost = parseFloat((e.target as HTMLInputElement).value) * item.qty;
                                        setData('line_items', newItems);
                                    }}
                                />
                            </div>
                        </TableCell>

                        <TableCell className="max-w-32 border-r p-0">
                            <div className="flex flex-row items-center">
                                <CircleDollarSign className="mx-2 ml-2 h-6 w-6" />
                                <input
                                    type="number"
                                    className="mx-2 ml-2 w-full border-0 py-2 pr-2 shadow-none focus:outline-0"
                                    value={item.total_cost}
                                    onInput={(e) => {
                                        const newItems = [...data.line_items];
                                        newItems[index].total_cost = (e.target as HTMLInputElement).value;
                                        setData('line_items', newItems);
                                    }}
                                />
                            </div>
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <div className="flex flex-row items-center">
                                <>
                                    <CircleDollarSign className="mx-2 ml-2 h-6 w-6" />
                                    <input
                                        type="number"
                                        className="mx-2 ml-2 w-full border-0 py-2 pr-2 shadow-none focus:outline-0"
                                        value={item.revenue}
                                        onInput={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].revenue = (e.target as HTMLInputElement).value;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                </>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
export default VariationLineTable;
