import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Copy, Download, FileText, LayoutGrid, LayoutList, MoreVertical, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

interface DocumentTemplate {
    id: number;
    name: string;
    category: string | null;
    is_active: boolean;
    visibility: string;
    created_at: string;
    updated_at: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Document Templates', href: route('document-templates.index') }];

const CATEGORIES: Record<string, string> = {
    employment_contract: 'Employment Contract',
    policies: 'Policies',
};

export default function DocumentTemplatesIndex({ templates }: { templates: DocumentTemplate[] }) {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('docTemplateViewMode') ?? 'list');
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const importRef = useRef<HTMLInputElement>(null);

    const handleViewModeChange = (value: string) => {
        setViewMode(value);
        localStorage.setItem('docTemplateViewMode', value);
    };

    const filtered = useMemo(() => {
        return templates.filter((t) => {
            const matchesSearch = !search || t.name.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [templates, search, categoryFilter]);

    const handleDelete = () => {
        if (deleteId) {
            router.delete(route('document-templates.destroy', deleteId));
            setDeleteId(null);
        }
    };

    const templateToDelete = templates.find((t) => t.id === deleteId);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Templates" />
            <div className="mx-auto max-w-5xl space-y-4 p-4 sm:space-y-6 sm:p-6 md:min-w-5xl">
                {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h2 className="mb-1 text-lg font-semibold">No templates yet</h2>
                        <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
                            Templates let you create reusable documents that can be sent out for signing.
                        </p>
                        <Button asChild>
                            <Link href={route('document-templates.create')}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create your first template
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Toolbar */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            {/* Left: search + category */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="relative flex-1 sm:w-56 sm:flex-none">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search templates..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="All categories" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All categories</SelectItem>
                                        {Object.entries(CATEGORIES).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Right: view toggle + new template */}
                            <div className="flex items-center gap-2 sm:gap-3">
                                <Tabs value={viewMode} onValueChange={handleViewModeChange}>
                                    <TabsList>
                                        <TabsTrigger value="list" className="gap-1.5">
                                            <LayoutList className="h-4 w-4" />
                                            <span className="hidden sm:inline">List</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="cards" className="gap-1.5">
                                            <LayoutGrid className="h-4 w-4" />
                                            <span className="hidden sm:inline">Cards</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                                <input
                                    ref={importRef}
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        router.post(route('document-templates.import'), { file }, { forceFormData: true });
                                        e.target.value = '';
                                    }}
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button>
                                            <Plus className="mr-2 h-4 w-4" />
                                            <span className="hidden sm:inline">New Template</span>
                                            <span className="sm:hidden">New</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                            <Link href={route('document-templates.create')}>
                                                <Plus className="mr-2 h-3.5 w-3.5" />
                                                Create Template
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => importRef.current?.click()}>
                                            <Upload className="mr-2 h-3.5 w-3.5" />
                                            Import JSON
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Template content */}
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                                <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No templates match your filters.</p>
                            </div>
                        ) : viewMode === 'list' ? (
                            /* ── List view (primary) ── */
                            <div className="rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead className="hidden sm:table-cell">Category</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="hidden lg:table-cell">Visibility</TableHead>
                                            <TableHead className="hidden md:table-cell">Updated</TableHead>
                                            <TableHead className="w-[50px]" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((template) => (
                                            <TableRow
                                                key={template.id}
                                                className="group cursor-pointer"
                                                onClick={() => router.visit(route('document-templates.edit', template.id))}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                                                            <FileText className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-medium">{template.name}</span>
                                                            {/* Show category inline on mobile */}
                                                            {template.category && (
                                                                <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                                                                    {CATEGORIES[template.category] ?? template.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    {template.category ? (
                                                        <Badge variant="secondary" className="text-xs">
                                                            {CATEGORIES[template.category] ?? template.category}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={template.is_active ? 'default' : 'outline'} className="text-xs">
                                                        {template.is_active ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">
                                                    <span className="text-sm capitalize">{template.visibility.replace('_', ' ')}</span>
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <span className="text-sm text-muted-foreground">
                                                        {new Date(template.updated_at).toLocaleDateString('en-AU')}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <TemplateActions template={template} onDelete={setDeleteId} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            /* ── Card view (secondary) ── */
                            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                                {filtered.map((template) => (
                                    <Link
                                        key={template.id}
                                        href={route('document-templates.edit', template.id)}
                                        className="group relative flex min-w-0 flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/50"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="line-clamp-2 min-w-0 flex-1 font-medium leading-snug">{template.name}</h3>
                                            <TemplateActions template={template} onDelete={setDeleteId} />
                                        </div>

                                        <div className="mt-auto flex items-center gap-2 pt-3">
                                            {template.category && (
                                                <span className="text-xs text-muted-foreground">
                                                    {CATEGORIES[template.category] ?? template.category}
                                                </span>
                                            )}
                                            {template.visibility !== 'all' && (
                                                <>
                                                    {template.category && <span className="text-xs text-muted-foreground/40">·</span>}
                                                    <span className="text-xs capitalize text-muted-foreground">
                                                        {template.visibility.replace('_', ' ')}
                                                    </span>
                                                </>
                                            )}
                                            <span className="ml-auto text-xs text-muted-foreground">
                                                {new Date(template.updated_at).toLocaleDateString('en-AU')}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Delete confirmation dialog */}
            <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete template?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{templateToDelete?.name}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

// ── Shared actions dropdown ──────────────────────────────────────────
function TemplateActions({ template, onDelete }: { template: DocumentTemplate; onDelete: (id: number) => void }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem asChild>
                    <Link href={route('document-templates.edit', template.id)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => window.open(route('document-templates.preview-pdf', template.id), '_blank')}
                >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => window.open(route('document-templates.export', template.id), '_blank')}
                >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => router.post(route('document-templates.duplicate', template.id))}
                >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(template.id)}
                >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
