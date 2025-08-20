import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
        job_id: '',
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

    const [genType, setGenType] = useState('');
    const [genAmount, setGenAmount] = useState('');
    const generateOnCosts = () => {
        if (!genType || !genAmount) {
            alert('Please select a type and enter an amount.');
            return;
        }
        if (genType === 'Direct Labour') {
            // Define cost items and percentage multipliers
            const onCostData = [
                { cost_item: '01-01', cost_type: 'LAB', percent: 0.1, description: 'Wages & Apprentices: Base Rate' },
                { cost_item: '02-01', cost_type: 'LOC', percent: 0.05, description: 'Wages & Apprentices Oncosts: Super' },
                { cost_item: '02-05', cost_type: 'LOC', percent: 0.03, description: 'Wages & Apprentices Oncosts: Bert' },
                { cost_item: '02-10', cost_type: 'LOC', percent: 0.02, description: 'Wages & Apprentices Oncosts: Bewt' },
                { cost_item: '02-15', cost_type: 'LOC', percent: 0.04, description: 'Wages & Apprentices Oncosts: Cipq' },
                { cost_item: '02-20', cost_type: 'LOC', percent: 0.01, description: 'Wages & Apprentices Oncosts: Payrolltax' },
                { cost_item: '02-25', cost_type: 'LOC', percent: 0.01, description: 'Wages & Apprentices Oncosts: Workcover' },
            ];

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
            setGenType('');
            setGenAmount('');
        }
    };

    useEffect(() => {
        console.log('Data updated:', data);
    }, [data]);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="m-2 flex flex-col items-center justify-between gap-2">
                <div className="mx-auto max-w-96 min-w-full sm:max-w-full">
                    <div className="mx-2 flex max-w-96 flex-1 flex-col gap-4 sm:max-w-full sm:flex-row">
                        <Select value={data.job_id} onValueChange={(value) => setData('job_id', value)}>
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select job" />
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
                    </div>
                    <div className="m-2 flex max-w-96 flex-col space-x-2 sm:max-w-full sm:flex-row sm:space-y-2">
                        <Input type="number" value={genAmount} onChange={(e) => setGenAmount(e.target.value)} placeholder="Enter Amount" />
                        <Select value={genType} onValueChange={(value) => setGenType(value)}>
                            <SelectTrigger className="w-full text-xs">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                                {['Direct Labour', 'Foreman', 'Leading Hand', 'Labourer', 'Site Admin'].map((type) => (
                                    <SelectItem key={type} value={type}>
                                        <div className="flex flex-row text-xs">
                                            <Badge className="mr-2 text-[10px]">{type}</Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button onClick={generateOnCosts}>Generate On Costs</Button>
                    </div>
                    <VariationLineTable data={data} costCodes={costCodes} CostTypes={CostTypes} setData={setData} />
                </div>

                <div className="mx-auto flex w-full max-w-96 min-w-full flex-col justify-between sm:max-w-full sm:flex-row">
                    <div className="flex flex-col space-y-1 space-x-2 sm:flex-row">
                        <Button onClick={addRow} className="mx-auto w-full max-w-96 sm:w-auto">
                            Add Row
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => deleteRow(data.line_items.length - 1)}
                            className="mx-auto w-full max-w-96 sm:w-auto"
                        >
                            Delete Row
                        </Button>
                    </div>
                    <Button className="mx-auto w-full max-w-96 sm:w-auto" onClick={handleSubmit}>
                        Save
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default VariationCreate;
