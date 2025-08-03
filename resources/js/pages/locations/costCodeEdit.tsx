import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import AppLayout from '@/layouts/app-layout';
import { useForm } from '@inertiajs/react';

interface CostCode {
    id: number;
    code: string;
    description: string;
}

export default function CostCodeEdit({ location, costCodes }: { location: { id: number; name: string }; costCodes: CostCode[] }) {
    const { data, setData, post, processing, errors } = useForm({
        locationId: location.id,
        costCodes: costCodes.map((code) => ({ id: code.id, ratio: 0 })), // default ratio
    });

    const handleRatioChange = (id: number, value: string) => {
        const updatedCostCodes = data.costCodes.map((code) => (code.id === id ? { ...code, ratio: parseFloat(value) || 0 } : code));
        setData('costCodes', updatedCostCodes);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Submitting data:', data);
        post('/cost-codes/update'); // Change to your actual route
    };

    return (
        <AppLayout>
            <div className="p-2">
                <form onSubmit={handleSubmit}>
                    <Card>
                        <CardHeader>Edit Ratios for Cost Codes {location.name}</CardHeader>
                        <CardContent>
                            {data.costCodes.length > 0 &&
                                costCodes.map((code) => {
                                    const ratioEntry = data.costCodes.find((c) => c.id === code.id);
                                    return (
                                        <div key={code.id}>
                                            <div className="flex flex-row items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge>{code.code}</Badge>
                                                    <span>{code.description}</span>
                                                </div>

                                                <div className="relative inline-block">
                                                    <span className="absolute top-1/2 left-2 -translate-y-1/2 border-r pr-1 text-gray-500">%</span>
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        value={ratioEntry?.ratio ?? ''}
                                                        onChange={(e) => handleRatioChange(code.id, e.target.value)}
                                                        className="w-32 pl-8"
                                                    />
                                                </div>
                                            </div>
                                            <Separator className="my-2" />
                                        </div>
                                    );
                                })}

                            <CardAction className="flex justify-end">
                                <Button type="submit" disabled={processing}>
                                    {processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </CardAction>
                        </CardContent>
                    </Card>
                </form>
            </div>
        </AppLayout>
    );
}
