import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchSelect } from '@/components/search-select';
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

type Level = 'mandatory' | 'preferred' | 'optional' | 'none';

interface ConditionRule {
    field: string;
    operator: string;
    value: string;
}

interface RuleGroup {
    match: 'all' | 'any';
    rules: ConditionRule[];
    result: Level;
}

interface Conditions {
    rule_groups: RuleGroup[];
}

// Server may send the legacy shape: { match, rules } — normalize on read.
interface LegacyConditions {
    match?: 'all' | 'any';
    rules?: ConditionRule[];
    rule_groups?: RuleGroup[];
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
    allow_multiple: boolean;
    options: string[] | null;
    conditions: LegacyConditions | null;
    is_active: boolean;
    sort_order: number;
}

interface PageProps {
    fileTypes: FileType[];
    worktypes: { id: number; name: string }[];
    locations: { id: number; name: string }[];
    employmentTypes: string[];
    employmentAgreements: string[];
}

const FIELD_OPTIONS = [
    { value: 'employment_type', label: 'Employment Type' },
    { value: 'employment_agreement', label: 'Employment Agreement' },
    { value: 'worktype', label: 'Work Type' },
    { value: 'location', label: 'Location' },
];

const LEVEL_LABELS: Record<Level, string> = {
    mandatory: 'Mandatory',
    preferred: 'Preferred',
    optional: 'Optional',
    none: 'Not Required',
};

const LEVEL_BADGE_VARIANT: Record<Level, 'default' | 'secondary' | 'outline' | 'destructive'> = {
    mandatory: 'destructive',
    preferred: 'default',
    optional: 'secondary',
    none: 'outline',
};

const EMPTY_FORM = {
    name: '',
    category: [] as string[],
    description: '',
    has_back_side: false,
    expiry_requirement: 'optional' as 'required' | 'optional' | 'none',
    requires_completed_date: false,
    allow_multiple: false,
    options: [] as string[],
    conditions: null as Conditions | null,
    is_active: true,
};

function normalizeConditions(input: LegacyConditions | null): Conditions | null {
    if (!input) return null;
    if (Array.isArray(input.rule_groups)) {
        return { rule_groups: input.rule_groups.map((g) => ({ match: g.match ?? 'all', rules: [...(g.rules ?? [])], result: (g.result ?? 'mandatory') as Level })) };
    }
    if (Array.isArray(input.rules)) {
        return { rule_groups: [{ match: input.match ?? 'all', rules: [...input.rules], result: 'mandatory' }] };
    }
    return null;
}

function fieldLabel(field: string): string {
    switch (field) {
        case 'employment_type':
            return 'Employment type';
        case 'employment_agreement':
            return 'Employment agreement';
        case 'worktype':
            return 'Work type';
        case 'location':
            return 'Location';
        default:
            return field;
    }
}

function ruleSummary(rule: ConditionRule, worktypes: { id: number; name: string }[], locations: { id: number; name: string }[]): string {
    const op = rule.operator === 'is' ? 'is' : 'is not';
    let valueLabel = rule.value;
    if (rule.field === 'worktype') valueLabel = worktypes.find((w) => String(w.id) === rule.value)?.name ?? rule.value;
    if (rule.field === 'location') valueLabel = locations.find((l) => String(l.id) === rule.value)?.name ?? rule.value;
    return `${fieldLabel(rule.field)} ${op} ${valueLabel || '…'}`;
}

function conditionSummary(
    conditions: LegacyConditions | null,
    worktypes: { id: number; name: string }[],
    locations: { id: number; name: string }[],
): { groups: { text: string; result: Level }[]; allEmployees: boolean } {
    const c = normalizeConditions(conditions);
    if (!c || c.rule_groups.length === 0) return { groups: [], allEmployees: true };

    const groups = c.rule_groups
        .filter((g) => g.rules.length > 0)
        .map((g) => {
            const parts = g.rules.map((r) => ruleSummary(r, worktypes, locations));
            const joiner = g.match === 'all' ? ' AND ' : ' OR ';
            return { text: parts.join(joiner), result: g.result };
        });

    return { groups, allEmployees: groups.length === 0 };
}

export default function EmployeeFileTypesIndex() {
    const { fileTypes, worktypes, locations, employmentTypes, employmentAgreements } = usePage<{ props: PageProps }>().props as unknown as PageProps;
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
            allow_multiple: ft.allow_multiple ?? false,
            options: ft.options ?? [],
            conditions: normalizeConditions(ft.conditions),
            is_active: ft.is_active,
        });
        setShowDialog(true);
    };

    const submit = () => {
        const groups = (form.conditions?.rule_groups ?? []).filter((g) => g.rules.length > 0);
        const conditions: Conditions | null = groups.length > 0 ? { rule_groups: groups } : null;
        const data = { ...form, conditions } as Record<string, unknown>;

        if (editingId) {
            router.put(`/employee-file-types/${editingId}`, data as never, { onSuccess: () => setShowDialog(false) });
        } else {
            router.post('/employee-file-types', data as never, { onSuccess: () => setShowDialog(false) });
        }
    };

    const deactivate = (id: number) => {
        router.delete(`/employee-file-types/${id}`);
    };

    // ----- Condition builder helpers -----
    const groups: RuleGroup[] = form.conditions?.rule_groups ?? [];

    const setGroups = (next: RuleGroup[]) =>
        setForm({ ...form, conditions: next.length > 0 ? { rule_groups: next } : null });

    const addGroup = () => setGroups([...groups, { match: 'all', rules: [{ field: 'employment_type', operator: 'is', value: '' }], result: 'mandatory' }]);
    const removeGroup = (gi: number) => setGroups(groups.filter((_, i) => i !== gi));

    const updateGroup = (gi: number, updates: Partial<RuleGroup>) => {
        setGroups(groups.map((g, i) => (i === gi ? { ...g, ...updates } : g)));
    };

    const addRule = (gi: number) => {
        const g = groups[gi];
        updateGroup(gi, { rules: [...g.rules, { field: 'employment_type', operator: 'is', value: '' }] });
    };

    const updateRule = (gi: number, ri: number, updates: Partial<ConditionRule>) => {
        const newRules = [...groups[gi].rules];
        newRules[ri] = { ...newRules[ri], ...updates };
        if (updates.field) newRules[ri].value = '';
        updateGroup(gi, { rules: newRules });
    };

    const removeRule = (gi: number, ri: number) => {
        updateGroup(gi, { rules: groups[gi].rules.filter((_, i) => i !== ri) });
    };

    const getValueOptions = (field: string) => {
        switch (field) {
            case 'employment_type':
                return (employmentTypes ?? []).map((t) => ({ value: t, label: t }));
            case 'employment_agreement':
                return (employmentAgreements ?? []).map((a) => ({ value: a, label: a }));
            case 'worktype':
                return (worktypes ?? []).map((w) => ({ value: String(w.id), label: w.name }));
            case 'location':
                return (locations ?? []).map((l) => ({ value: String(l.id), label: l.name }));
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
                                <TableHead>Multiple</TableHead>
                                <TableHead>Required For</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-24">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fileTypes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                                        No file types yet. Create one to get started.
                                    </TableCell>
                                </TableRow>
                            )}
                            {fileTypes.map((ft) => {
                                const summary = conditionSummary(ft.conditions, worktypes, locations);
                                return (
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
                                        <TableCell>{ft.allow_multiple ? 'Yes' : 'No'}</TableCell>
                                        <TableCell className="max-w-[320px] text-sm">
                                            {summary.allEmployees ? (
                                                <span className="text-muted-foreground">All employees — Mandatory</span>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    {summary.groups.map((g, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <Badge variant={LEVEL_BADGE_VARIANT[g.result]} className="text-[10px] capitalize">{LEVEL_LABELS[g.result]}</Badge>
                                                            <span className="text-muted-foreground text-xs">{g.text}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
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
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Create / Edit Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col gap-0 p-0 sm:w-auto sm:max-w-2xl">
                    <DialogHeader className="border-b p-4">
                        <DialogTitle>{editingId ? 'Edit File Type' : 'Create File Type'}</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 overflow-y-auto p-4">
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

                        <div className="flex items-center gap-3">
                            <Switch checked={form.allow_multiple} onCheckedChange={(v) => setForm({ ...form, allow_multiple: v })} />
                            <div>
                                <Label>Allow multiple files</Label>
                                <p className="text-muted-foreground text-xs">Allow uploading multiple files of this type per employee (e.g. catch-all document types)</p>
                            </div>
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
                        <div className="flex flex-col gap-3 rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label className="text-sm font-semibold">Conditions</Label>
                                    <p className="text-muted-foreground text-xs">First matching rule wins. No rules = mandatory for all.</p>
                                </div>
                                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={addGroup}>
                                    <Plus size={12} />
                                    Add Rule
                                </Button>
                            </div>

                            {groups.length === 0 && (
                                <p className="text-muted-foreground text-xs">No rules — mandatory for all employees.</p>
                            )}

                            {groups.map((group, gi) => (
                                <div key={gi} className="bg-muted/30 flex flex-col gap-2 rounded-md border p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rule {gi + 1}</span>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => removeGroup(gi)}>
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>

                                    {group.rules.length === 0 && (
                                        <p className="text-muted-foreground text-xs">Add at least one condition.</p>
                                    )}

                                    {group.rules.map((rule, ri) => (
                                        <div key={ri} className="flex flex-col gap-2">
                                            {ri > 0 && (
                                                <div className="flex justify-center">
                                                    <Badge
                                                        variant="outline"
                                                        className="cursor-pointer select-none px-3 text-[10px] font-semibold uppercase tracking-wider"
                                                        onClick={() => updateGroup(gi, { match: group.match === 'all' ? 'any' : 'all' })}
                                                    >
                                                        {group.match === 'all' ? 'AND' : 'OR'}
                                                    </Badge>
                                                </div>
                                            )}
                                            <div className="bg-background flex flex-col gap-2 rounded-md border p-2">
                                                <div className="flex items-end gap-2">
                                                    <div className="flex flex-1 flex-col gap-1">
                                                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Field</Label>
                                                        <SearchSelect
                                                            options={FIELD_OPTIONS}
                                                            optionName="field"
                                                            selectedOption={rule.field}
                                                            onValueChange={(v) => updateRule(gi, ri, { field: v })}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>

                                                    <div className="flex w-[100px] flex-col gap-1">
                                                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Operator</Label>
                                                        <Select value={rule.operator} onValueChange={(v) => updateRule(gi, ri, { operator: v })}>
                                                            <SelectTrigger className="h-8 w-full text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="is" className="text-xs">is</SelectItem>
                                                                <SelectItem value="is_not" className="text-xs">is not</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>

                                                    <Button variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0 text-red-500" onClick={() => removeRule(gi, ri)}>
                                                        <X size={14} />
                                                    </Button>
                                                </div>

                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Value</Label>
                                                    <SearchSelect
                                                        options={getValueOptions(rule.field)}
                                                        optionName="value"
                                                        selectedOption={rule.value}
                                                        onValueChange={(v) => updateRule(gi, ri, { value: v })}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <Button variant="outline" size="sm" className="mt-1 w-fit gap-1 text-xs" onClick={() => addRule(gi)}>
                                        <Plus size={12} />
                                        Add Condition
                                    </Button>

                                    <div className="mt-2 flex items-center gap-2 border-t pt-2">
                                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Then result is</Label>
                                        <Select value={group.result} onValueChange={(v: Level) => updateGroup(gi, { result: v })}>
                                            <SelectTrigger className="h-8 w-[160px] text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="mandatory" className="text-xs">Mandatory</SelectItem>
                                                <SelectItem value="preferred" className="text-xs">Preferred</SelectItem>
                                                <SelectItem value="optional" className="text-xs">Optional</SelectItem>
                                                <SelectItem value="none" className="text-xs">Not Required</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}

                            {groups.length > 0 && (
                                <p className="text-muted-foreground text-[11px] italic">If no rule matches, the file type is treated as Not Required.</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="m-0">
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
