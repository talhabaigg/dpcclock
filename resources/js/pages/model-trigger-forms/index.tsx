import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { EllipsisVertical, Plus, Workflow } from 'lucide-react';
import { useState } from 'react';

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

interface ModelType {
    value: string;
    label: string;
}

interface FormTemplateOption {
    id: number;
    name: string;
    model_type: string | null;
    is_sendable: boolean;
}

interface Mapping {
    id: number;
    model_type: string;
    trigger_key: string;
    form_template_id: number;
    form_template: { id: number; name: string; model_type: string | null; is_sendable: boolean };
    subject_source: string | null;
    dispatch_mode: 'auto' | 'on_demand';
    min_submissions: number;
    assignee_strategy: 'permission' | 'user';
    assignee_value: string;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
}

interface PageProps {
    mappings: Mapping[];
    modelTypes: ModelType[];
    triggerKeysByModel: Record<string, string[]>;
    subjectSourcesByModel: Record<string, Record<string, string>>;
    formTemplates: FormTemplateOption[];
    permissions: { id: number; name: string }[];
    users: { id: number; name: string }[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Form Templates', href: '/form-templates' },
    { title: 'Trigger Form Mappings', href: '/trigger-form-mappings' },
];

const TRIGGER_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    whs_review: 'WHS Review',
    final_review: 'Final Review',
    approved: 'Approved',
    created: 'Created',
};

function triggerLabel(key: string): string {
    return TRIGGER_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface FormState {
    id: number | null;
    model_type: string;
    trigger_key: string;
    form_template_id: number | '';
    subject_source: string;
    dispatch_mode: 'auto' | 'on_demand';
    min_submissions: number;
    assignee_strategy: 'permission' | 'user';
    assignee_value: string;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
}

function emptyForm(modelTypes: ModelType[], triggerKeysByModel: Record<string, string[]>): FormState {
    const firstModel = modelTypes[0]?.value ?? '';
    const firstTrigger = triggerKeysByModel[firstModel]?.[0] ?? '';
    return {
        id: null,
        model_type: firstModel,
        trigger_key: firstTrigger,
        form_template_id: '',
        subject_source: '',
        dispatch_mode: 'auto',
        min_submissions: 1,
        assignee_strategy: 'permission',
        assignee_value: '',
        is_required: true,
        sort_order: 0,
        is_active: true,
    };
}

export default function ModelTriggerFormsIndex({
    mappings,
    modelTypes,
    triggerKeysByModel,
    subjectSourcesByModel,
    formTemplates,
    permissions,
    users,
}: PageProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState<FormState>(() => emptyForm(modelTypes, triggerKeysByModel));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    function openCreate() {
        setForm(emptyForm(modelTypes, triggerKeysByModel));
        setErrors({});
        setDialogOpen(true);
    }

    function openEdit(m: Mapping) {
        setForm({
            id: m.id,
            model_type: m.model_type,
            trigger_key: m.trigger_key,
            form_template_id: m.form_template_id,
            subject_source: m.subject_source ?? '',
            dispatch_mode: m.dispatch_mode,
            min_submissions: m.min_submissions,
            assignee_strategy: m.assignee_strategy,
            assignee_value: m.assignee_value,
            is_required: m.is_required,
            sort_order: m.sort_order,
            is_active: m.is_active,
        });
        setErrors({});
        setDialogOpen(true);
    }

    function handleSave() {
        if (!form.form_template_id) {
            setErrors({ form_template_id: 'Pick a form template.' });
            return;
        }
        if (!form.assignee_value.trim()) {
            setErrors({ assignee_value: 'Pick an assignee.' });
            return;
        }

        setSaving(true);
        setErrors({});

        const payload = {
            model_type: form.model_type,
            trigger_key: form.trigger_key,
            form_template_id: form.form_template_id,
            subject_source: form.subject_source || null,
            dispatch_mode: form.dispatch_mode,
            min_submissions: form.min_submissions,
            assignee_strategy: form.assignee_strategy,
            assignee_value: form.assignee_value,
            is_required: form.is_required,
            sort_order: form.sort_order,
            is_active: form.is_active,
        };

        const opts = {
            onSuccess: () => setDialogOpen(false),
            onError: (errs: Record<string, string>) => setErrors(errs),
            onFinish: () => setSaving(false),
        };

        if (form.id) {
            router.put(route('model-trigger-forms.update', form.id), payload, opts);
        } else {
            router.post(route('model-trigger-forms.store'), payload, opts);
        }
    }

    function handleDelete(m: Mapping) {
        if (!confirm(`Delete the "${m.form_template.name}" mapping for ${triggerLabel(m.trigger_key)}?`)) return;
        router.delete(route('model-trigger-forms.destroy', m.id));
    }

    function modelLabel(value: string): string {
        return modelTypes.find((mt) => mt.value === value)?.label ?? value;
    }

    function renderAssignee(m: Mapping) {
        if (m.assignee_strategy === 'permission') {
            const perm = permissions.find((p) => p.name === m.assignee_value);
            return (
                <span className="text-muted-foreground">
                    Permission: {perm ? perm.name : `${m.assignee_value} (not found)`}
                </span>
            );
        }
        const user = users.find((u) => String(u.id) === String(m.assignee_value));
        const label = user ? user.name : `User #${m.assignee_value} (not found)`;
        return (
            <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-muted text-primary text-[10px] font-medium">
                        {getInitials(label)}
                    </AvatarFallback>
                </Avatar>
                <span className={user ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
            </div>
        );
    }

    const triggersForCurrentModel = triggerKeysByModel[form.model_type] ?? [];
    const subjectSourceOptions = subjectSourcesByModel[form.model_type] ?? {};
    const subjectSourceKeys = Object.keys(subjectSourceOptions);
    const modelHasSubjectSources = subjectSourceKeys.length > 0;

    // Filter form templates to those matching the selected model (or model-agnostic)
    const eligibleTemplates = formTemplates.filter(
        (t) => !t.model_type || t.model_type === form.model_type,
    );

    function subjectSourceLabel(key: string | null): string | null {
        if (!key) return null;
        // Look across all models so the listing table can label rows whose
        // model isn't currently selected in the form.
        for (const sources of Object.values(subjectSourcesByModel)) {
            if (sources[key]) return sources[key];
        }
        return key;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Trigger Form Mappings" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                <div className="mb-6 flex items-center justify-end">
                    <Button size="sm" onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        New mapping
                    </Button>
                </div>

                {mappings.length === 0 ? (
                    <Card className="py-2 gap-2">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                                <Workflow className="h-7 w-7 text-muted-foreground" />
                            </div>
                            <h3 className="text-base font-medium">No trigger mappings configured</h3>
                            <p className="mt-1 max-w-md text-sm text-muted-foreground">
                                Connect a model trigger to a form template and an assignee so the form is created automatically when the trigger fires.
                            </p>
                            <Button size="sm" className="mt-5" onClick={openCreate}>
                                <Plus className="mr-1.5 h-4 w-4" />
                                Create first mapping
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="py-2 gap-2">
                        <CardContent className="p-0">
                            <Table className="text-xs">
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-4">Model</TableHead>
                                        <TableHead>Trigger</TableHead>
                                        <TableHead>Form Template</TableHead>
                                        <TableHead>Behavior</TableHead>
                                        <TableHead>Assignee</TableHead>
                                        <TableHead className="text-center">Required</TableHead>
                                        <TableHead className="text-center">Active</TableHead>
                                        <TableHead className="w-12 pr-4 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mappings.map((m) => (
                                        <TableRow key={m.id}>
                                            <TableCell className="pl-4 text-muted-foreground">{modelLabel(m.model_type)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal">
                                                    {triggerLabel(m.trigger_key)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {m.form_template.name}
                                                {!m.form_template.is_sendable && (
                                                    <Badge variant="secondary" className="ml-2 shadow-none">
                                                        In-app only
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5 text-muted-foreground">
                                                    <span>
                                                        {m.subject_source
                                                            ? subjectSourceLabel(m.subject_source)
                                                            : 'Single form'}
                                                    </span>
                                                    <span className="text-[10px] uppercase tracking-wide ">
                                                        {m.dispatch_mode === 'auto' ? 'Auto' : 'On demand'}
                                                        {m.subject_source && m.min_submissions > 1 && (
                                                            <> · min {m.min_submissions}</>
                                                        )}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className='truncate max-w-[100px]'>{renderAssignee(m)}</TableCell>
                                            <TableCell className="text-center">
                                                {m.is_required ? (
                                                    <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-700 shadow-none hover:bg-amber-500/10">
                                                        Required
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">Optional</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {m.is_active ? (
                                                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-none hover:bg-emerald-500/10">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="shadow-none">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="pr-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label="Row actions"
                                                        >
                                                            <EllipsisVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-max">
                                                        <DropdownMenuItem
                                                            className="whitespace-nowrap"
                                                            onClick={() => openEdit(m)}
                                                        >
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="whitespace-nowrap text-destructive focus:text-destructive"
                                                            onClick={() => handleDelete(m)}
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{form.id ? 'Edit trigger form mapping' : 'New trigger form mapping'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-2">
                        <div>
                            <Label className="mb-1 text-xs text-muted-foreground">Model type</Label>
                            <Select
                                value={form.model_type}
                                onValueChange={(v) => {
                                    const firstTrigger = triggerKeysByModel[v]?.[0] ?? '';
                                    setForm({
                                        ...form,
                                        model_type: v,
                                        trigger_key: firstTrigger,
                                        form_template_id: '',
                                        subject_source: '',
                                        dispatch_mode: 'auto',
                                        min_submissions: 1,
                                    });
                                }}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {modelTypes.map((mt) => (
                                        <SelectItem key={mt.value} value={mt.value}>
                                            {mt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="mb-1 text-xs text-muted-foreground">Trigger</Label>
                            <Select value={form.trigger_key} onValueChange={(v) => setForm({ ...form, trigger_key: v })}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {triggersForCurrentModel.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {triggerLabel(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label className="mb-1 text-xs text-muted-foreground">Form template</Label>
                            <Select
                                value={form.form_template_id ? String(form.form_template_id) : ''}
                                onValueChange={(v) => setForm({ ...form, form_template_id: Number(v) })}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Pick a template" />
                                </SelectTrigger>
                                <SelectContent>
                                    {eligibleTemplates.map((ft) => (
                                        <SelectItem key={ft.id} value={String(ft.id)}>
                                            {ft.name}
                                            {!ft.is_sendable && ' · in-app only'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.form_template_id && <p className="mt-1 text-xs text-red-500">{errors.form_template_id}</p>}
                        </div>

                        {modelHasSubjectSources && (
                            <div>
                                <Label className="mb-1 text-xs text-muted-foreground">Subject (fan out over)</Label>
                                <Select
                                    value={form.subject_source || '__none__'}
                                    onValueChange={(v) => {
                                        const next = v === '__none__' ? '' : v;
                                        setForm({
                                            ...form,
                                            subject_source: next,
                                            // Reset min_submissions when fan-out is turned off — it's
                                            // only meaningful when multiple forms can exist per mapping.
                                            min_submissions: next ? form.min_submissions : 1,
                                        });
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__none__">None (single form)</SelectItem>
                                        {subjectSourceKeys.map((key) => (
                                            <SelectItem key={key} value={key}>
                                                {subjectSourceOptions[key]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.subject_source && <p className="mt-1 text-xs text-red-500">{errors.subject_source}</p>}
                            </div>
                        )}

                        <div className={form.subject_source ? 'grid grid-cols-2 gap-3' : ''}>
                            <div>
                                <Label className="mb-1 text-xs text-muted-foreground">Dispatch mode</Label>
                                <Select
                                    value={form.dispatch_mode}
                                    onValueChange={(v: 'auto' | 'on_demand') => setForm({ ...form, dispatch_mode: v })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto (fire when trigger hits)</SelectItem>
                                        <SelectItem value="on_demand">On demand (start manually)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.subject_source && (
                                <div>
                                    <Label className="mb-1 text-xs text-muted-foreground">Min submissions required</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={form.min_submissions}
                                        onChange={(e) =>
                                            setForm({ ...form, min_submissions: Math.max(1, Number(e.target.value) || 1) })
                                        }
                                        className="h-9 text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="mb-1 text-xs text-muted-foreground">Assignee type</Label>
                                <Select
                                    value={form.assignee_strategy}
                                    onValueChange={(v: 'permission' | 'user') =>
                                        setForm({ ...form, assignee_strategy: v, assignee_value: '' })
                                    }
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="permission">By permission</SelectItem>
                                        <SelectItem value="user">Specific user</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="mb-1 text-xs text-muted-foreground">
                                    {form.assignee_strategy === 'permission' ? 'Permission' : 'User'}
                                </Label>
                                <Select
                                    value={form.assignee_value}
                                    onValueChange={(v) => setForm({ ...form, assignee_value: v })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder={form.assignee_strategy === 'permission' ? 'Pick a permission' : 'Pick a user'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {form.assignee_strategy === 'permission'
                                            ? permissions.map((p) => (
                                                  <SelectItem key={p.id} value={p.name}>
                                                      {p.name}
                                                  </SelectItem>
                                              ))
                                            : users.map((u) => (
                                                  <SelectItem key={u.id} value={String(u.id)}>
                                                      {u.name}
                                                  </SelectItem>
                                              ))}
                                    </SelectContent>
                                </Select>
                                {errors.assignee_value && <p className="mt-1 text-xs text-red-500">{errors.assignee_value}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="mb-1 text-xs text-muted-foreground">Sort order</Label>
                                <Input
                                    type="number"
                                    value={form.sort_order}
                                    onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                                    className="h-9 text-sm"
                                />
                            </div>
                            <div className="flex flex-col justify-end gap-3 pt-1">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="is_required"
                                        checked={form.is_required}
                                        onCheckedChange={(v) => setForm({ ...form, is_required: !!v })}
                                    />
                                    <Label htmlFor="is_required" className="text-xs">
                                        Required (gates forward transition)
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="is_active"
                                        checked={form.is_active}
                                        onCheckedChange={(v) => setForm({ ...form, is_active: !!v })}
                                    />
                                    <Label htmlFor="is_active" className="text-xs">
                                        Active
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : form.id ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
