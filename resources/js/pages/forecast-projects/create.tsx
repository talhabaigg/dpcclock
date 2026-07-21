import { DatePickerDemo } from '@/components/date-picker';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Estimating', href: '/forecast-projects' },
    { title: 'Projects', href: '/forecast-projects' },
    { title: 'Create', href: '/forecast-projects/create' },
];

type FormData = {
    name: string;
    project_number: string;
    company: string;
    description: string;
    start_date: string;
    end_date: string;
    status: string;
};

export default function ForecastProjectCreate() {
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [submitting, setSubmitting] = useState(false);
    const [clientErrors, setClientErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [formData, setFormData] = useState<FormData>({
        name: '',
        project_number: '',
        company: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'potential',
    });

    const validate = (): boolean => {
        const next: Partial<Record<keyof FormData, string>> = {};
        if (!formData.company) next.company = 'Company is required';
        if (!/^[A-Za-z]{3}\d{2}$/.test(formData.project_number)) {
            next.project_number = 'Must be 5 characters: 3 letters followed by 2 digits (e.g. ABC01)';
        }
        setClientErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        router.post('/forecast-projects', formData, {
            onStart: () => setSubmitting(true),
            onFinish: () => setSubmitting(false),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Forecast Project" />

            <div className="mx-auto w-full max-w-2xl p-4">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className={errors.name ? 'border-red-500' : ''}
                            required
                        />
                        <InputError message={errors.name} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="project_number">Project # *</Label>
                        <Input
                            id="project_number"
                            value={formData.project_number}
                            onChange={(e) => setFormData({ ...formData, project_number: e.target.value.toUpperCase() })}
                            maxLength={5}
                            placeholder="e.g. ABC01"
                            className={errors.project_number || clientErrors.project_number ? 'border-red-500' : ''}
                            required
                        />
                        <p className="text-muted-foreground text-xs">3 letters followed by 2 digits (5 chars total)</p>
                        <InputError message={clientErrors.project_number || errors.project_number} />
                    </div>

                    <div className="grid gap-2">
                        <Label>Company *</Label>
                        <RadioGroup
                            value={formData.company}
                            onValueChange={(value) => setFormData({ ...formData, company: String(value) })}
                            className="flex gap-6"
                        >
                            {['SWCP', 'GRE'].map((company) => (
                                <Label key={company} className="flex cursor-pointer items-center gap-2 font-normal">
                                    <RadioGroupItem value={company} />
                                    {company}
                                </Label>
                            ))}
                        </RadioGroup>
                        <InputError message={clientErrors.company || errors.company} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="potential">Potential</SelectItem>
                                <SelectItem value="likely">Likely</SelectItem>
                                <SelectItem value="confirmed">Confirmed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Start Date</Label>
                        <DatePickerDemo
                            value={formData.start_date ? new Date(formData.start_date) : undefined}
                            onChange={(date) =>
                                setFormData({ ...formData, start_date: date ? date.toISOString().slice(0, 10) : '' })
                            }
                            placeholder="Pick start date"
                        />
                        <InputError message={errors.start_date} />
                    </div>

                    <div className="grid gap-2">
                        <Label>End Date</Label>
                        <DatePickerDemo
                            value={formData.end_date ? new Date(formData.end_date) : undefined}
                            onChange={(date) =>
                                setFormData({ ...formData, end_date: date ? date.toISOString().slice(0, 10) : '' })
                            }
                            placeholder="Pick end date"
                            fromDate={formData.start_date ? new Date(formData.start_date) : undefined}
                        />
                        <InputError message={errors.end_date} />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => router.visit('/forecast-projects')}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            Create
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
