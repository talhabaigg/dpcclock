import LoadingDialog from '@/components/loading-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight, RefreshCcw, Search } from 'lucide-react';
import { useState } from 'react';

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

interface PayCategory {
    id: number;
    eh_id: number;
    external_id: string | null;
    name: string;
    pay_category_type: string | null;
    rate_unit: string | null;
    is_primary: boolean;
    default_super_rate: number;
}

interface PageProps {
    payRateTemplates: PayRateTemplate[];
    payCategories: PayCategory[];
    flash: { success?: string; error?: string };
    [key: string]: unknown;
}

export default function PayRateTemplatesIndex() {
    const { payRateTemplates, payCategories, flash } = usePage<PageProps>().props;
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedTemplates, setExpandedTemplates] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'templates' | 'categories'>('templates');

    const filteredTemplates = payRateTemplates.filter((template) => template.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const filteredCategories = payCategories.filter((category) => category.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const toggleExpand = (templateId: number) => {
        setExpandedTemplates((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(templateId)) {
                newSet.delete(templateId);
            } else {
                newSet.add(templateId);
            }
            return newSet;
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(value);
    };

    const formatPercent = (value: number) => {
        return `${(value * 100).toFixed(2)}%`;
    };

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
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
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
                    <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {flash.success}
                    </div>
                )}
                {flash.error && (
                    <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700 dark:bg-red-900/20 dark:text-red-400">{flash.error}</div>
                )}

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
                    <Card className="overflow-hidden p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>EH ID</TableHead>
                                    <TableHead>External ID</TableHead>
                                    <TableHead>Super Threshold</TableHead>
                                    <TableHead>Max Quarterly Super</TableHead>
                                    <TableHead>Pay Categories</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTemplates.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                                            No pay rate templates found. Click "Sync Templates" to fetch from Employment Hero.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTemplates.map((template) => (
                                        <>
                                            <TableRow
                                                key={template.id}
                                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                                onClick={() => toggleExpand(template.id)}
                                            >
                                                <TableCell>
                                                    {template.pay_categories.length > 0 &&
                                                        (expandedTemplates.has(template.id) ? (
                                                            <ChevronDown className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4" />
                                                        ))}
                                                </TableCell>
                                                <TableCell className="font-medium">{template.name}</TableCell>
                                                <TableCell>{template.eh_id}</TableCell>
                                                <TableCell>{template.external_id || '-'}</TableCell>
                                                <TableCell>{formatCurrency(template.super_threshold_amount)}</TableCell>
                                                <TableCell>{formatCurrency(template.maximum_quarterly_super_contributions_base)}</TableCell>
                                                <TableCell>
                                                    <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                                        {template.pay_categories.length}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                            {expandedTemplates.has(template.id) && template.pay_categories.length > 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="bg-gray-50 p-0 dark:bg-gray-800/50">
                                                        <div className="p-4">
                                                            <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                                Associated Pay Categories
                                                            </h4>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead>Category Name</TableHead>
                                                                        <TableHead>Category ID</TableHead>
                                                                        <TableHead>User Rate</TableHead>
                                                                        <TableHead>Calculated Rate</TableHead>
                                                                        <TableHead>Super Rate</TableHead>
                                                                        <TableHead>Weekly Hours</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {template.pay_categories.map((pc) => (
                                                                        <TableRow key={pc.id}>
                                                                            <TableCell>{pc.pay_category?.name || pc.pay_category_name || '-'}</TableCell>
                                                                            <TableCell>{pc.pay_category_id}</TableCell>
                                                                            <TableCell>{formatCurrency(pc.user_supplied_rate)}</TableCell>
                                                                            <TableCell>{formatCurrency(pc.calculated_rate)}</TableCell>
                                                                            <TableCell>{formatPercent(pc.super_rate)}</TableCell>
                                                                            <TableCell>{pc.standard_weekly_hours}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                )}

                {activeTab === 'categories' && (
                    <Card className="overflow-hidden p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>EH ID</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Rate Unit</TableHead>
                                    <TableHead>Primary</TableHead>
                                    <TableHead>Default Super Rate</TableHead>
                                    <TableHead>External ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCategories.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                                            No pay categories found. Click "Sync Categories" to fetch from Employment Hero.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCategories.map((category) => (
                                        <TableRow key={category.id}>
                                            <TableCell className="font-medium">{category.name}</TableCell>
                                            <TableCell>{category.eh_id}</TableCell>
                                            <TableCell>{category.pay_category_type || '-'}</TableCell>
                                            <TableCell>{category.rate_unit || '-'}</TableCell>
                                            <TableCell>
                                                {category.is_primary ? (
                                                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                        Yes
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>{formatPercent(category.default_super_rate)}</TableCell>
                                            <TableCell>{category.external_id || '-'}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
