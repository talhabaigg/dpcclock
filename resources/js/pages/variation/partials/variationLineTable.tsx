import { SearchSelect } from '@/components/search-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useState } from 'react';
import SearchSelectWithBadgeItem from './SearchSelectWithBadgeItem';

interface VariationLineTableProps {
    data: any;
    costCodes: any[];
    CostTypes: { value: string; description: string }[];
    setData: (key: string, value: any) => void;
    onDeleteRow?: (index: number) => void;
}

// Mobile card component for each line item
const MobileLineCard = ({
    item,
    index,
    costCodes,
    CostTypes,
    data,
    setData,
    onDeleteRow,
}: {
    item: any;
    index: number;
    costCodes: any[];
    CostTypes: { value: string; description: string }[];
    data: any;
    setData: (key: string, value: any) => void;
    onDeleteRow?: (index: number) => void;
}) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const updateField = (field: string, value: any) => {
        const newItems = [...data.line_items];
        newItems[index][field] = value;

        // Auto-calculate total cost when qty or unit_cost changes
        if (field === 'qty' || field === 'unit_cost') {
            const qty = field === 'qty' ? parseFloat(value) || 0 : parseFloat(newItems[index].qty) || 0;
            const unitCost = field === 'unit_cost' ? parseFloat(value) || 0 : parseFloat(newItems[index].unit_cost) || 0;
            const wasteRatio = newItems[index].waste_ratio ? parseFloat(newItems[index].waste_ratio) / 100 : 0;
            newItems[index].total_cost = unitCost * qty + unitCost * qty * wasteRatio;
        }

        // Update cost type when cost item changes
        if (field === 'cost_item') {
            newItems[index].cost_type = costCodes.find((code) => code.code === value)?.cost_type?.code || '';
            newItems[index].waste_ratio = costCodes.find((code) => code.code === value)?.pivot?.waste_ratio || '';
        }

        setData('line_items', newItems);
    };

    return (
        <div
            className={cn(
                'group relative rounded-lg border bg-card transition-all duration-200',
                'hover:shadow-md hover:border-primary/20',
                item.cost_type === 'REV' && 'border-l-4 border-l-green-500',
            )}
        >
            {/* Header - Always visible */}
            <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {item.line_number}
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.description || 'No description'}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {item.cost_item && (
                            <Badge variant="secondary" className="text-xs">
                                {item.cost_item}
                            </Badge>
                        )}
                        {item.cost_type && (
                            <Badge variant="outline" className="text-xs">
                                {CostTypes.find((t) => t.value === item.cost_type)?.description?.split(' - ')[1] || item.cost_type}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-sm font-semibold">
                        ${parseFloat(item.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {item.revenue > 0 && (
                        <p className="text-xs text-green-600">
                            +${parseFloat(item.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="border-t bg-muted/30 p-4 space-y-4">
                    {/* Cost Item & Type Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost Item</Label>
                            <SearchSelectWithBadgeItem
                                options={costCodes}
                                value={item.cost_item}
                                optionName="cost item"
                                onValueChange={(value) => updateField('cost_item', value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost Type</Label>
                            <SearchSelect
                                selectedOption={item.cost_type}
                                onValueChange={(value) => updateField('cost_type', value)}
                                options={CostTypes.map((costType) => ({
                                    value: costType.value,
                                    label: costType.description,
                                }))}
                                optionName="Cost Type"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</Label>
                        <Textarea
                            placeholder="Enter line item description..."
                            className="min-h-[60px] resize-none"
                            value={item.description}
                            onChange={(e) => updateField('description', e.target.value)}
                        />
                    </div>

                    {/* Numeric Fields Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qty</Label>
                            <Input
                                type="number"
                                step="0.01"
                                disabled={item.cost_type === 'REV'}
                                value={item.qty}
                                onChange={(e) => updateField('qty', e.target.value)}
                                className="text-right"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Unit Cost</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    disabled={item.cost_type === 'REV'}
                                    value={item.unit_cost}
                                    onChange={(e) => updateField('unit_cost', e.target.value)}
                                    className="pl-7 text-right"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wastage</Label>
                            <div className="relative">
                                <Input type="number" disabled value={item.waste_ratio || ''} className="pr-7 text-right bg-muted" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Cost</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    disabled={item.cost_type === 'REV'}
                                    value={item.total_cost}
                                    onChange={(e) => updateField('total_cost', e.target.value)}
                                    className="pl-7 text-right font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Revenue Field - Only for REV type */}
                    {item.cost_type === 'REV' && (
                        <div className="space-y-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                            <Label className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                                Revenue
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 text-sm">$</span>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={item.revenue}
                                    onChange={(e) => updateField('revenue', e.target.value)}
                                    className="pl-7 text-right font-medium border-green-300 focus:border-green-500 focus:ring-green-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* Delete Button */}
                    {onDeleteRow && data.line_items.length > 1 && (
                        <div className="pt-2 border-t">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
                                onClick={() => onDeleteRow(index)}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Line Item
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Enhanced Desktop Table
const DesktopTable = ({ data, costCodes, CostTypes, setData, onDeleteRow }: VariationLineTableProps) => {
    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-12 text-center font-semibold">#</TableHead>
                        <TableHead className="min-w-[200px] font-semibold">Cost Item</TableHead>
                        <TableHead className="min-w-[140px] font-semibold">Cost Type</TableHead>
                        <TableHead className="min-w-[180px] font-semibold">Description</TableHead>
                        <TableHead className="w-24 text-right font-semibold">Qty</TableHead>
                        <TableHead className="w-28 text-right font-semibold">Unit Cost</TableHead>
                        <TableHead className="w-24 text-right font-semibold">Waste %</TableHead>
                        <TableHead className="w-32 text-right font-semibold">Total Cost</TableHead>
                        <TableHead className="w-32 text-right font-semibold">Revenue</TableHead>
                        <TableHead className="w-12"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.line_items.map((item: any, index: number) => (
                        <TableRow
                            key={index}
                            className={cn(
                                'group transition-colors',
                                item.cost_type === 'REV' && 'bg-green-50/50 dark:bg-green-950/10',
                            )}
                        >
                            <TableCell className="text-center">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium mx-auto">
                                    {item.line_number}
                                </div>
                            </TableCell>
                            <TableCell className="p-2">
                                <SearchSelectWithBadgeItem
                                    options={costCodes}
                                    value={item.cost_item}
                                    optionName="cost item"
                                    onValueChange={(value) => {
                                        const newItems = [...data.line_items];
                                        newItems[index].cost_item = value;
                                        newItems[index].cost_type =
                                            costCodes.find((code) => code.code === value)?.cost_type?.code || '';
                                        newItems[index].waste_ratio =
                                            costCodes.find((code) => code.code === value)?.pivot?.waste_ratio || '';
                                        setData('line_items', newItems);
                                    }}
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <SearchSelect
                                    selectedOption={item.cost_type}
                                    onValueChange={(value) => {
                                        const newItems = [...data.line_items];
                                        newItems[index].cost_type = value;
                                        setData('line_items', newItems);
                                    }}
                                    options={CostTypes.map((costType) => ({
                                        value: costType.value,
                                        label: costType.description,
                                    }))}
                                    optionName="Cost Type"
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <Textarea
                                    placeholder="Description..."
                                    className="min-h-[36px] h-9 py-2 resize-none text-sm"
                                    rows={1}
                                    value={item.description}
                                    onChange={(e) => {
                                        const newItems = [...data.line_items];
                                        newItems[index].description = e.target.value;
                                        setData('line_items', newItems);
                                    }}
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    disabled={item.cost_type === 'REV'}
                                    className="w-20 text-right text-sm"
                                    value={item.qty}
                                    onChange={(e) => {
                                        const newItems = [...data.line_items];
                                        newItems[index].qty = e.target.value;
                                        newItems[index].total_cost = parseFloat(e.target.value) * item.unit_cost;
                                        setData('line_items', newItems);
                                    }}
                                />
                            </TableCell>
                            <TableCell className="p-2">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        disabled={item.cost_type === 'REV'}
                                        className="w-24 pl-5 text-right text-sm"
                                        value={item.unit_cost}
                                        onChange={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].unit_cost = e.target.value;
                                            const wasteRatio = newItems[index].waste_ratio
                                                ? parseFloat(newItems[index].waste_ratio) / 100
                                                : 0;
                                            newItems[index].total_cost =
                                                parseFloat(e.target.value) * item.qty +
                                                parseFloat(e.target.value) * item.qty * wasteRatio;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                </div>
                            </TableCell>
                            <TableCell className="p-2">
                                <div className="relative">
                                    <Input
                                        type="number"
                                        disabled
                                        className="w-20 pr-5 text-right text-sm bg-muted/50"
                                        value={item.waste_ratio || ''}
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                                </div>
                            </TableCell>
                            <TableCell className="p-2">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        disabled={item.cost_type === 'REV'}
                                        className="w-28 pl-5 text-right text-sm font-medium"
                                        value={item.total_cost}
                                        onChange={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].total_cost = e.target.value;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                </div>
                            </TableCell>
                            <TableCell className="p-2">
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-green-600 text-xs">$</span>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        disabled={item.cost_type !== 'REV'}
                                        className={cn(
                                            'w-28 pl-5 text-right text-sm',
                                            item.cost_type === 'REV' &&
                                                'border-green-300 bg-green-50 dark:bg-green-950/20 font-medium text-green-700 dark:text-green-400',
                                        )}
                                        value={item.revenue}
                                        onChange={(e) => {
                                            const newItems = [...data.line_items];
                                            newItems[index].revenue = e.target.value;
                                            setData('line_items', newItems);
                                        }}
                                    />
                                </div>
                            </TableCell>
                            <TableCell className="p-1">
                                {onDeleteRow && data.line_items.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                        onClick={() => onDeleteRow(index)}
                                        aria-label={`Delete line ${index + 1}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

const VariationLineTable = ({ data, costCodes, CostTypes, setData, onDeleteRow }: VariationLineTableProps) => {
    return (
        <>
            {/* Mobile: Card Layout */}
            <div className="lg:hidden space-y-3 p-4">
                {data.line_items.map((item: any, index: number) => (
                    <MobileLineCard
                        key={index}
                        item={item}
                        index={index}
                        costCodes={costCodes}
                        CostTypes={CostTypes}
                        data={data}
                        setData={setData}
                        onDeleteRow={onDeleteRow}
                    />
                ))}
            </div>

            {/* Desktop: Table Layout */}
            <div className="hidden lg:block">
                <DesktopTable data={data} costCodes={costCodes} CostTypes={CostTypes} setData={setData} onDeleteRow={onDeleteRow} />
            </div>
        </>
    );
};

export default VariationLineTable;
