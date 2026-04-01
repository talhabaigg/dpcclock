import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface FormTemplate {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    is_active: boolean;
    fields_count: number;
    created_at: string;
}

interface PageProps {
    templates: FormTemplate[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Form Templates', href: '/form-templates' }];

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function FormTemplatesIndex({ templates }: PageProps) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return templates;
        const q = search.toLowerCase();
        return templates.filter(
            (t) =>
                t.name.toLowerCase().includes(q) ||
                t.description?.toLowerCase().includes(q) ||
                t.category?.toLowerCase().includes(q),
        );
    }, [templates, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Form Templates" />

            <div className="mx-auto max-w-4xl p-4 lg:p-6">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Form Templates</h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            {templates.length} template{templates.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <Link href={route('form-templates.create')}>
                        <Button size="sm">
                            <Plus className="mr-1.5 h-4 w-4" />
                            New Template
                        </Button>
                    </Link>
                </div>

                {templates.length === 0 ? (
                    /* Empty state -- shown only when there are truly no templates */
                    <Card className="py-2 gap-2">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
                                <FileText className="text-muted-foreground h-7 w-7" />
                            </div>
                            <h3 className="text-base font-medium">No templates yet</h3>
                            <p className="text-muted-foreground mt-1 max-w-sm text-sm">
                                Form templates let you define reusable field structures. Create your first template to get started.
                            </p>
                            <Link href={route('form-templates.create')} className="mt-5">
                                <Button size="sm">
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Create Template
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Search */}
                        <div className="relative mb-4 max-w-xs">
                            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                            <Input
                                placeholder="Search templates..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-9 pl-8 text-sm"
                            />
                        </div>

                        {/* Table */}
                        <Card className="py-2 gap-2">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-4">Name</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-center">Fields</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Created</TableHead>
                                            <TableHead className="w-[80px] pr-4 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell colSpan={6} className="py-10 text-center">
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
                                                    onClick={() => router.visit(route('form-templates.edit', t.id))}
                                                >
                                                    <TableCell className="pl-4">
                                                        <div className="min-w-0">
                                                            <span className="font-medium">{t.name}</span>
                                                            {t.description && (
                                                                <p className="text-muted-foreground mt-0.5 max-w-xs truncate text-xs">
                                                                    {t.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {t.category ? (
                                                            <Badge variant="outline" className="font-normal">
                                                                {t.category}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">--</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="text-muted-foreground tabular-nums">
                                                            {t.fields_count}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {t.is_active ? (
                                                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20 shadow-none">
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="shadow-none">
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-muted-foreground text-xs">
                                                            {formatDate(t.created_at)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="pr-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Link
                                                                href={route('form-templates.edit', t.id)}
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
                                                                    if (confirm('Delete this form template?')) {
                                                                        router.delete(route('form-templates.destroy', t.id));
                                                                    }
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
