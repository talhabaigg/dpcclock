import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employee File Types', href: '/employee-file-types' }];

interface ConditionRule {
    field: string;
    operator: string;
    value: string;
}

interface Conditions {
    match: 'all' | 'any';
    rules: ConditionRule[];
}

interface FileType {
    id: number;
    name: string;
    category: string[] | null;
    slug: string;
    description: string | null;
    has_back_side: boolean;
    expiry_requirement: 'required' | 'optional' | 'none';
    requires_completed_date: boolean;
    options: string[] | null;
    conditions: Conditions | null;
    is_active: boolean;
    sort_order: number;
}

interface PageProps {
    fileTypes: FileType[];
    worktypes: { id: number; name: string }[];
    locations: { id: number; name: string }[];
    employmentTypes: string[];
}

const EMPTY_FORM = {
    name: '',
    category: [] as string[],
    description: '',
    has_back_side: false,
    expiry_requirement: 'optional' as 'required' | 'optional' | 'none',
    requires_completed_date: false,
    options: [] as string[],
    conditions: null as Conditions | null,
    is_active: true,
};

function conditionSummary(conditions: Conditions | null, worktypes: { id: number; name: string }[], locations: { id: number; name: string }[]): string {
    if (!conditions || !conditions.rules || conditions.rules.length === 0) return 'All employees';

    const parts = conditions.rules.map((r) => {
        const op = r.operator === 'is' ? 'is' : 'is not';
        let fieldLabel = r.field;
        let valueLabel = r.value;

        if (r.field === 'employment_type') {
            fieldLabel = 'Employment type';
        } else if (r.field === 'worktype') {
            fieldLabel = 'Work type';
            valueLabel = worktypes.find((w) => String(w.id) === r.value)?.name ?? r.value;
        } else if (r.field === 'location') {
            fieldLabel = 'Location';
            valueLabel = locations.find((l) => String(l.id) === r.value)?.name ?? r.value;
        }

        return `${fieldLabel} ${op} ${valueLabel}`;
    });

    const joiner = conditions.match === 'all' ? ' AND ' : ' OR ';
    return parts.join(joiner);
}

export default function EmployeeFileTypesIndex() {
    const { fileTypes, worktypes, locations, employmentTypes } = usePage<{ props: PageProps }>().props as unknown as PageProps;
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;

    const [showDialog, setShowDialog] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowDialog(true);
    };

    const openEdit = (ft: FileType) => {
        setEditingId(ft.id);
        setForm({
            name: ft.name,
            category: ft.category ?? [],
            description: ft.description ?? '',
            has_back_side: ft.has_back_side,
            expiry_requirement: ft.expiry_requirement ?? 'optional',
            requires_completed_date: ft.requires_completed_date ?? false,
            options: ft.options ?? [],
            conditions: ft.conditions ? { ...ft.conditions, rules: [...ft.conditions.rules] } : null,
            is_active: ft.is_active,
        });
        setShowDialog(true);
    };

    const submit = () => {
        const conditions = form.conditions && form.conditions.rules.length > 0 ? form.conditions : null;
        const data = {
            ...form,
            conditions,
        } as Record<string, unknown>;

        if (editingId) {
            router.put(`/employee-file-types/${editingId}`, data as never, { onSuccess: () => setShowDialog(false) });
        } else {
            router.post('/employee-file-types', data as never, { onSuccess: () => setShowDialog(false) });
        }
    };

    const deactivate = (id: number) => {
        router.delete(`/employee-file-types/${id}`);
    };

    // Condition builder helpers
    const conditions = form.conditions ?? { match: 'all' as const, rules: [] };

    const setConditions = (c: Conditions) => setForm({ ...form, conditions: c });

    const addRule = () => {
        setConditions({ ...conditions, rules: [...conditions.rules, { field: 'employment_type', operator: 'is', value: '' }] });
    };

    const updateRule = (index: number, updates: Partial<ConditionRule>) => {
        const newRules = [...conditions.rules];
        newRules[index] = { ...newRules[index], ...updates };
        // Reset value when field changes
        if (updates.field) newRules[index].value = '';
        setConditions({ ...conditions, rules: newRules });
    };

    const removeRule = (index: number) => {
        setConditions({ ...conditions, rules: conditions.rules.filter((_, i) => i !== index) });
    };

    const getValueOptions = (field: string) => {
        switch (field) {
            case 'employment_type':
                return employmentTypes.map((t) => ({ value: t, label: t }));
            case 'worktype':
                return worktypes.map((w) => ({ value: String(w.id), label: w.name }));
            case 'location':
                return locations.map((l) => ({ value: String(l.id), label: l.name }));
            default:
                return [];
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employee File Types" />

            <div className="flex flex-col gap-4 p-4">
                {flash?.success && (
                    <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/20 dark:text-green-300">
                        {flash.success}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Employee File Types</h2>
                    <Button size="sm" onClick={openCreate} className="gap-1.5">
                        <Plus size={14} />
                        Add File Type
                    </Button>
                </div>

                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Document Name</TableHead>
                                <TableHead>Categories</TableHead>
                                <TableHead>Expiry</TableHead>
                                <TableHead>Completed Date</TableHead>
                                <TableHead>Two-Sided</TableHead>
                                <TableHead>Required For</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fileTypes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                                        No file types yet. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                            {fileTypes.map((ft) => (
                                <TableRow key={ft.id} className={!ft.is_active ? 'opacity-50' : ''}>
                                    <TableCell className="font-medium">{ft.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(ft.category ?? []).map((cat) => (
                                                <Badge key={cat} variant="outline" className="text-[10px]">{cat}</Badge>
                                            ))}
                                            {(!ft.category || ft.category.length === 0) && <span className="text-muted-foreground text-sm">—</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm capitalize">{ft.expiry_requirement ?? 'optional'}</TableCell>
                                    <TableCell className="text-muted-foreground text-sm">{ft.requires_completed_date ? 'Yes' : 'No'}</TableCell>
                                    <TableCell>{ft.has_back_side ? 'Yes' : 'No'}</TableCell>
                                    <TableCell className="max-w-[300px] text-sm">{conditionSummary(ft.conditions, worktypes, locations)}</TableCell>
                                    <TableCell>
                                        <Badge variant={ft.is_active ? 'default' : 'secondary'}>{ft.is_active ? 'Active' : 'Inactive'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(ft)}>
                                                <Pencil size={14} />
                                            </Button>
                                            {ft.is_active && (
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => deactivate(ft.id)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Create / Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Edit File Type' : 'Create File Type'}</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Document Name</Label>
                            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. White Card" />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Categories</Label>
                            <Input
                                placeholder="Type a category and press Enter"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val && !form.category.includes(val)) {
                                            setForm({ ...form, category: [...form.category, val] });
                                        }
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            {form.category.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {form.category.map((cat) => (
                                        <Badge key={cat} variant="secondary" className="gap-1">
                                            {cat}
                                            <button
                                                type="button"
                                                className="hover:text-foreground ml-0.5"
                                                onClick={() => setForm({ ...form, category: form.category.filter((c) => c !== cat) })}
                                            >
                                                <X size={10} />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Description</Label>
                            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={2} />
                        </div>

                        <div className="flex items-center gap-3">
                            <Switch checked={form.has_back_side} onCheckedChange={(v) => setForm({ ...form, has_back_side: v })} />
                            <Label>Has back side (two-sided document)</Label>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Expiry Date</Label>
                            <Select value={form.expiry_requirement} onValueChange={(v: 'required' | 'optional' | 'none') => setForm({ ...form, expiry_requirement: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="required">Required</SelectItem>
                                    <SelectItem value="optional">Optional</SelectItem>
                                    <SelectItem value="none">Not applicable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-3">
                            <Switch checked={form.requires_completed_date} onCheckedChange={(v) => setForm({ ...form, requires_completed_date: v })} />
                            <Label>Requires completed date</Label>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Options</Label>
                            <p className="text-muted-foreground text-xs">Selectable options for this file type (e.g. Scissor Lift, Forklift). Leave empty if not applicable.</p>
                            <Input
                                placeholder="Type an option and press Enter"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const val = e.currentTarget.value.trim();
                                        if (val && !form.options.includes(val)) {
                                            setForm({ ...form, options: [...form.options, val] });
                                        }
                                        e.currentTarget.value = '';
                                    }
                                }}
                            />
                            {form.options.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                    {form.options.map((opt) => (
                                        <Badge key={opt} variant="secondary" className="gap-1">
                                            {opt}
                                            <button
                                                type="button"
                                                className="hover:text-foreground ml-0.5"
                                                onClick={() => setForm({ ...form, options: form.options.filter((o) => o !== opt) })}
                                            >
                                                <X size={10} />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                            <Label>Active</Label>
                        </div>

                        {/* Condition Builder */}
                        <div className="flex flex-col gap-2 rounded-lg border p-3">
                            <Label className="text-sm font-semibold">Conditions</Label>

                            {conditions.rules.length === 0 && (
                                <p className="text-muted-foreground text-xs">No conditions — required for all employees.</p>
                            )}

                            {conditions.rules.map((rule, idx) => (
                                <div key={idx} className="flex flex-col gap-2">
                                    {idx > 0 && (
                                        <div className="flex justify-center">
                                            <Badge
                                                variant="outline"
                                                className="cursor-pointer select-none px-3 text-[10px] font-semibold uppercase tracking-wider"
                                                onClick={() => setConditions({ ...conditions, match: conditions.match === 'all' ? 'any' : 'all' })}
                                            >
                                                {conditions.match === 'all' ? 'AND' : 'OR'}
                                            </Badge>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Select value={rule.field} onValueChange={(v) => updateRule(idx, { field: v })}>
                                            <SelectTrigger className="h-8 w-[140px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="employment_type">Employment Type</SelectItem>
                                                <SelectItem value="worktype">Work Type</SelectItem>
                                                <SelectItem value="location">Location</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select value={rule.operator} onValueChange={(v) => updateRule(idx, { operator: v })}>
                                            <SelectTrigger className="h-8 w-[80px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="is">is</SelectItem>
                                                <SelectItem value="is_not">is not</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select value={rule.value} onValueChange={(v) => updateRule(idx, { value: v })}>
                                            <SelectTrigger className="h-8 flex-1 text-xs">
                                                <SelectValue placeholder="Select..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getValueOptions(rule.field).map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Button variant="ghost" size="sm" className="h-7 w-7 shrink-0 p-0" onClick={() => removeRule(idx)}>
                                            <X size={14} />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <Button variant="outline" size="sm" className="mt-1 w-fit gap-1 text-xs" onClick={addRule}>
                                <Plus size={12} />
                                Add Condition
                            </Button>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={submit} disabled={!form.name.trim()}>
                            {editingId ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
