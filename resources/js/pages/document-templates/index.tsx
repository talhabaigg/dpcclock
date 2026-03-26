import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FileText, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

interface DocumentTemplate {
    id: number;
    name: string;
    category: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Document Templates', href: route('document-templates.index') }];

const CATEGORIES = ['employment', 'safety', 'subcontractor', 'general'];

export default function DocumentTemplatesIndex({ templates }: { templates: DocumentTemplate[] }) {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [deleteId, setDeleteId] = useState<number | null>(null);

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
            <div className="mx-auto max-w-6xl space-y-6 p-6">
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
                        {/* Filters + New button */}
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
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
                                    {CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>
                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button asChild>
                                <Link href={route('document-templates.create')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Template
                                </Link>
                            </Button>
                        </div>

                        {/* Template cards grid */}
                        {filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
                                <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">No templates match your filters.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {filtered.map((template) => (
                                    <Link
                                        key={template.id}
                                        href={route('document-templates.edit', template.id)}
                                        className="group relative flex flex-col rounded-lg border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-accent/50"
                                    >
                                        {/* Top row: icon + actions */}
                                        <div className="mb-3 flex items-start justify-between">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <FileText className="h-5 w-5 text-primary" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                                        onClick={(e) => e.preventDefault()}
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={route('document-templates.edit', template.id)}>
                                                            <Pencil className="mr-2 h-3.5 w-3.5" />
                                                            Edit
                                                        </Link>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setDeleteId(template.id);
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Name */}
                                        <h3 className="mb-1 font-medium leading-snug">{template.name}</h3>

                                        {/* Meta row */}
                                        <div className="mt-auto flex items-center gap-2 pt-3">
                                            {template.category && (
                                                <Badge variant="secondary" className="text-xs capitalize">
                                                    {template.category}
                                                </Badge>
                                            )}
                                            <Badge variant={template.is_active ? 'default' : 'outline'} className="text-xs">
                                                {template.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
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
