import { DatePickerDemo } from '@/components/date-picker';
import LoadingDialog from '@/components/loading-dialog';
import { SearchSelect } from '@/components/search-select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import { Package, Plus, Save, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CostCode } from '../purchasing/types';
import VariationLineTable from './partials/variationLineTable';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Variations',
        href: '/variations',
    },
    {
        title: 'Create',
        href: '/variations/create',
    },
];

interface Location {
    id: number;
    name: string;
    cost_codes: CostCode[];
}

const CostTypes = [
    { value: 'LAB', description: '1 - Labour Direct' },
    { value: 'LOC', description: '2 - Labour Oncosts' },
    { value: 'CON', description: '3 - Contractor' },
    { value: 'COC', description: '4 - Contractor Oncosts' },
    { value: 'MAT', description: '5 - Materials' },
    { value: 'SIT', description: '6 - Site Costs' },
    { value: 'GEN', description: '7 - General Costs' },
    { value: 'EQH', description: '8 - Equipment Hire' },
    { value: 'PRO', description: '9 - Provisional Fees' },
    { value: 'REV', description: 'Revenue' },
];

const VariationCreate = ({ locations, costCodes, variation }: { locations: Location[]; costCodes: CostCode[]; variation?: any }) => {
    const { data, setData, post, errors } = useForm({
        location_id: variation ? String(variation.location_id) : '',
        type: variation ? variation.type : 'dayworks',
        co_number: variation ? variation.co_number : '',
        description: variation ? variation.description : '',
        amount: variation ? variation.amount : '',
        date: variation ? variation.co_date : new Date().toISOString().split('T')[0],
        line_items: variation
            ? variation.line_items.map((item: any) => ({
                  line_number: item.line_number,
                  cost_item: item.cost_item,
                  cost_type: item.cost_type,
                  description: item.description,
                  qty: item.qty,
                  unit_cost: item.unit_cost,
                  total_cost: item.total_cost,
                  revenue: item.revenue,
              }))
            : [
                  {
                      line_number: 1,
                      cost_item: '',
                      cost_type: '',
                      description: '',
                      qty: 1,
                      unit_cost: 0,
                      total_cost: 0,
                      revenue: 0,
                  },
              ],
    });

    const addRow = () => {
        setData('line_items', [
            ...data.line_items,
            {
                line_number: data.line_items.length + 1,
                cost_item: '',
                cost_type: '',
                description: '',
                qty: 1,
                unit_cost: 0,
                total_cost: 0,
                revenue: 0,
            },
        ]);
    };

    const deleteRow = (index: number) => {
        if (data.line_items.length <= 1) {
            toast.error('Cannot delete', {
                description: 'At least one line item is required.',
            });
            return;
        }
        const newItems = data.line_items
            .filter((_, i) => i !== index)
            .map((item, i) => ({
                ...item,
                line_number: i + 1,
            }));
        setData('line_items', newItems);
        toast.success('Line item deleted');
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (variation?.id) {
            post(`/variations/${variation.id}/update`);
            return;
        }
        post('/variations/store');
    };

    const [open, setOpen] = useState(false);
    const [genAmount, setGenAmount] = useState('');
    const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];
    const waste_ratio = costData.find((code) => code.pivot?.waste_ratio)?.pivot.waste_ratio || 0;

    useEffect(() => {
        // Update cost data when location changes
    }, [data.location_id, costData]);

    void waste_ratio;

    const generatePrelimLabour = () => {
        if (!genAmount || !data.location_id) {
            toast.error('Missing required fields', {
                description: 'Please select a location and enter an amount.',
            });
            return;
        }
        setOpen(true);
        setTimeout(() => {
            setOpen(false);
        }, 3000);

        const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];

        const onCostData = costData.map((code) => ({
            cost_item: code.code,
            cost_type: costCodes.find((costCode) => costCode.code === code.code)?.cost_type?.code || '',
            percent: code.pivot.variation_ratio / 100 || 0,
            prelim_type: code.pivot.prelim_type || '',
            description: code.description,
        }));

        const PrelimLab = onCostData.filter((item) => item.prelim_type === 'LAB');
        const baseAmount = parseFloat(genAmount);

        const newLines = PrelimLab.map((item, index) => {
            const lineAmount = +(baseAmount * item.percent).toFixed(2);
            return {
                line_number: data.line_items.length + index + 1,
                cost_item: item.cost_item,
                cost_type: item.cost_type,
                description: item.description,
                qty: 1,
                unit_cost: lineAmount,
                total_cost: lineAmount,
                revenue: 0,
            };
        });

        setData('line_items', [...data.line_items, ...newLines]);
        setGenAmount('');
        toast.success(`${newLines.length} labour lines added`, {
            description: `Based on $${parseFloat(genAmount).toLocaleString()}`,
        });
    };

    const generatePrelimMaterial = () => {
        if (!genAmount || !data.location_id) {
            toast.error('Missing required fields', {
                description: 'Please select a location and enter an amount.',
            });
            return;
        }
        setOpen(true);
        setTimeout(() => {
            setOpen(false);
        }, 3000);

        const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];

        const onCostData = costData.map((code) => ({
            cost_item: code.code,
            cost_type: costCodes.find((costCode) => costCode.code === code.code)?.cost_type?.code || '',
            percent: code.pivot.variation_ratio / 100 || 0,
            prelim_type: code.pivot.prelim_type || '',
            description: code.description,
        }));

        const PrelimMat = onCostData.filter((item) => item.prelim_type === 'MAT');
        const baseAmount = parseFloat(genAmount);

        const newLines = PrelimMat.map((item, index) => {
            const lineAmount = +(baseAmount * item.percent).toFixed(2);
            return {
                line_number: data.line_items.length + index + 1,
                cost_item: item.cost_item,
                cost_type: item.cost_type,
                description: item.description,
                qty: 1,
                unit_cost: lineAmount,
                total_cost: lineAmount,
                revenue: 0,
            };
        });

        setData('line_items', [...data.line_items, ...newLines]);
        setGenAmount('');
        toast.success(`${newLines.length} material lines added`, {
            description: `Based on $${parseFloat(genAmount).toLocaleString()}`,
        });
    };

    // Calculate totals
    const totals = useMemo(() => {
        const totalCost = data.line_items.reduce((sum, item) => sum + (parseFloat(String(item.total_cost)) || 0), 0);
        const totalRevenue = data.line_items.reduce((sum, item) => sum + (parseFloat(String(item.revenue)) || 0), 0);
        const margin = totalRevenue - totalCost;
        const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
        return { totalCost, totalRevenue, margin, marginPercent };
    }, [data.line_items]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <LoadingDialog open={open} setOpen={setOpen} />

            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                {/* Page Header */}
                <div className="mb-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                {variation ? 'Edit Variation' : 'Create Variation'}
                            </h1>
                            <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
                                {variation ? `Editing CO #${variation.co_number}` : 'Add a new variation with cost line items'}
                            </p>
                        </div>
                        <Button
                            onClick={handleSubmit}
                            size="lg"
                            className="hidden sm:flex w-full sm:w-auto shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
                        >
                            <Save className="mr-2 h-4 w-4" />
                            {variation ? 'Update Variation' : 'Save Variation'}
                        </Button>
                    </div>
                </div>

                {/* Error Alert */}
                {Object.keys(errors).length > 0 && (
                    <Alert variant="destructive" className="mb-6 border-l-4 border-l-destructive shadow-sm">
                        <AlertTitle className="font-semibold">Please fix the following errors:</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 mt-2 space-y-1">
                                {Object.entries(errors).map(([field, message]) => (
                                    <li key={field} className="text-sm">
                                        {message as string}
                                    </li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Responsive Layout */}
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    {/* Primary Content Area */}
                    <div className="space-y-6 order-2 lg:order-1">
                        {/* Variation Details Card */}
                        <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
                                <CardTitle className="text-lg">Variation Details</CardTitle>
                                <CardDescription>Enter the basic information for this variation</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="location" className="text-sm font-medium">
                                        Location <span className="text-destructive">*</span>
                                    </Label>
                                    <SearchSelect
                                        selectedOption={data.location_id}
                                        onValueChange={(value) => setData('location_id', value)}
                                        options={locations.map((location) => ({
                                            value: String(location.id),
                                            label: location.name,
                                        }))}
                                        optionName="Location"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="type" className="text-sm font-medium">
                                        Type <span className="text-destructive">*</span>
                                    </Label>
                                    <Select value={data.type} onValueChange={(value) => setData('type', value)}>
                                        <SelectTrigger id="type" className="h-10">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {['dayworks', 'variations'].map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="co_number" className="text-sm font-medium">
                                        CO Number
                                    </Label>
                                    <Input
                                        id="co_number"
                                        value={data.co_number}
                                        onChange={(e) => setData('co_number', e.target.value)}
                                        placeholder="e.g., CO-001"
                                        className="h-10"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="date" className="text-sm font-medium">
                                        Date
                                    </Label>
                                    <DatePickerDemo
                                        value={data.date ? new Date(data.date) : undefined}
                                        onChange={(date) => setData('date', date ? format(date, 'yyyy-MM-dd') : '')}
                                    />
                                </div>

                                <div className="space-y-2 sm:col-span-2">
                                    <Label htmlFor="description" className="text-sm font-medium">
                                        Description
                                    </Label>
                                    <Input
                                        id="description"
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                        placeholder="Enter a description for this variation"
                                        className="h-10"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Line Items Card */}
                        <Card className="shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                            <CardHeader className="bg-gradient-to-r from-muted/50 to-transparent border-b">
                                <div>
                                    <CardTitle className="text-lg">Line Items</CardTitle>
                                    <CardDescription>Add cost and revenue line items</CardDescription>
                                </div>
                                <CardAction>
                                    <Button onClick={addRow} size="sm" className="shadow-sm">
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        Add Row
                                    </Button>
                                </CardAction>
                            </CardHeader>
                            <CardContent className="p-0">
                                <VariationLineTable
                                    data={data}
                                    costCodes={costData}
                                    CostTypes={CostTypes}
                                    setData={setData}
                                    onDeleteRow={deleteRow}
                                />
                            </CardContent>

                            {/* Enhanced Footer */}
                            <CardFooter className="border-t bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 p-0">
                                <div className="w-full grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x">
                                    <div className="p-4 text-center sm:text-right">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                            Total Cost
                                        </p>
                                        <p className="text-xl sm:text-2xl font-bold tabular-nums">
                                            $
                                            {totals.totalCost.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>
                                    </div>
                                    <div className="p-4 text-center sm:text-right">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                            Total Revenue
                                        </p>
                                        <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-500 tabular-nums">
                                            $
                                            {totals.totalRevenue.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>
                                    </div>
                                    <div
                                        className={`p-4 text-center sm:text-right ${totals.margin >= 0 ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}
                                    >
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Margin</p>
                                        <p
                                            className={`text-xl sm:text-2xl font-bold tabular-nums ${totals.margin < 0 ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'}`}
                                        >
                                            $
                                            {totals.margin.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </p>
                                        <p className={`text-sm font-medium ${totals.margin < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {totals.marginPercent.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </CardFooter>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <aside className="space-y-4 order-1 lg:order-2">
                        {/* Quick Generate Card */}
                        <Card className="shadow-md overflow-hidden lg:sticky lg:top-4">
                            <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                    Quick Generate
                                </CardTitle>
                                <CardDescription>Auto-generate line items from a base amount</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="genAmount" className="text-sm font-medium">
                                        Base Amount
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                                            $
                                        </span>
                                        <Input
                                            id="genAmount"
                                            type="number"
                                            value={genAmount}
                                            onChange={(e) => setGenAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="pl-7 h-11 text-lg font-medium"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        onClick={generatePrelimLabour}
                                        variant="outline"
                                        className="h-11 border-2 hover:border-primary hover:bg-primary/5 transition-all"
                                        disabled={!genAmount || !data.location_id}
                                    >
                                        <Users className="mr-2 h-4 w-4" />
                                        Labour
                                    </Button>
                                    <Button
                                        onClick={generatePrelimMaterial}
                                        variant="outline"
                                        className="h-11 border-2 hover:border-primary hover:bg-primary/5 transition-all"
                                        disabled={!genAmount || !data.location_id}
                                    >
                                        <Package className="mr-2 h-4 w-4" />
                                        Material
                                    </Button>
                                </div>
                                {!data.location_id && (
                                    <p className="text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/20 rounded-md px-3 py-2">
                                        Select a location first to enable generation
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Summary Card */}
                        <Card className="shadow-md overflow-hidden">
                            <CardHeader className="pb-3 bg-gradient-to-r from-muted/50 to-transparent">
                                <CardTitle className="text-base">Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-0">
                                <div className="flex justify-between items-center py-3 border-b">
                                    <span className="text-sm text-muted-foreground">Line Items</span>
                                    <Badge variant="secondary" className="font-semibold">
                                        {data.line_items.length}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b">
                                    <span className="text-sm text-muted-foreground">Location</span>
                                    <span className="text-sm font-medium truncate max-w-[150px] text-right">
                                        {locations.find((l) => String(l.id) === data.location_id)?.name || (
                                            <span className="text-amber-600 italic">Not selected</span>
                                        )}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-3 border-b">
                                    <span className="text-sm text-muted-foreground">Type</span>
                                    <Badge variant="outline" className="capitalize">
                                        {data.type}
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center py-3">
                                    <span className="text-sm text-muted-foreground">Date</span>
                                    <span className="text-sm font-medium">
                                        {data.date || <span className="text-muted-foreground italic">Not set</span>}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </aside>
                </div>

                {/* Mobile Sticky Footer */}
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t shadow-lg sm:hidden z-50">
                    <Button
                        onClick={handleSubmit}
                        size="lg"
                        className="w-full h-12 text-base font-semibold shadow-lg"
                    >
                        <Save className="mr-2 h-5 w-5" />
                        {variation ? 'Update Variation' : 'Save Variation'}
                    </Button>
                </div>

                {/* Spacer for mobile sticky footer */}
                <div className="h-20 sm:hidden" />
            </div>
        </AppLayout>
    );
};

export default VariationCreate;
