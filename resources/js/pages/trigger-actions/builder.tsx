import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowLeft, Bell, FileText, Users, Zap } from 'lucide-react';
import { useState } from 'react';
import { triggerLabel, type ActionType, type NotificationChannel, type TriggerAction } from './types';

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

interface PageProps {
    action?: TriggerAction;
    modelTypes: ModelType[];
    triggerKeysByModel: Record<string, string[]>;
    subjectSourcesByModel: Record<string, Record<string, string>>;
    placeholdersByModel: Record<string, Record<string, string>>;
    formTemplates: FormTemplateOption[];
    permissions: { id: number; name: string }[];
    users: { id: number; name: string }[];
}

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string; hint: string }[] = [
    { value: 'database', label: 'In-app', hint: 'Shows in the notification bell' },
    { value: 'mail', label: 'Email', hint: 'Sends a mail to each recipient' },
    { value: 'webpush', label: 'Browser push', hint: 'Only recipients with push enabled' },
];

interface FormState {
    model_type: string;
    trigger_key: string;
    action_type: ActionType;
    form_template_id: number | '';
    subject_source: string;
    dispatch_mode: 'auto' | 'on_demand';
    min_submissions: number;
    assignee_strategy: 'permission' | 'user';
    assignee_value: string;
    notification_channels: NotificationChannel[];
    notification_title: string;
    notification_body: string;
    notification_url: string;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
}

function initialForm(props: PageProps): FormState {
    const a = props.action;
    const firstModel = props.modelTypes[0]?.value ?? '';
    return {
        model_type: a?.model_type ?? firstModel,
        trigger_key: a?.trigger_key ?? props.triggerKeysByModel[firstModel]?.[0] ?? '',
        action_type: a?.action_type ?? 'assign_form',
        form_template_id: a?.form_template_id ?? '',
        subject_source: a?.subject_source ?? '',
        dispatch_mode: a?.dispatch_mode ?? 'auto',
        min_submissions: a?.min_submissions ?? 1,
        assignee_strategy: a?.assignee_strategy ?? 'permission',
        assignee_value: a?.assignee_value ?? '',
        notification_channels: a?.notification_channels ?? ['database'],
        notification_title: a?.notification_title ?? '',
        notification_body: a?.notification_body ?? '',
        notification_url: a?.notification_url ?? '',
        is_required: a?.is_required ?? true,
        sort_order: a?.sort_order ?? 0,
        is_active: a?.is_active ?? true,
    };
}

/** Numbered step card in the vertical flow, Power Automate style. */
function StepCard({
    icon: Icon,
    iconClass,
    title,
    summary,
    children,
}: {
    icon: typeof Zap;
    iconClass: string;
    title: string;
    summary: string;
    children: React.ReactNode;
}) {
    return (
        <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 border-b px-4 py-3 [.border-b]:pb-3">
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconClass)}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-muted-foreground truncate text-xs">{summary}</p>
                </div>
            </CardHeader>
            <CardContent className="grid gap-4 px-4 py-4">{children}</CardContent>
        </Card>
    );
}

function Connector() {
    return (
        <div className="flex flex-col items-center py-1" aria-hidden>
            <div className="bg-border h-3 w-px" />
            <div className="border-border bg-background text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full border">
                <ArrowDown className="h-3.5 w-3.5" />
            </div>
            <div className="bg-border h-3 w-px" />
        </div>
    );
}

function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return <p className="mt-1 text-xs text-red-500">{message}</p>;
}

export default function TriggerActionBuilder(props: PageProps) {
    const { modelTypes, triggerKeysByModel, subjectSourcesByModel, placeholdersByModel, formTemplates, permissions, users } = props;
    const isEdit = !!props.action;

    const [form, setForm] = useState<FormState>(() => initialForm(props));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Trigger Actions', href: '/trigger-actions' },
        { title: isEdit ? 'Edit action' : 'New action', href: '#' },
    ];

    const triggersForModel = triggerKeysByModel[form.model_type] ?? [];
    const subjectSourceOptions = subjectSourcesByModel[form.model_type] ?? {};
    const subjectSourceKeys = Object.keys(subjectSourceOptions);
    const placeholders = placeholdersByModel[form.model_type] ?? {};
    const eligibleTemplates = formTemplates.filter((t) => !t.model_type || t.model_type === form.model_type);
    const modelLabel = modelTypes.find((mt) => mt.value === form.model_type)?.label ?? form.model_type;

    const isNotification = form.action_type === 'send_notification';

    function toggleChannel(channel: NotificationChannel, checked: boolean) {
        setForm((f) => ({
            ...f,
            notification_channels: checked
                ? [...f.notification_channels, channel]
                : f.notification_channels.filter((c) => c !== channel),
        }));
    }

    function handleSave() {
        setSaving(true);
        setErrors({});

        const payload = {
            model_type: form.model_type,
            trigger_key: form.trigger_key,
            action_type: form.action_type,
            form_template_id: isNotification ? null : form.form_template_id || null,
            subject_source: isNotification ? null : form.subject_source || null,
            dispatch_mode: form.dispatch_mode,
            min_submissions: form.min_submissions,
            assignee_strategy: form.assignee_strategy,
            assignee_value: form.assignee_value,
            notification_channels: isNotification ? form.notification_channels : null,
            notification_title: isNotification ? form.notification_title : null,
            notification_body: isNotification ? form.notification_body : null,
            notification_url: isNotification ? form.notification_url || null : null,
            is_required: isNotification ? false : form.is_required,
            sort_order: form.sort_order,
            is_active: form.is_active,
        };

        const opts = {
            onError: (errs: Record<string, string>) => setErrors(errs),
            onFinish: () => setSaving(false),
        };

        if (isEdit) {
            router.put(route('model-trigger-actions.update', props.action!.id), payload, opts);
        } else {
            router.post(route('model-trigger-actions.store'), payload, opts);
        }
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? 'Edit Trigger Action' : 'New Trigger Action'} />

            <div className="mx-auto w-full max-w-2xl p-4 lg:p-6">
                <div className="mb-5 flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={route('model-trigger-actions.index')} aria-label="Back to trigger actions">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-base font-semibold">{isEdit ? 'Edit trigger action' : 'New trigger action'}</h1>
                        <p className="text-muted-foreground text-xs">
                            When a {modelLabel} hits <span className="font-medium">{triggerLabel(form.trigger_key)}</span>,{' '}
                            {isNotification ? 'send a notification' : 'assign a form'}.
                        </p>
                    </div>
                </div>

                {/* Step 1 — trigger */}
                <StepCard
                    icon={Zap}
                    iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    title="When this happens"
                    summary={`${modelLabel} · ${triggerLabel(form.trigger_key)}`}
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label className="text-muted-foreground mb-1 text-xs">Model type</Label>
                            <Select
                                value={form.model_type}
                                onValueChange={(v) =>
                                    setForm({
                                        ...form,
                                        model_type: v,
                                        trigger_key: triggerKeysByModel[v]?.[0] ?? '',
                                        form_template_id: '',
                                        subject_source: '',
                                        dispatch_mode: 'auto',
                                        min_submissions: 1,
                                    })
                                }
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
                            <Label className="text-muted-foreground mb-1 text-xs">Trigger</Label>
                            <Select value={form.trigger_key} onValueChange={(v) => setForm({ ...form, trigger_key: v })}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {triggersForModel.map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {triggerLabel(t)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </StepCard>

                <Connector />

                {/* Step 2 — action */}
                <StepCard
                    icon={isNotification ? Bell : FileText}
                    iconClass={
                        isNotification
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    }
                    title="Then do this"
                    summary={isNotification ? 'Send a notification' : 'Assign a form'}
                >
                    {/* Action type tiles */}
                    <div className="grid grid-cols-2 gap-3">
                        {(
                            [
                                { value: 'assign_form', label: 'Assign a form', hint: 'Create a form request', icon: FileText },
                                { value: 'send_notification', label: 'Send a notification', hint: 'Notify people directly', icon: Bell },
                            ] as const
                        ).map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setForm({ ...form, action_type: opt.value })}
                                className={cn(
                                    'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                                    form.action_type === opt.value
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:bg-muted/50',
                                )}
                                aria-pressed={form.action_type === opt.value}
                            >
                                <opt.icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                                <span>
                                    <span className="block text-sm font-medium">{opt.label}</span>
                                    <span className="text-muted-foreground block text-xs">{opt.hint}</span>
                                </span>
                            </button>
                        ))}
                    </div>

                    {isNotification ? (
                        <>
                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">Channels</Label>
                                <div className="grid gap-2">
                                    {CHANNEL_OPTIONS.map((c) => (
                                        <label key={c.value} className="flex cursor-pointer items-center gap-2.5">
                                            <Checkbox
                                                checked={form.notification_channels.includes(c.value)}
                                                onCheckedChange={(checked) => toggleChannel(c.value, !!checked)}
                                            />
                                            <span className="text-sm">{c.label}</span>
                                            <span className="text-muted-foreground text-xs">{c.hint}</span>
                                        </label>
                                    ))}
                                </div>
                                <FieldError message={errors.notification_channels} />
                            </div>

                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">Title</Label>
                                <Input
                                    value={form.notification_title}
                                    onChange={(e) => setForm({ ...form, notification_title: e.target.value })}
                                    placeholder="e.g. Application approved"
                                    className="h-9 text-sm"
                                />
                                <FieldError message={errors.notification_title} />
                            </div>

                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">Message</Label>
                                <Textarea
                                    value={form.notification_body}
                                    onChange={(e) => setForm({ ...form, notification_body: e.target.value })}
                                    placeholder="e.g. {{applicant.full_name}}'s application has been approved."
                                    rows={3}
                                    className="text-sm"
                                />
                                <FieldError message={errors.notification_body} />
                            </div>

                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">Link (optional)</Label>
                                <Input
                                    value={form.notification_url}
                                    onChange={(e) => setForm({ ...form, notification_url: e.target.value })}
                                    placeholder="Defaults to the record's page"
                                    className="h-9 text-sm"
                                />
                                <FieldError message={errors.notification_url} />
                            </div>

                            {Object.keys(placeholders).length > 0 && (
                                <div className="bg-muted/40 rounded-md border p-2.5">
                                    <p className="text-muted-foreground mb-1.5 text-xs font-medium">
                                        Placeholders — click to insert into the message
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(placeholders).map(([token, label]) => (
                                            <button
                                                key={token}
                                                type="button"
                                                title={label}
                                                onClick={() =>
                                                    setForm((f) => ({
                                                        ...f,
                                                        notification_body: `${f.notification_body}{{${token}}}`,
                                                    }))
                                                }
                                                className="bg-background hover:bg-muted rounded border px-1.5 py-0.5 font-mono text-[11px] transition-colors"
                                            >
                                                {`{{${token}}}`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">Form template</Label>
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
                                <FieldError message={errors.form_template_id} />
                            </div>

                            {subjectSourceKeys.length > 0 && (
                                <div>
                                    <Label className="text-muted-foreground mb-1 text-xs">Subject (fan out over)</Label>
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
                                    <FieldError message={errors.subject_source} />
                                </div>
                            )}

                            <div className={form.subject_source ? 'grid grid-cols-2 gap-3' : ''}>
                                <div>
                                    <Label className="text-muted-foreground mb-1 text-xs">Dispatch mode</Label>
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
                                        <Label className="text-muted-foreground mb-1 text-xs">Min submissions required</Label>
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
                        </>
                    )}

                    <Separator />

                    {/* Recipient — shared by both action types */}
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <Users className="text-muted-foreground h-3.5 w-3.5" />
                            <span className="text-sm font-medium">{isNotification ? 'Send to' : 'Assign to'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">Recipient type</Label>
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
                                        <SelectItem value="permission">Everyone with a permission</SelectItem>
                                        <SelectItem value="user">Specific user</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-muted-foreground mb-1 text-xs">
                                    {form.assignee_strategy === 'permission' ? 'Permission' : 'User'}
                                </Label>
                                <Select value={form.assignee_value} onValueChange={(v) => setForm({ ...form, assignee_value: v })}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue
                                            placeholder={form.assignee_strategy === 'permission' ? 'Pick a permission' : 'Pick a user'}
                                        />
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
                                <FieldError message={errors.assignee_value} />
                            </div>
                        </div>
                    </div>
                </StepCard>

                {/* Footer — misc settings + save */}
                <div className="mt-5 flex items-end justify-between gap-4">
                    <div className="flex items-end gap-4">
                        <div className="w-24">
                            <Label className="text-muted-foreground mb-1 text-xs">Sort order</Label>
                            <Input
                                type="number"
                                value={form.sort_order}
                                onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2 pb-2.5">
                            <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
                            <Label htmlFor="is_active" className="text-xs">
                                Active
                            </Label>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={route('model-trigger-actions.index')}>Cancel</Link>
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : isEdit ? 'Update action' : 'Create action'}
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
