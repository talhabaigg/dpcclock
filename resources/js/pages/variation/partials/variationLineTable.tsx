import { SearchSelect } from '@/components/search-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { CirclePlus } from 'lucide-react';
import SearchSelectWithBadgeItem from './SearchSelectWithBadgeItem';
const VariationLineTable = ({ data, costCodes, CostTypes, setData }) => {
    return (
        <Table className="">
            <TableHeader>
                <TableRow>
                    <TableCell className="border-r text-center">Line #</TableCell>
                    <TableCell className="border-r text-center">Cost Item</TableCell>
                    <TableCell className="border-r text-center">Cost Type</TableCell>
                    <TableCell className="border-r text-center">Description</TableCell>
                    <TableCell className="border-r text-center">Qty</TableCell>
                    <TableCell className="border-r text-center">Unit Cost</TableCell>
                    <TableCell className="border-r text-center">Wastage %</TableCell>
                    <TableCell className="border-r text-center">Total Cost</TableCell>
                    <TableCell className="text-center">Revenue</TableCell>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.line_items.map((item, index) => (
                    <TableRow key={index}>
                        <TableCell className="max-w-16 border-r p-0">
                            <Label className="mx-auto ml-2 border-0 shadow-none">{item.line_number} </Label>
                        </TableCell>
                        <TableCell className="w-64 max-w-64 border-r p-2">
                            <SearchSelectWithBadgeItem
                                options={costCodes}
                                value={item.cost_item}
                                optionName="cost item"
                                onValueChange={(value) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].cost_item = value;
                                    newItems[index].cost_type = costCodes.find((code) => code.code === value)?.cost_type?.code || '';
                                    newItems[index].waste_ratio = costCodes.find((code) => code.code === value)?.pivot?.waste_ratio || '';
                                    setData('line_items', newItems);
                                }}
                            />
                            {/* <Select
                                value={item.cost_item}
                                onValueChange={(value) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].cost_item = value;
                                    newItems[index].cost_type = costCodes.find((code) => code.code === value)?.cost_type?.code || '';
                                    console.log(newItems[index].cost_type);
                                    setData('line_items', newItems);
                                }}
                            >
                                <SelectTrigger className="w-full border-0 text-xs shadow-none">
                                    <SelectValue placeholder="Select cost item" />
                                </SelectTrigger>
                                <SelectContent>
                                    {costCodes.map((code) => (
                                        <SelectItem key={code.id} value={code.code}>
                                            <div className="flex flex-row items-center text-xs">
                                                <Badge className="mr-2 text-[10px]">{code.code}</Badge>
                                                {code.description}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select> */}
                        </TableCell>
                        <TableCell className="mx-2 border-r p-0 px-2">
                            <SearchSelect
                                selectedOption={item.cost_type}
                                onValueChange={(value) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].cost_type = value;
                                    setData('line_items', newItems);
                                }}
                                options={CostTypes.map((costType) => ({ value: costType.value, label: costType.description }))}
                                optionName="Cost Type"
                            />

                            {/* <Select
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
                                            <div className="flex flex-row items-center text-xs">
                                                <Badge className="mr-2 text-[10px]">{code.value}</Badge>
                                                {code.description}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select> */}
                        </TableCell>
                        <TableCell className="max-w-52 border-r text-[xs]">
                            <Textarea
                                className="h-auto min-h-[32px] py-1 leading-tight"
                                placeholder="Enter description"
                                rows={2}
                                value={item.description}
                                onInput={(e) => {
                                    const newItems = [...data.line_items];
                                    newItems[index].description = (e.target as HTMLTextAreaElement).value;
                                    setData('line_items', newItems);
                                }}
                            />
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <div className="flex flex-row items-center">
                                <div className="relative mx-auto">
                                    <Input
                                        disabled={item.cost_type === 'REV'}
                                        id="product_precio"
                                        placeholder="0.00"
                                        className="w-40 pr-10"
                                        value={item.qty}
                                        onInput={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].qty = (e.target as HTMLInputElement).value;
                                            newItems[index].total_cost = parseFloat((e.target as HTMLInputElement).value) * item.unit_cost;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-xs">EA</div>
                                </div>
                            </div>{' '}
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <div className="flex flex-row items-center">
                                <div className="relative mx-auto">
                                    <Input
                                        disabled={item.cost_type === 'REV'}
                                        id="product_precio"
                                        placeholder="0.00"
                                        className="w-40 pr-10"
                                        value={item.unit_cost}
                                        onInput={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].unit_cost = (e.target as HTMLInputElement).value;
                                            const wasteRatio = newItems[index].waste_ratio ? parseFloat(newItems[index].waste_ratio) / 100 : 0;
                                            newItems[index].total_cost =
                                                parseFloat((e.target as HTMLInputElement).value) * item.qty +
                                                parseFloat((e.target as HTMLInputElement).value) * item.qty * wasteRatio;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">$</div>
                                </div>{' '}
                            </div>
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <div className="flex flex-row items-center">
                                <div className="relative mx-auto flex items-center">
                                    <CirclePlus className="mr-2 w-4" />
                                    <Input
                                        disabled={true}
                                        id="product_precio"
                                        placeholder="0.00"
                                        className="w-40 pr-10"
                                        value={item.waste_ratio}
                                        onInput={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].waste_ratio = (e.target as HTMLInputElement).value;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">%</div>
                                </div>
                            </div>
                        </TableCell>

                        <TableCell className="border-r p-0">
                            <div className="flex flex-row items-center">
                                <div className="relative mx-auto">
                                    <Input
                                        disabled={item.cost_type === 'REV'}
                                        id="product_precio"
                                        placeholder="0.00"
                                        className="w-40 pr-10"
                                        value={item.total_cost}
                                        onInput={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].total_cost = (e.target as HTMLInputElement).value;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">$</div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell className="border-r p-0">
                            <div className="flex flex-row items-center">
                                <div className="relative mx-2 sm:mx-auto">
                                    <Input
                                        id="product_precio"
                                        placeholder="0.00"
                                        className="w-40 pr-10"
                                        disabled={item.cost_type !== 'REV'}
                                        value={item.revenue}
                                        onInput={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].revenue = (e.target as HTMLInputElement).value;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">$</div>
                                </div>
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};
export default VariationLineTable;
