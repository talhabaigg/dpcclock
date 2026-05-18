import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { EllipsisVertical, FileText, Plus, Search, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

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
    const importRef = useRef<HTMLInputElement>(null);

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        router.post(route('form-templates.import'), { file }, { forceFormData: true });
        e.target.value = '';
    };

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

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                <input
                    ref={importRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleImport}
                />
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
                            <div className="mt-5 flex items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
                                    <Upload className="mr-1.5 h-4 w-4" />
                                    Import JSON
                                </Button>
                                <Link href={route('form-templates.create')}>
                                    <Button size="sm">
                                        <Plus className="mr-1.5 h-4 w-4" />
                                        Create Template
                                    </Button>
                                </Link>
                            </div>
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
                            <div className="flex shrink-0 items-center gap-2">
                                <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
                                    <Upload className="h-4 w-4 sm:mr-1.5" />
                                    <span className="hidden sm:inline">Import</span>
                                </Button>
                                <Link href={route('form-templates.create')}>
                                    <Button size="sm">
                                        <Plus className="h-4 w-4 sm:mr-1.5" />
                                        <span className="hidden sm:inline">New Template</span>
                                    </Button>
                                </Link>
                            </div>
                        </div>

                        {/* Table */}
                        <Card className="py-2 gap-2">
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="pl-4">Name</TableHead>
                                            <TableHead className="hidden sm:table-cell">Category</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="hidden md:table-cell">Created</TableHead>
                                            <TableHead className="w-[80px] pr-4 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length === 0 ? (
                                            <TableRow className="hover:bg-transparent">
                                                <TableCell colSpan={5} className="py-10 text-center">
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
                                                                <p className="text-muted-foreground mt-0.5 max-w-[14rem] truncate text-xs sm:max-w-xs">
                                                                    {t.description}
                                                                </p>
                                                            )}
                                                            {/* Mobile-only: surface category inline since the column is hidden */}
                                                            {t.category && (
                                                                <span className="mt-1 inline-block text-[11px] text-muted-foreground sm:hidden">
                                                                    {t.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        {t.category ? (
                                                            <Badge variant="outline" className="font-normal">
                                                                {t.category}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs">--</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-normal shadow-none">
                                                            {t.is_active ? 'Active' : 'Inactive'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <span className="text-muted-foreground text-xs">
                                                            {formatDate(t.created_at)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="pr-4 text-right">
                                                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0"
                                                                        aria-label={`Row actions for ${t.name}`}
                                                                    >
                                                                        <EllipsisVertical className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="min-w-max">
                                                                    <DropdownMenuItem
                                                                        className="whitespace-nowrap"
                                                                        onClick={() => router.visit(route('form-templates.edit', t.id))}
                                                                    >
                                                                        Edit
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        className="whitespace-nowrap"
                                                                        onClick={() => {
                                                                            window.location.href = route('form-templates.export', t.id);
                                                                        }}
                                                                    >
                                                                        Download
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                        onClick={() => {
                                                                            if (confirm('Delete this form template?')) {
                                                                                router.delete(route('form-templates.destroy', t.id));
                                                                            }
                                                                        }}
                                                                    >
                                                                        Delete
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
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
