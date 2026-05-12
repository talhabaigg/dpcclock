import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CheckSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Template {
    id: number;
    name: string;
    model_type: string | null;
    auto_attach: boolean;
    is_active: boolean;
    items_count: number;
}

interface PageProps {
    templates: Template[];
}

const MODEL_LABELS: Record<string, string> = {
    'App\\Models\\EmploymentApplication': 'Employment Enquiry',
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Checklist Templates', href: '/checklist-templates' }];

function appliesToLabel(modelType: string | null): string {
    if (!modelType) return 'Any model';
    return MODEL_LABELS[modelType] ?? modelType;
}

export default function ChecklistTemplatesIndex({ templates }: PageProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return templates;
        const q = search.toLowerCase();
        return templates.filter(
            (t) => t.name.toLowerCase().includes(q) || appliesToLabel(t.model_type).toLowerCase().includes(q),
        );
    }, [templates, search]);

    function handleDelete(id: number) {
        if (!confirm('Delete this template? Existing checklists created from it will not be affected.')) return;
        router.delete(route('checklist-templates.destroy', id));
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Checklist Templates" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                {templates.length === 0 ? (
                    /* Empty state */
                    <Card className="py-2 gap-2">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
                                <CheckSquare className="text-muted-foreground h-7 w-7" />
                            </div>
                            <h3 className="text-base font-medium">No templates yet</h3>
                            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                                Checklist templates let you define reusable steps. Create your first template to get started.
                            </p>
                            <Link href="/checklist-templates/create" className="mt-5">
                                <Button size="sm">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Create Template
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Search + new-template, justified between */}
                        <div className="mb-4 flex items-center justify-between gap-2">
                            <div className="relative max-w-xs flex-1">
                                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                                <Input
                                    placeholder="Search templates..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="h-9 pl-8 text-sm"
                                />
                            </div>
                            <Link href="/checklist-templates/create" className="shrink-0">
                                <Button size="sm">
                                    <Plus className="h-4 w-4 sm:mr-1.5" />
                                    <span className="hidden sm:inline">New Template</span>
                                </Button>
                            </Link>
                        </div>

                        {/* Table */}
                        <Card className="py-2 gap-2">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-4">Name</TableHead>
                                            <TableHead className="hidden sm:table-cell">Applies to</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="w-[80px] pr-4 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell colSpan={4} className="py-10 text-center">
                                                    <p className="text-muted-foreground text-sm">
                                                        No templates match "{search}"
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filtered.map((t) => (
                                                <TableRow
                                                    key={t.id}
                                                    className="cursor-pointer"
                                                    onClick={() => router.visit(`/checklist-templates/${t.id}/edit`)}
                                                >
                                                    <TableCell className="pl-4">
                                                        <div className="min-w-0">
                                                            <span className="font-medium">{t.name}</span>
                                                            <p className="text-muted-foreground mt-0.5 text-xs">
                                                                {t.items_count} item{t.items_count !== 1 ? 's' : ''}
                                                                {t.auto_attach && <span> · Auto-attach</span>}
                                                            </p>
                                                            {/* Mobile-only: surface "Applies to" inline since the column is hidden */}
                                                            <span className="mt-1 inline-block text-[11px] text-muted-foreground sm:hidden">
                                                                {appliesToLabel(t.model_type)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <span className="text-muted-foreground text-xs">
                                                            {appliesToLabel(t.model_type)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-normal shadow-none">
                                                            {t.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pr-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Link
                                                                href={`/checklist-templates/${t.id}/edit`}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0"
                                                                    aria-label={`Edit ${t.name}`}
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                                                aria-label={`Delete ${t.name}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(t.id);
                                                                }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Footer count when filtering */}
                        {search.trim() && filtered.length > 0 && (
                            <p className="text-muted-foreground mt-2 text-xs">
                                Showing {filtered.length} of {templates.length} template{templates.length !== 1 ? 's' : ''}
                            </p>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
