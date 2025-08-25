import LoadingDialog from '@/components/loading-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { useEffect, useState } from 'react';
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

const VariationCreate = ({ locations, costCodes }: { locations: Location[]; costCodes: CostCode[] }) => {
    const { data, setData, post, processing, errors } = useForm({
        location_id: '',
        type: 'dayworks',
        co_number: '',
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0], // Default to today's date
        line_items: [
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
    console.log(locations);

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
        setData(
            'line_items',
            data.line_items.filter((_, i) => i !== index),
        );
    };

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        post('/variations/store', {
            onSuccess: () => {
                // Optionally redirect or show a success message
            },
            onError: (errors) => {
                console.error('Submission errors:', errors);
            },
        });
    };
    const [open, setOpen] = useState(false);
    const [genAmount, setGenAmount] = useState('');
    const generateOnCosts = () => {
        if (!genAmount || !data.location_id) {
            alert('Please select a type and enter an amount.');
            return;
        }
        setOpen(true);
        setTimeout(() => {
            setOpen(false);
        }, 3000);
        // Define cost items and percentage multipliers
        const costData = locations.find((location) => String(location.id) === data.location_id)?.cost_codes || [];

        const onCostData = costData.map((code) => ({
            cost_item: code.code,
            cost_type: 'MAT',
            percent: code.pivot.variation_ratio / 100 || 0,
            description: code.description,
        }));

        console.log('On Cost Data:', onCostData);
        // const onCostData = [
        //     { cost_item: '01-01', cost_type: 'LAB', percent: 0.1, description: 'Wages & Apprentices: Base Rate' },
        //     { cost_item: '02-01', cost_type: 'LOC', percent: 0.05, description: 'Wages & Apprentices Oncosts: Super' },
        //     { cost_item: '02-05', cost_type: 'LOC', percent: 0.03, description: 'Wages & Apprentices Oncosts: Bert' },
        //     { cost_item: '02-10', cost_type: 'LOC', percent: 0.02, description: 'Wages & Apprentices Oncosts: Bewt' },
        //     { cost_item: '02-15', cost_type: 'LOC', percent: 0.04, description: 'Wages & Apprentices Oncosts: Cipq' },
        //     { cost_item: '02-20', cost_type: 'LOC', percent: 0.01, description: 'Wages & Apprentices Oncosts: Payrolltax' },
        //     { cost_item: '02-25', cost_type: 'LOC', percent: 0.01, description: 'Wages & Apprentices Oncosts: Workcover' },
        // ];

        const baseAmount = parseFloat(genAmount);

        const newLines = onCostData.map((item, index) => {
            const lineAmount = +(baseAmount * item.percent).toFixed(2); // 2 decimal rounding
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

    useEffect(() => {
        console.log('Data updated:', data);
    }, [data]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="m-2 flex flex-col items-center justify-between gap-2">
                <LoadingDialog open={open} setOpen={setOpen} />
                {Object.keys(errors).length > 0 && (
                    <Alert variant="destructive" className="mx-2 max-w-96 sm:max-w-1/2">
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
                <div className="mx-auto max-w-96 min-w-full sm:max-w-full">
                    <div className="mx-2 flex max-w-96 flex-1 flex-col gap-4 sm:max-w-full sm:flex-row">
                        <Card className="mx-auto flex w-full max-w-96 min-w-96 flex-col p-2 sm:max-w-full sm:flex-row">
                            <Select value={data.location_id} onValueChange={(value) => setData('location_id', value)}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.map((location) => (
                                        <SelectItem key={location.id} value={String(location.id)}>
                                            {location.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={data.type} onValueChange={(value) => setData('type', value)}>
                                <SelectTrigger className="flex-1">
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
                            <Input
                                value={data.co_number}
                                onChange={(e) => setData('co_number', e.target.value)}
                                className="flex-1"
                                placeholder="Enter CO Number"
                            />
                            <Input
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                className="flex-1"
                                placeholder="Enter Description"
                            />
                            <input type="date" value={data.date} onChange={(e) => setData('date', e.target.value)} className="flex-1" />
                            <Input
                                type="number"
                                value={genAmount}
                                onChange={(e) => setGenAmount(e.target.value)}
                                placeholder="Enter Amount"
                                className="max-w-48"
                            />
                            {/* <Select value={genType} onValueChange={(value) => setGenType(value)}>
                            <SelectTrigger className="w-full text-xs">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {['Wages', 'foreman', 'Leading Hand', 'Labourer', 'Site Admin'].map((type) => (
                                    <SelectItem key={type} value={type}>
                                        <div className="flex flex-row text-xs">
                                            <Badge className="mr-2 text-[10px]">{type}</Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select> */}
                            <Button onClick={generateOnCosts}>Generate Labour</Button>
                        </Card>
                    </div>
                    <div className="m-2 flex max-w-96 flex-col space-x-2 sm:max-w-full sm:flex-row sm:space-y-2"></div>
                    <Card className="mx-2 max-w-96 p-0 sm:max-w-full">
                        <VariationLineTable data={data} costCodes={costCodes} CostTypes={CostTypes} setData={setData} />
                    </Card>
                </div>
                <div className="flex w-full max-w-96 flex-row sm:max-w-full">
                    <div className="space-x-2">
                        <Button onClick={addRow} className="">
                            Add Row
                        </Button>
                        <Button variant="secondary" onClick={() => deleteRow(data.line_items.length - 1)} className="">
                            Delete Row
                        </Button>
                    </div>
                    <Button className="ml-auto" onClick={handleSubmit}>
                        Save
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default VariationCreate;
