import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { useForm } from '@inertiajs/react';
import { CostCode } from '../purchasing/types';
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
                qty: '',
                unit_cost: '',
                total_cost: '',
                revenue: '',
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
                qty: '',
                unit_cost: '',
                total_cost: '',
                revenue: '',
            },
        ]);
    };

    const deleteRow = (index: number) => {
        setData(
            'line_items',
            data.line_items.filter((_, i) => i !== index),
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="m-2 flex flex-col items-center justify-between gap-2">
                <div className="mx-auto max-w-96 min-w-full sm:max-w-full">
                    <div className="mx-auto flex max-w-96 flex-1 flex-col gap-4 sm:max-w-full sm:flex-row">
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
                    <Table className="m-2 min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableCell className="border-r">Line #</TableCell>
                                <TableCell>Cost Item</TableCell>
                                <TableCell>Cost Type</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Qty</TableCell>
                                <TableCell>Unit Cost</TableCell>
                                <TableCell>Total Cost</TableCell>
                                <TableCell>Revenue</TableCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.line_items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="border-r">
                                        <Input className="border-0 shadow-none" value={item.line_number} readOnly />
                                    </TableCell>
                                    <TableCell className="border-r">
                                        <Select>
                                            <SelectTrigger className="w-full border-0 shadow-none">
                                                <SelectValue placeholder="Select cost item" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {costCodes.map((code) => (
                                                    <SelectItem key={code.id} value={code.description}>
                                                        <div className="flex flex-col">
                                                            <Badge className="mr-2">{code.code}</Badge>
                                                            {code.description}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="border-r">
                                        <Select>
                                            <SelectTrigger className="w-full border-0 shadow-none">
                                                <SelectValue placeholder="Select cost type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CostTypes.map((code) => (
                                                    <SelectItem key={code.id} value={code.description}>
                                                        <div className="flex flex-col">
                                                            <Badge className="mr-2">{code.value}</Badge>
                                                            {code.description}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell className="border-r">
                                        <Input
                                            className="border-0 shadow-none hover:border-none"
                                            value={item.description}
                                            onChange={(e) => {
                                                const newItems = [...data.line_items];
                                                newItems[index].description = e.target.value;
                                                setData('line_items', newItems);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="border-r">
                                        <Input
                                            className="border-0 shadow-none"
                                            value={item.qty}
                                            onChange={(e) => {
                                                const newItems = [...data.line_items];
                                                newItems[index].qty = e.target.value;
                                                setData('line_items', newItems);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="border-r">
                                        <Input
                                            className="border-0 shadow-none"
                                            value={item.unit_cost}
                                            onChange={(e) => {
                                                const newItems = [...data.line_items];
                                                newItems[index].unit_cost = e.target.value;
                                                setData('line_items', newItems);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell className="border-r">
                                        <Input
                                            className="border-0 shadow-none"
                                            value={item.total_cost}
                                            onChange={(e) => {
                                                const newItems = [...data.line_items];
                                                newItems[index].total_cost = e.target.value;
                                                setData('line_items', newItems);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            className="border-0 shadow-none"
                                            value={item.revenue}
                                            onChange={(e) => {
                                                const newItems = [...data.line_items];
                                                newItems[index].revenue = e.target.value;
                                                setData('line_items', newItems);
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
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
                    <Button className="mx-auto w-full max-w-96 sm:w-auto">Save</Button>
                </div>
            </div>
        </AppLayout>
    );
};

export default VariationCreate;
