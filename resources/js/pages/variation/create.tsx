import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { useEffect, useState, useRef } from 'react';
import { Plus, Trash2, Zap, Wrench, Package } from 'lucide-react';
import { CostCode } from '../purchasing/types';
import VariationLineGrid, { VariationLineGridRef } from './partials/variationLineTable/VariationLineGrid';
import VariationHeaderGrid, { VariationHeaderGridRef } from './partials/variationHeader/VariationHeaderGrid';

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
    const gridRef = useRef<VariationLineGridRef>(null);
    const headerGridRef = useRef<VariationHeaderGridRef>(null);
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

    const [selectedCount, setSelectedCount] = useState(0);

    const addRow = () => {
        if (gridRef.current) {
            gridRef.current.addRow();
        }
    };

    const deleteSelectedRows = () => {
        if (gridRef.current) {
            gridRef.current.deleteSelectedRows();
            setSelectedCount(0);
        }
    };

    const handleLineItemsChange = (lineItems: any[]) => {
        setData('line_items', lineItems);
    };

    const handleSelectionChange = (count: number) => {
        setSelectedCount(count);
    };

    const handleHeaderDataChange = (headerData: any) => {
        setData('location_id', headerData.location_id);
        setData('type', headerData.type);
        setData('co_number', headerData.co_number);
        setData('date', headerData.date);
        setData('description', headerData.description);
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
    const [quickGenOpen, setQuickGenOpen] = useState(false);
    const [genAmount, setGenAmount] = useState('');
    const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];
    const waste_ratio = costData.find((code) => code.pivot?.waste_ratio)?.pivot.waste_ratio || 0;

    useEffect(() => {
        // Update cost data when location changes
    }, [data.location_id, costData]);

    void waste_ratio;

    const generatePrelimLabour = () => {
        if (!genAmount || !data.location_id) {
            alert('Please select a location and enter an amount.');
            return;
        }
        setOpen(true);
        setQuickGenOpen(false);
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
    };

    const generatePrelimMaterial = () => {
        if (!genAmount || !data.location_id) {
            alert('Please select a location and enter an amount.');
            return;
        }
        setOpen(true);
        setQuickGenOpen(false);
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
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="w-full px-4 py-2 sm:px-6 sm:py-4 lg:px-8 overflow-x-hidden">
                <LoadingDialog open={open} setOpen={setOpen} />

                {/* Error Alert */}
                {Object.keys(errors).length > 0 && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>There were some errors with your submission:</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4">
                                {Object.entries(errors).map(([field, message]) => (
                                    <li key={field}>{message as string}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Header Grid */}
                <div className="space-y-3 mb-6">
                    <h3 className="text-lg font-semibold">Variation Details</h3>
                    <Card className="p-0 overflow-hidden shadow-sm border">
                        <VariationHeaderGrid
                            ref={headerGridRef}
                            headerData={{
                                location_id: data.location_id,
                                type: data.type,
                                co_number: data.co_number,
                                date: data.date,
                                description: data.description,
                            }}
                            locations={locations}
                            onDataChange={handleHeaderDataChange}
                        />
                    </Card>
                </div>

                {/* Line Items Grid */}
                <div className="space-y-3 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold">Line Items</h3>
                            <span className="text-sm text-muted-foreground">
                                {selectedCount > 0
                                    ? `${selectedCount} selected`
                                    : `${data.line_items.length} total`}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Dialog open={quickGenOpen} onOpenChange={setQuickGenOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Zap className="h-3 w-3" />

                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg">
                                    <DialogHeader className="space-y-3">
                                        <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                                            <Zap className="h-6 w-6 text-primary-foreground" />
                                        </div>
                                        <DialogTitle className="text-center text-xl">
                                            Quick Generate
                                        </DialogTitle>
                                        <DialogDescription className="text-center">
                                            Automatically populate line items based on your base amount
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-6 py-6">
                                        {/* Amount Input Section */}
                                        <div className="space-y-3">
                                            <label htmlFor="amount" className="text-sm font-semibold flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                                                Enter Base Amount
                                            </label>
                                            <Input
                                                id="amount"
                                                type="number"
                                                value={genAmount}
                                                onChange={(e) => setGenAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="h-12 text-lg font-medium text-center border-2 focus-visible:border-primary"
                                            />
                                        </div>

                                        {/* Divider */}
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-muted"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-background px-2 text-muted-foreground font-medium">Choose Type</span>
                                            </div>
                                        </div>

                                        {/* Generation Options */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-semibold flex items-center gap-2">
                                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                                                Select Generation Type
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={generatePrelimLabour}
                                                    className="group relative overflow-hidden rounded-lg border-2 border-muted hover:border-primary transition-all duration-200 p-4 text-left bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/20 dark:to-background"
                                                >
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <Wrench className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm">Labour</div>
                                                            <div className="text-xs text-muted-foreground">Generate labour costs</div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                                </button>

                                                <button
                                                    onClick={generatePrelimMaterial}
                                                    className="group relative overflow-hidden rounded-lg border-2 border-muted hover:border-primary transition-all duration-200 p-4 text-left bg-gradient-to-br from-purple-50/50 to-background dark:from-purple-950/20 dark:to-background"
                                                >
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <Package className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm">Material</div>
                                                            <div className="text-xs text-muted-foreground">Generate material costs</div>
                                                        </div>
                                                    </div>
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button onClick={addRow} size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                            </Button>
                            <Button
                                onClick={deleteSelectedRows}
                                size="sm"
                                variant="outline"
                                disabled={selectedCount === 0}
                                className="text-destructive hover:text-destructive"
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete {selectedCount > 0 && `(${selectedCount})`}
                            </Button>
                        </div>
                    </div>

                    <Card className="p-0 overflow-hidden shadow-sm border">
                        <VariationLineGrid
                            ref={gridRef}
                            lineItems={data.line_items}
                            costCodes={costData}
                            costTypes={CostTypes}
                            onDataChange={handleLineItemsChange}
                            onSelectionChange={handleSelectionChange}
                        />
                    </Card>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                    <Button variant="outline" onClick={() => window.history.back()} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} size="lg" className="w-full sm:w-auto">
                        {variation?.id ? 'Update Variation' : 'Create Variation'}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default VariationCreate;
