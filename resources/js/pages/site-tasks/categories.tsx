import { CategoryCode, describeError } from '@/components/site-tasks/task-sections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { ChevronDown, ChevronRight, Globe, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Preset = {
    id: number;
    category_id: number | null;
    title: string;
    sort_order: number;
    is_active: boolean;
};

type Category = {
    id: number;
    name: string;
    code: string;
    color: string;
    sort_order: number;
    is_active: boolean;
    tasks_count: number;
    title_presets: Preset[];
};

interface PageProps {
    categories: Category[];
    globalPresets: Preset[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Site Task Categories', href: '/site-task-categories/manage' }];

/**
 * Admin page for the quick-task-creation vocabulary: categories (name, code,
 * pin colour) and the predefined task titles offered under each. Global
 * presets appear under every category.
 */
export default function SiteTaskCategoriesPage({ categories, globalPresets }: PageProps) {
    const [dialogCategory, setDialogCategory] = useState<Category | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const reload = () => router.reload({ only: ['categories', 'globalPresets'] });

    const deleteCategory = (category: Category) => {
        const warning =
            category.tasks_count > 0
                ? `Delete "${category.name}"? ${category.tasks_count} task${category.tasks_count === 1 ? '' : 's'} will keep existing but lose this category. Its title presets are removed too.`
                : `Delete "${category.name}"? Its title presets are removed too.`;
        if (!confirm(warning)) return;
        router.delete(`/site-task-categories/${category.id}`, { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Site Task Categories" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                <div className="mb-4 flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-sm">
                        Categories classify pins on plans; title presets are the predefined names offered when creating a task.
                    </p>
                    <Button
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                            setDialogCategory(null);
                            setDialogOpen(true);
                        }}
                    >
                        <Plus className="h-4 w-4 sm:mr-1.5" />
                        <span className="hidden sm:inline">New Category</span>
                    </Button>
                </div>

                <Card className="py-2 gap-2">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-8 pl-4" />
                                    <TableHead>Category</TableHead>
                                    <TableHead className="hidden sm:table-cell">Title presets</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[80px] pr-4 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.length === 0 && (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={5} className="py-10 text-center">
                                            <p className="text-muted-foreground text-sm">No categories yet — create one to get started.</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {categories.map((category) => {
                                    const expanded = expandedId === category.id;
                                    return (
                                        <CategoryRow
                                            key={category.id}
                                            category={category}
                                            expanded={expanded}
                                            onToggle={() => setExpandedId(expanded ? null : category.id)}
                                            onEdit={() => {
                                                setDialogCategory(category);
                                                setDialogOpen(true);
                                            }}
                                            onDelete={() => deleteCategory(category)}
                                            onChanged={reload}
                                        />
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Global presets — offered under every category */}
                <Card className="mt-4 py-2 gap-2">
                    <CardContent className="p-4">
                        <div className="mb-1 flex items-center gap-1.5">
                            <Globe className="text-muted-foreground h-3.5 w-3.5" />
                            <h3 className="text-sm font-medium">Global title presets</h3>
                        </div>
                        <p className="text-muted-foreground mb-3 text-xs">Offered under every category.</p>
                        <PresetsEditor categoryId={null} presets={globalPresets} onChanged={reload} />
                    </CardContent>
                </Card>
            </div>

            <CategoryDialog
                key={dialogCategory?.id ?? 'new'}
                category={dialogCategory}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                nextSortOrder={categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1}
            />
        </AppLayout>
    );
}

function CategoryRow({
    category,
    expanded,
    onToggle,
    onEdit,
    onDelete,
    onChanged,
}: {
    category: Category;
    expanded: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onChanged: () => void;
}) {
    return (
        <>
            <TableRow className="cursor-pointer" onClick={onToggle}>
                <TableCell className="pl-4">
                    {expanded ? <ChevronDown className="text-muted-foreground h-4 w-4" /> : <ChevronRight className="text-muted-foreground h-4 w-4" />}
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <CategoryCode category={category} className="h-6 w-6 text-[9px]" />
                        <div className="min-w-0">
                            <span className="font-medium">{category.name}</span>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                                {category.tasks_count} task{category.tasks_count !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                    <span className="text-muted-foreground text-xs">
                        {category.title_presets.length === 0
                            ? '—'
                            : category.title_presets
                                  .slice(0, 3)
                                  .map((p) => p.title)
                                  .join(', ') + (category.title_presets.length > 3 ? ` +${category.title_presets.length - 3}` : '')}
                    </span>
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className="font-normal shadow-none">
                        {category.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                </TableCell>
                <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Edit ${category.name}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-8 w-8 p-0"
                            aria-label={`Delete ${category.name}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {expanded && (
                <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="bg-muted/30 px-4 py-3 sm:px-12">
                        <PresetsEditor categoryId={category.id} presets={category.title_presets} onChanged={onChanged} />
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

/** Inline list editor for the title presets of one category (or global). */
function PresetsEditor({ categoryId, presets, onChanged }: { categoryId: number | null; presets: Preset[]; onChanged: () => void }) {
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);

    const add = async () => {
        const title = newTitle.trim();
        if (!title) return;
        setSaving(true);
        try {
            await api.post('/site-task-title-presets', { category_id: categoryId, title });
            setNewTitle('');
            onChanged();
        } catch (e) {
            toast.error(describeError(e));
        } finally {
            setSaving(false);
        }
    };

    const remove = async (preset: Preset) => {
        try {
            await api.delete(`/site-task-title-presets/${preset.id}`);
            onChanged();
        } catch (e) {
            toast.error(describeError(e));
        }
    };

    const toggleActive = async (preset: Preset) => {
        try {
            await api.patch(`/site-task-title-presets/${preset.id}`, { is_active: !preset.is_active });
            onChanged();
        } catch (e) {
            toast.error(describeError(e));
        }
    };

    return (
        <div className="space-y-1.5">
            {presets.length === 0 && <p className="text-muted-foreground text-xs italic">No title presets yet.</p>}
            {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={preset.is_active}
                        onCheckedChange={() => void toggleActive(preset)}
                        aria-label={`${preset.is_active ? 'Deactivate' : 'Activate'} ${preset.title}`}
                    />
                    <span className={preset.is_active ? undefined : 'text-muted-foreground line-through'}>{preset.title}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive h-6 w-6 p-0"
                        aria-label={`Delete preset ${preset.title}`}
                        onClick={() => void remove(preset)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            ))}
            <div className="flex max-w-sm items-center gap-2 pt-1">
                <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void add()}
                    placeholder="Add a title preset…"
                    className="h-8 text-sm"
                />
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={add} disabled={saving || !newTitle.trim()}>
                    {saving ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    Add
                </Button>
            </div>
        </div>
    );
}

function CategoryDialog({
    category,
    open,
    onOpenChange,
    nextSortOrder,
}: {
    category: Category | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    nextSortOrder: number;
}) {
    const [name, setName] = useState(category?.name ?? '');
    const [code, setCode] = useState(category?.code ?? '');
    const [color, setColor] = useState(category?.color ?? '#2563eb');
    const [sortOrder, setSortOrder] = useState(String(category?.sort_order ?? nextSortOrder));
    const [isActive, setIsActive] = useState(category?.is_active ?? true);
    const [saving, setSaving] = useState(false);

    const submit = () => {
        if (!name.trim() || !code.trim()) {
            toast.error('Name and code are required.');
            return;
        }
        setSaving(true);
        const payload = {
            name: name.trim(),
            code: code.trim().toUpperCase(),
            color,
            sort_order: Number(sortOrder) || 0,
            is_active: isActive,
        };
        const options = {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
            onError: (errors: Record<string, string>) => toast.error(Object.values(errors)[0] ?? 'Failed to save category.'),
            onFinish: () => setSaving(false),
        };
        if (category) {
            router.patch(`/site-task-categories/${category.id}`, payload, options);
        } else {
            router.post('/site-task-categories', payload, options);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-sm">{category ? `Edit ${category.name}` : 'New Category'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <Field>
                        <FieldLabel className="text-xs">Name</FieldLabel>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Builder Concerns" autoFocus />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                        <Field>
                            <FieldLabel className="text-xs">Code (pin label, max 4)</FieldLabel>
                            <Input value={code} onChange={(e) => setCode(e.target.value.slice(0, 4))} placeholder="BC" className="uppercase" />
                        </Field>
                        <Field>
                            <FieldLabel className="text-xs">Sort order</FieldLabel>
                            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                        </Field>
                    </div>
                    <Field>
                        <FieldLabel className="text-xs">Pin colour</FieldLabel>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2563eb'}
                                onChange={(e) => setColor(e.target.value)}
                                aria-label="Pick pin colour"
                                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                            />
                            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#2563eb" className="font-mono" />
                            <CategoryCode category={{ code: code || '?', color }} className="h-7 w-7 shrink-0 text-[10px]" />
                        </div>
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
                        Active — offered in pickers
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={submit} disabled={saving}>
                        {saving ? <Spinner className="h-3.5 w-3.5" /> : category ? 'Save' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
