import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowLeft, Bell, ChevronRight, FileText, Maximize, Save, Settings2, Users, Zap, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

type Panel = 'trigger' | 'action' | 'settings';

/** Which validation error keys belong to which step card. */
const PANEL_FIELDS: Record<Panel, string[]> = {
    trigger: ['model_type', 'trigger_key'],
    action: [
        'action_type',
        'form_template_id',
        'subject_source',
        'dispatch_mode',
        'min_submissions',
        'assignee_strategy',
        'assignee_value',
        'notification_channels',
        'notification_title',
        'notification_body',
        'notification_url',
        'is_required',
    ],
    settings: ['sort_order', 'is_active'],
};

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

/**
 * Compact step card on the designer canvas, Power Automate style — the card
 * only shows what the step does; clicking it opens the config sheet.
 */
function StepCard({
    icon: Icon,
    label,
    summary,
    selected,
    hasError,
    onClick,
}: {
    icon: typeof Zap;
    label: string;
    summary: string;
    selected: boolean;
    hasError: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            data-step-card
            onClick={onClick}
            className={cn(
                'bg-card group flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left shadow-sm transition-[border-color,box-shadow]',
                selected ? 'border-primary ring-primary/30 ring-2' : 'hover:border-primary/50',
                hasError && 'border-red-500 ring-2 ring-red-500/30',
            )}
        >
            <div className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-md border">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
                <p className="truncate text-sm font-medium">{summary}</p>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>
    );
}

/** Vertical connector between step cards. */
function Connector() {
    return (
        <div className="flex flex-col items-center" aria-hidden>
            <div className="bg-border h-4 w-px" />
            <div className="border-border bg-card text-muted-foreground flex h-5 w-5 items-center justify-center rounded-full border shadow-sm">
                <ArrowDown className="h-3 w-3" />
            </div>
            <div className="bg-border h-4 w-px" />
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
    const [openPanel, setOpenPanel] = useState<Panel | null>(null);

    // Canvas zoom + pan, Power Automate style: drag empty canvas to pan,
    // ctrl/cmd + wheel (or the toolbar) to zoom.
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [panning, setPanning] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);
    const dragStart = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);

    const clampZoom = (z: number) => Math.min(1.5, Math.max(0.5, Math.round(z * 10) / 10));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Native listener because React's onWheel can't preventDefault (passive).
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.1 : -0.1)));
        };

        canvas.addEventListener('wheel', onWheel, { passive: false });
        return () => canvas.removeEventListener('wheel', onWheel);
    }, []);

    function onCanvasPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        // Cards and toolbar buttons handle their own clicks — only empty canvas pans.
        if ((e.target as HTMLElement).closest('[data-step-card], [data-canvas-toolbar]')) return;
        dragStart.current = { pointerX: e.clientX, pointerY: e.clientY, panX: pan.x, panY: pan.y };
        setPanning(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function onCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        const start = dragStart.current;
        if (!start) return;
        setPan({ x: start.panX + (e.clientX - start.pointerX), y: start.panY + (e.clientY - start.pointerY) });
    }

    function onCanvasPointerUp() {
        dragStart.current = null;
        setPanning(false);
    }

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

    const actionSummary = isNotification
        ? form.notification_title
            ? `Send a notification — ${form.notification_title}`
            : 'Send a notification'
        : ((name) => (name ? `Assign a form — ${name}` : 'Assign a form'))(
              eligibleTemplates.find((t) => t.id === form.form_template_id)?.name,
          );

    function panelHasError(panel: Panel): boolean {
        return PANEL_FIELDS[panel].some((field) => Object.keys(errors).some((key) => key === field || key.startsWith(`${field}.`)));
    }

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
            onError: (errs: Record<string, string>) => {
                setErrors(errs);
                // Surface the step whose config is invalid.
                const firstBroken = (['trigger', 'action', 'settings'] as Panel[]).find((panel) =>
                    PANEL_FIELDS[panel].some((field) => Object.keys(errs).some((key) => key === field || key.startsWith(`${field}.`))),
                );
                if (firstBroken) setOpenPanel(firstBroken);
            },
            onFinish: () => setSaving(false),
        };

        if (isEdit) {
            router.put(route('model-trigger-actions.update', props.action!.id), payload, opts);
        } else {
            router.post(route('model-trigger-actions.store'), payload, opts);
        }
    }

    const sheetTitles: Record<Panel, { title: string; description: string }> = {
        trigger: { title: 'When this happens', description: 'Pick the model and the trigger that fires this action.' },
        action: { title: 'Then do this', description: 'Configure what happens when the trigger hits.' },
        settings: { title: 'Settings', description: 'Ordering and other options.' },
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isEdit ? 'Edit Trigger Action' : 'New Trigger Action'} />

            <div className="flex h-full flex-col">
                {/* Command bar */}
                <div className="bg-background flex items-center justify-between gap-3 border-b px-4 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                            <Link href={route('model-trigger-actions.index')} aria-label="Back to trigger actions">
                                <ArrowLeft className="h-4 w-4" />
                            </Link>
                        </Button>
                        <h1 className="truncate text-sm font-semibold">{isEdit ? 'Edit trigger action' : 'New trigger action'}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="mr-2 flex items-center gap-2">
                            <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
                            <Label htmlFor="is_active" className="text-muted-foreground text-xs">
                                Active
                            </Label>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                            <Link href={route('model-trigger-actions.index')}>Cancel</Link>
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={saving}>
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            {saving ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </div>

                {/* Designer canvas — compact cards; clicking one opens its config sheet.
                    Drag empty space to pan, ctrl/cmd+wheel or the toolbar to zoom. */}
                <div
                    ref={canvasRef}
                    onPointerDown={onCanvasPointerDown}
                    onPointerMove={onCanvasPointerMove}
                    onPointerUp={onCanvasPointerUp}
                    onPointerCancel={onCanvasPointerUp}
                    className={cn(
                        'bg-muted/30 relative flex-1 touch-none overflow-hidden bg-[radial-gradient(var(--color-border)_1px,transparent_1px)]',
                        panning ? 'cursor-grabbing' : 'cursor-grab',
                    )}
                    style={{
                        backgroundSize: `${18 * zoom}px ${18 * zoom}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`,
                    }}
                >
                    <div
                        className="mx-auto flex w-full max-w-sm flex-col items-center px-4 py-12"
                        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top center' }}
                    >
                        <StepCard
                            icon={Zap}
                            label="Trigger"
                            summary={`${modelLabel} · ${triggerLabel(form.trigger_key)}`}
                            selected={openPanel === 'trigger'}
                            hasError={panelHasError('trigger')}
                            onClick={() => setOpenPanel('trigger')}
                        />
                        <Connector />
                        <StepCard
                            icon={isNotification ? Bell : FileText}
                            label="Action"
                            summary={actionSummary}
                            selected={openPanel === 'action'}
                            hasError={panelHasError('action')}
                            onClick={() => setOpenPanel('action')}
                        />
                        <Connector />
                        <StepCard
                            icon={Settings2}
                            label="Settings"
                            summary={`Sort order ${form.sort_order} · ${form.is_active ? 'Active' : 'Inactive'}`}
                            selected={openPanel === 'settings'}
                            hasError={panelHasError('settings')}
                            onClick={() => setOpenPanel('settings')}
                        />
                    </div>

                    {/* Zoom toolbar */}
                    <div
                        data-canvas-toolbar
                        className="bg-card absolute right-4 bottom-4 flex items-center gap-0.5 rounded-lg border p-1 shadow-sm"
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setZoom((z) => clampZoom(z - 0.1))}
                            disabled={zoom <= 0.5}
                            aria-label="Zoom out"
                        >
                            <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-muted-foreground w-10 text-center font-mono text-[11px] tabular-nums">
                            {Math.round(zoom * 100)}%
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setZoom((z) => clampZoom(z + 0.1))}
                            disabled={zoom >= 1.5}
                            aria-label="Zoom in"
                        >
                            <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                                setZoom(1);
                                setPan({ x: 0, y: 0 });
                            }}
                            aria-label="Reset view"
                        >
                            <Maximize className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Config sheet */}
            <Sheet open={openPanel !== null} onOpenChange={(open) => !open && setOpenPanel(null)}>
                <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
                    {openPanel && (
                        <>
                            <SheetHeader>
                                <SheetTitle>{sheetTitles[openPanel].title}</SheetTitle>
                                <SheetDescription>{sheetTitles[openPanel].description}</SheetDescription>
                            </SheetHeader>

                            <div className="grid flex-1 content-start gap-4 overflow-y-auto px-4 py-4">
                                {openPanel === 'trigger' && (
                                    <>
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
                                            <FieldError message={errors.model_type} />
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
                                            <FieldError message={errors.trigger_key} />
                                        </div>
                                    </>
                                )}

                                {openPanel === 'action' && (
                                    <>
                                        {/* Action type tiles */}
                                        <div className="grid grid-cols-2 gap-3">
                                            {(
                                                [
                                                    { value: 'assign_form', label: 'Assign a form', hint: 'Create a form request', icon: FileText },
                                                    {
                                                        value: 'send_notification',
                                                        label: 'Send a notification',
                                                        hint: 'Notify people directly',
                                                        icon: Bell,
                                                    },
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
                                                                    setForm({
                                                                        ...form,
                                                                        min_submissions: Math.max(1, Number(e.target.value) || 1),
                                                                    })
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
                                            <div className="grid gap-3">
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
                                                    <Select
                                                        value={form.assignee_value}
                                                        onValueChange={(v) => setForm({ ...form, assignee_value: v })}
                                                    >
                                                        <SelectTrigger className="h-9">
                                                            <SelectValue
                                                                placeholder={
                                                                    form.assignee_strategy === 'permission'
                                                                        ? 'Pick a permission'
                                                                        : 'Pick a user'
                                                                }
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
                                    </>
                                )}

                                {openPanel === 'settings' && (
                                    <div className="w-32">
                                        <Label className="text-muted-foreground mb-1 text-xs">Sort order</Label>
                                        <Input
                                            type="number"
                                            value={form.sort_order}
                                            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
                                            className="h-9 text-sm"
                                        />
                                        <p className="text-muted-foreground mt-1 text-xs">Actions on the same trigger fire in this order.</p>
                                    </div>
                                )}
                            </div>

                            <SheetFooter className="border-t">
                                <Button variant="outline" onClick={() => setOpenPanel(null)}>
                                    Done
                                </Button>
                            </SheetFooter>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </AppLayout>
    );
}
