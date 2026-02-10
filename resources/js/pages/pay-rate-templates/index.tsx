import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { RefreshCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type FlattenedPayRate, type PayCategoryRow, categoryColumns, templateColumns } from './columns';
import { DataTable } from './data-table';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Pay Rate Templates',
        href: '/pay-rate-templates',
    },
];

interface PayRateTemplatePayCategory {
    id: number;
    pay_category_id: number;
    pay_category_name: string | null;
    user_supplied_rate: number;
    calculated_rate: number;
    super_rate: number;
    standard_weekly_hours: number;
    pay_category: {
        id: number;
        eh_id: number;
        name: string;
    } | null;
}

interface PayRateTemplate {
    id: number;
    eh_id: number;
    external_id: string | null;
    name: string;
    primary_pay_category_id: number | null;
    super_threshold_amount: number;
    maximum_quarterly_super_contributions_base: number;
    source: string | null;
    pay_categories: PayRateTemplatePayCategory[];
}

interface PageProps {
    payRateTemplates: PayRateTemplate[];
    payCategories: PayCategoryRow[];
    flash: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function PayRateTemplatesIndex() {
    const { payRateTemplates, payCategories, flash } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'templates' | 'categories'>('templates');

    const flattenedData = useMemo<FlattenedPayRate[]>(() => {
        return payRateTemplates.flatMap((template) => {
            if (template.pay_categories.length === 0) {
                return [
                    {
                        templateId: template.id,
                        templateName: template.name,
                        templateEhId: template.eh_id,
                        templateExternalId: template.external_id,
                        superThreshold: template.super_threshold_amount,
                        maxQuarterlySuper: template.maximum_quarterly_super_contributions_base,
                        categoryName: 'No categories assigned',
                        categoryId: 0,
                        userRate: 0,
                        calculatedRate: 0,
                        superRate: 0,
                        weeklyHours: 0,
                    },
                ];
            }
            return template.pay_categories.map((pc) => ({
                templateId: template.id,
                templateName: template.name,
                templateEhId: template.eh_id,
                templateExternalId: template.external_id,
                superThreshold: template.super_threshold_amount,
                maxQuarterlySuper: template.maximum_quarterly_super_contributions_base,
                categoryName: pc.pay_category?.name || pc.pay_category_name || '-',
                categoryId: pc.pay_category_id,
                userRate: pc.user_supplied_rate,
                calculatedRate: pc.calculated_rate,
                superRate: pc.super_rate,
                weeklyHours: pc.standard_weekly_hours,
            }));
        });
    }, [payRateTemplates]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pay Rate Templates" />

            <div className="p-4">
                {/* Header with sync buttons */}
                <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={route('pay-rate-templates.sync-categories')}>
                            <Button variant="outline" onClick={() => setOpen(true)}>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Sync Categories
                            </Button>
                        </Link>
                        <Link href={route('pay-rate-templates.sync-templates')}>
                            <Button variant="outline" onClick={() => setOpen(true)}>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Sync Templates
                            </Button>
                        </Link>
                        <Link href={route('pay-rate-templates.sync-all')}>
                            <Button onClick={() => setOpen(true)}>
                                <RefreshCcw className="mr-2 h-4 w-4" />
                                Sync All
                            </Button>
                        </Link>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Flash messages */}
                {flash.success && (
                    <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">{flash.success}</div>
                )}
                {flash.error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-900/20 dark:text-red-400">{flash.error}</div>}

                {/* Tab buttons */}
                <div className="mb-4 flex gap-2">
                    <Button variant={activeTab === 'templates' ? 'default' : 'outline'} onClick={() => setActiveTab('templates')}>
                        Pay Rate Templates ({payRateTemplates.length})
                    </Button>
                    <Button variant={activeTab === 'categories' ? 'default' : 'outline'} onClick={() => setActiveTab('categories')}>
                        Pay Categories ({payCategories.length})
                    </Button>
                </div>

                <LoadingDialog open={open} setOpen={setOpen} />

                {activeTab === 'templates' && (
                    <DataTable
                        columns={templateColumns}
                        data={flattenedData}
                        grouping={['templateName']}
                        globalFilter={searchQuery}
                        emptyMessage='No pay rate templates found. Click "Sync Templates" to fetch from Employment Hero.'
                    />
                )}

                {activeTab === 'categories' && (
                    <DataTable
                        columns={categoryColumns}
                        data={payCategories}
                        globalFilter={searchQuery}
                        emptyMessage='No pay categories found. Click "Sync Categories" to fetch from Employment Hero.'
                    />
                )}
            </div>
        </AppLayout>
    );
}
