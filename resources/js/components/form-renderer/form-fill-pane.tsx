import { Button } from '@/components/ui/button';
import { router } from '@inertiajs/react';
import { Loader2, X as XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FormFieldDisplay } from './form-field-display';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type FormResponseValue = string | string[];

export interface FormFieldData {
    id: number;
    label: string;
    type: string;
    is_required: boolean;
    options: string[] | null;
    options_source: string | null;
    placeholder: string | null;
    help_text: string | null;
    default_value: string | null;
    visible_if: {
        field_id: number;
        operator: 'equals' | 'not_equals' | 'empty' | 'not_empty';
        value: string | null;
    } | null;
}

export interface FormResponseSnapshotRow {
    field_id: number;
    label: string;
    type: string;
    options: string[] | null;
    options_source: string | null;
    sort_order: number;
    value: string | string[] | null;
    value_display: string | string[] | null;
}

export interface FormRequestData {
    id: number;
    status: string;
    delivery_method: string;
    recipient_name: string;
    recipient_email?: string | null;
    assignee_strategy: string | null;
    assignee_permission: string | null;
    assignee_user_id?: number | null;
    subject_type?: string | null;
    subject_id?: number | null;
    submitted_at: string | null;
    opened_at?: string | null;
    expires_at?: string | null;
    responses?: Record<string, unknown> | null;
    response_snapshot?: FormResponseSnapshotRow[] | null;
    form_template: { id: number; name: string; fields?: FormFieldData[] } | null;
    sent_by?: { id: number; name: string } | null;
}

// ─── Visibility evaluator (mirrors server) ────────────────────────────────────

/**
 * Mirror of FormVisibilityEvaluator on the server — same semantics, including
 * section cascade. Fields are walked in order; each rule resolves against
 * values produced by earlier (already-evaluated) fields. A heading opens a
 * section: every field below it (until the next heading) inherits the
 * heading's visibility AND-ed with its own rule. Hidden field values are
 * treated as null for downstream rules.
 */
export function evaluateVisibility(
    fields: FormFieldData[],
    values: Record<number, FormResponseValue>,
): Record<number, boolean> {
    const visible: Record<number, boolean> = {};
    const effective: Record<number, FormResponseValue | null> = {};
    let sectionVisible = true;

    const evalRule = (rule: NonNullable<FormFieldData['visible_if']>): boolean => {
        const source = effective[rule.field_id];
        const empty =
            source === null ||
            source === undefined ||
            source === '' ||
            (Array.isArray(source) && source.length === 0);
        const matches = (() => {
            if (rule.value === null || rule.value === undefined) return false;
            if (Array.isArray(source)) return source.includes(rule.value);
            return String(source ?? '') === rule.value;
        })();
        return rule.operator === 'empty'
            ? empty
            : rule.operator === 'not_empty'
              ? !empty
              : rule.operator === 'equals'
                ? matches
                : rule.operator === 'not_equals'
                  ? !matches
                  : true;
    };

    for (const field of fields) {
        let isVisible: boolean;
        if (field.type === 'heading') {
            sectionVisible = field.visible_if ? evalRule(field.visible_if) : true;
            isVisible = sectionVisible;
        } else {
            const ownRule = field.visible_if ? evalRule(field.visible_if) : true;
            isVisible = sectionVisible && ownRule;
        }
        visible[field.id] = isVisible;
        effective[field.id] = isVisible ? (values[field.id] ?? null) : null;
    }

    return visible;
}

function formatDateTime(dateString: string | null | undefined) {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ─── Fill pane ────────────────────────────────────────────────────────────────

export function FormFillPane({
    formRequest,
    onClose,
}: {
    formRequest: FormRequestData | null;
    onClose: () => void;
}) {
    const [values, setValues] = useState<Record<number, FormResponseValue>>({});
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [dynamicOptions, setDynamicOptions] = useState<Record<string, { value: string; label: string }[]>>({});

    const fields = useMemo(() => formRequest?.form_template?.fields ?? [], [formRequest]);

    useEffect(() => {
        if (!formRequest) return;
        const sources = Array.from(
            new Set(fields.map((f) => f.options_source).filter((s): s is string => !!s)),
        );
        if (sources.length === 0) return;
        let cancelled = false;
        Promise.all(
            sources.map((src) =>
                fetch(route('form-templates.options-sources.resolve', { source: src }), {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                })
                    .then((r) => (r.ok ? r.json() : { options: [] }))
                    .then((data: { options: { id: string; name: string }[] }) => ({
                        src,
                        opts: (data.options ?? []).map((o) => ({ value: String(o.id), label: o.name })),
                    }))
                    .catch(() => ({ src, opts: [] as { value: string; label: string }[] })),
            ),
        ).then((results) => {
            if (cancelled) return;
            setDynamicOptions(Object.fromEntries(results.map(({ src, opts }) => [src, opts])));
        });
        return () => {
            cancelled = true;
        };
    }, [formRequest, fields]);

    const visibility = useMemo(() => evaluateVisibility(fields, values), [fields, values]);

    const pages = useMemo(() => {
        const result: FormFieldData[][] = [[]];
        for (const f of fields) {
            if (f.type === 'page_break') {
                result.push([]);
            } else {
                result[result.length - 1].push(f);
            }
        }
        return result.filter((p) => p.length > 0);
    }, [fields]);
    const pageCount = pages.length;
    const isPaginated = pageCount > 1;
    const [currentPage, setCurrentPage] = useState(0);

    useEffect(() => {
        setCurrentPage(0);
    }, [formRequest?.id]);

    const visibleFieldsOnCurrentPage = useMemo(
        () => (pages[currentPage] ?? []).filter((f) => visibility[f.id]),
        [pages, currentPage, visibility],
    );

    useEffect(() => {
        if (!formRequest) return;
        const initial: Record<number, FormResponseValue> = {};
        for (const field of fields) {
            const def = field.default_value ?? '';
            if (field.type === 'checkbox' || field.type === 'multiselect' || field.type === 'button_group_multi') {
                initial[field.id] = def ? def.split(',').map((v) => v.trim()).filter(Boolean) : [];
            } else {
                initial[field.id] = def;
            }
        }
        setValues(initial);
        setFieldErrors({});
    }, [formRequest, fields]);

    function setValue(fieldId: number, v: FormResponseValue) {
        setValues((prev) => ({ ...prev, [fieldId]: v }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formRequest) return;

        const localErrors: Record<string, string> = {};
        for (const field of fields) {
            if (!field.is_required) continue;
            if (['heading', 'paragraph', 'page_break'].includes(field.type)) continue;
            if (!visibility[field.id]) continue;
            const v = values[field.id];
            const empty = Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
            if (empty) {
                localErrors[`field_${field.id}`] = `${field.label} is required.`;
            }
        }
        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors);
            const firstErrorId = Number(Object.keys(localErrors)[0]?.replace('field_', ''));
            if (firstErrorId) {
                const idx = pages.findIndex((p) => p.some((f) => f.id === firstErrorId));
                if (idx >= 0 && idx !== currentPage) setCurrentPage(idx);
            }
            return;
        }

        const payload: Record<string, FormResponseValue> = {};
        for (const field of fields) {
            if (['heading', 'paragraph', 'page_break'].includes(field.type)) continue;
            payload[`field_${field.id}`] = visibility[field.id] ? (values[field.id] ?? '') : '';
        }

        setSaving(true);
        router.post(route('form-requests.submit-internal', formRequest.id), payload, {
            preserveScroll: true,
            onSuccess: () => {
                onClose();
            },
            onError: (errs) => {
                setFieldErrors(errs as Record<string, string>);
            },
            onFinish: () => setSaving(false),
        });
    }

    if (!formRequest) return null;

    return (
        <aside
            className="bg-background fixed inset-y-0 right-0 z-30 flex w-full max-w-[520px] flex-col border-l shadow-2xl animate-in slide-in-from-right duration-200"
            aria-label="Fill out form"
        >
            <div className="bg-background flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{formRequest.form_template?.name ?? 'Form'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                        Originally sent to <span className="text-foreground">{formRequest.recipient_name}</span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
                    title="Close"
                    aria-label="Close form pane"
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                {isPaginated && (
                    <div className="text-muted-foreground border-b px-4 py-1.5 text-right text-xs">
                        Page {currentPage + 1} of {pageCount}
                    </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="space-y-4">
                        {pages[currentPage]?.map((field) => {
                            if (!visibility[field.id]) return null;
                            const err = fieldErrors[`field_${field.id}`];
                            return (
                                <FormFieldDisplay
                                    key={field.id}
                                    field={{
                                        id: field.id,
                                        label: field.label,
                                        type: field.type,
                                        is_required: field.is_required,
                                        options: field.options,
                                        options_source: field.options_source,
                                        placeholder: field.placeholder,
                                        help_text: field.help_text,
                                    }}
                                    value={values[field.id]}
                                    mode="editable"
                                    onChange={(v) => setValue(field.id, v ?? '')}
                                    dynamicOptions={field.options_source ? dynamicOptions[field.options_source] : undefined}
                                    error={err}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="bg-background flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3">
                    <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <div className="flex items-center gap-2">
                        {isPaginated && currentPage > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                                disabled={saving}
                            >
                                Previous
                            </Button>
                        )}
                        {isPaginated && currentPage < pageCount - 1 ? (
                            <Button
                                type="button"
                                onClick={() => {
                                    const errs: Record<string, string> = {};
                                    for (const f of visibleFieldsOnCurrentPage) {
                                        if (!f.is_required) continue;
                                        if (['heading', 'paragraph', 'page_break'].includes(f.type)) continue;
                                        const v = values[f.id];
                                        const empty = Array.isArray(v) ? v.length === 0 : !v || !String(v).trim();
                                        if (empty) errs[`field_${f.id}`] = `${f.label} is required.`;
                                    }
                                    if (Object.keys(errs).length > 0) {
                                        setFieldErrors(errs);
                                        return;
                                    }
                                    setFieldErrors({});
                                    setCurrentPage((p) => Math.min(pageCount - 1, p + 1));
                                }}
                                disabled={saving}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button type="submit" disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit form'
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </form>
        </aside>
    );
}

// ─── Response pane (readonly) ─────────────────────────────────────────────────

export function FormResponsePane({
    formRequest,
    onClose,
}: {
    formRequest: FormRequestData | null;
    onClose: () => void;
}) {
    if (!formRequest) return null;

    const snapshot = formRequest.response_snapshot ?? [];

    return (
        <aside
            className="bg-background fixed inset-y-0 right-0 z-30 flex w-full max-w-[520px] flex-col border-l shadow-2xl animate-in slide-in-from-right duration-200"
            aria-label="View submitted form"
        >
            <div className="bg-background flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{formRequest.form_template?.name ?? 'Form'}</p>
                    <p className="text-muted-foreground truncate text-xs">
                        Submitted by <span className="text-foreground">{formRequest.recipient_name}</span>
                        {formRequest.submitted_at && <> · {formatDateTime(formRequest.submitted_at)}</>}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors"
                    title="Close"
                    aria-label="Close response pane"
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                {snapshot.length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-xs italic">No response snapshot available.</p>
                ) : (
                    <div className="space-y-4">
                        {snapshot.map((row) => (
                            <FormFieldDisplay
                                key={row.field_id}
                                field={{
                                    id: row.field_id,
                                    label: row.label,
                                    type: row.type,
                                    options: row.options,
                                    options_source: row.options_source,
                                }}
                                value={row.value}
                                valueDisplay={row.value_display}
                                mode="readonly"
                            />
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
