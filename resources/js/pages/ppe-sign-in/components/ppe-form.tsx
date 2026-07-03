import { useMemo, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { Icon } from '@iconify/react';

const CATALOG_ICONS: Record<string, string> = {
    safety_glasses_clear: 'healthicons:ppe-goggles',
    safety_glasses_tinted: 'mdi:sunglasses',
    ear_plugs: 'mdi:ear-hearing',
    gloves: 'healthicons:ppe-gloves',
    rpe_half_face: 'healthicons:respirator',
    respirator_filter: 'mdi:filter-variant',
    tool_lanyard: 'mdi:cable-data',
    chin_strap: 'mdi:hard-hat',
    vadar_mask: 'mdi:domino-mask',
    face_shield: 'healthicons:ppe-face-shield-alt',
    other: 'mdi:dots-horizontal-circle-outline',
};

const REASON_PARENT_ICONS: Record<string, string> = {
    new_starter: 'mdi:account-plus-outline',
    replacement: 'mdi:swap-horizontal',
    additional: 'mdi:plus-circle-outline',
    project_specific: 'mdi:briefcase-outline',
    visitor: 'mdi:account-question-outline',
    other: 'mdi:dots-horizontal-circle-outline',
};

export type CatalogItem = {
    key: string;
    label: string;
    sizes?: string[];
    requires_make_model?: boolean;
    optional_make_model?: boolean;
};

export type IssuedItem = {
    key: string;
    qty: number;
    size?: string;
    make_model?: string;
};

export type Manager = { id: number; name: string };

export type PpeFormOptions = {
    reasons: Record<string, string>;
    returned: Record<string, string>;
    catalog: CatalogItem[];
};

export type PpeFormEndpoints = {
    submit: string;
};

type ReasonParent = {
    key: string;
    label: string;
    children?: { key: string; label: string }[];
};

/**
 * Two-step reason picker. Parent keys ending in a leaf (no `children`) submit
 * their own key directly; the `replacement` parent expands a second row of
 * sub-options that submit `replacement_*` keys. The backend accepts any of
 * the 9 leaf keys defined in PpeIssuance::REASON_OPTIONS.
 */
const REASON_PARENTS: ReasonParent[] = [
    { key: 'new_starter', label: 'New Starter' },
    {
        key: 'replacement',
        label: 'Replacement',
        children: [
            { key: 'replacement_worn', label: 'Worn / Damaged' },
            { key: 'replacement_lost', label: 'Lost' },
            { key: 'replacement_stolen', label: 'Stolen' },
            { key: 'replacement_expired', label: 'Expired' },
        ],
    },
    { key: 'additional', label: 'Additional PPE required' },
    { key: 'project_specific', label: 'Project specific requirement' },
    { key: 'visitor', label: 'Visitor / Temporary Worker' },
    { key: 'other', label: 'Other' },
];

const parentOfReason = (reason: string): string | null => {
    if (!reason) return null;
    for (const p of REASON_PARENTS) {
        if (p.key === reason) return p.key;
        if (p.children?.some((c) => c.key === reason)) return p.key;
    }
    return null;
};

type Props = {
    employee: { id: number; name: string };
    /** PIN to forward with the submit payload. Pass null when the worker is already session-authed. */
    pin: string | null;
    options: PpeFormOptions;
    managers: Manager[];
    endpoints: PpeFormEndpoints;
    onCancel: () => void;
    onSuccess: () => void;
    /** Hide the built-in Cancel + "Collecting as" header bar — useful when the host page already shows its own chrome. */
    hideHeader?: boolean;
};

const DISCLAIMER =
    'By submitting this form, I confirm that I have received the selected PPE/RPE, I understand its intended use, have received any required instruction or training, and accept responsibility for maintaining and using the PPE/RPE correctly.';

function csrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}

const initialsOf = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0] ?? '')
        .join('')
        .toUpperCase();

export default function PpeForm({ employee, pin, options, managers, endpoints, onCancel, onSuccess, hideHeader = false }: Props) {
    const [reason, setReason] = useState<string>('');
    const [pendingParent, setPendingParent] = useState<string | null>(null);
    const [items, setItems] = useState<Record<string, IssuedItem>>({});
    const [fitTest, setFitTest] = useState<'yes' | 'no' | null>(null);
    const [authorisedBy, setAuthorisedBy] = useState<number | null>(null);
    const [returned, setReturned] = useState<string>('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rpeSelected = useMemo(() => !!items['rpe_half_face'], [items]);

    const activeReasonParent = parentOfReason(reason) ?? pendingParent;
    const replacementChildren = REASON_PARENTS.find((p) => p.key === 'replacement')?.children ?? [];

    const returnedList = useMemo(() => Object.entries(options.returned), [options.returned]);

    const canSubmit =
        !!reason &&
        Object.keys(items).length > 0 &&
        !!authorisedBy &&
        !!returned &&
        acknowledged &&
        (!rpeSelected || fitTest !== null) &&
        Object.values(items).every(
            (it) => {
                const cat = options.catalog.find((c) => c.key === it.key);
                if (cat?.sizes && cat.sizes.length > 0 && !it.size) return false;
                if (cat?.requires_make_model && !(it.make_model && it.make_model.trim())) return false;
                return it.qty > 0;
            },
        );

    const toggleItem = (item: CatalogItem) => {
        setItems((prev) => {
            const next = { ...prev };
            if (next[item.key]) {
                delete next[item.key];
            } else {
                next[item.key] = {
                    key: item.key,
                    qty: 1,
                    size: item.sizes?.[0],
                };
            }
            return next;
        });
    };

    const updateItem = (key: string, patch: Partial<IssuedItem>) => {
        setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    };

    const submit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(endpoints.submit, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                },
                body: JSON.stringify({
                    ...(pin !== null
                        ? { employee_id: employee.id, pin }
                        : {}),
                    reason,
                    issued_items: Object.values(items),
                    fit_test_completed: rpeSelected ? fitTest === 'yes' : null,
                    authorised_by_user_id: authorisedBy,
                    ppe_returned: returned,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                setError(data?.message || 'Could not submit. Try again.');
                return;
            }
            onSuccess();
        } catch {
            setError('Connection error. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden">
            {!hideHeader && (
                <header className="bg-card flex shrink-0 items-center justify-between border-b px-5 py-3">
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground text-sm font-medium">
                        Cancel
                    </button>
                    <div className="text-center">
                        <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Collecting as</p>
                        <p className="text-foreground text-sm font-semibold">{employee.name}</p>
                    </div>
                    <div className="w-12" />
                </header>
            )}

            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl space-y-8 px-5 py-6">
                    <Section number={1} title="Reason for issue">
                        <div className="grid gap-2 sm:grid-cols-2">
                            {REASON_PARENTS.map((p) => {
                                const active = activeReasonParent === p.key;
                                const iconName = REASON_PARENT_ICONS[p.key];
                                return (
                                    <Pill
                                        key={p.key}
                                        active={active}
                                        onClick={() => {
                                            if (p.children) {
                                                setPendingParent(p.key);
                                                if (parentOfReason(reason) !== p.key) setReason('');
                                            } else {
                                                setReason(p.key);
                                                setPendingParent(null);
                                            }
                                        }}
                                    >
                                        <span className="flex items-center gap-2.5">
                                            {iconName && (
                                                <span
                                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
                                                        active
                                                            ? 'bg-background/15 text-background'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}
                                                >
                                                    <Icon icon={iconName} width={16} height={16} />
                                                </span>
                                            )}
                                            <span>{p.label}</span>
                                        </span>
                                    </Pill>
                                );
                            })}
                        </div>
                        {activeReasonParent === 'replacement' && (
                            <div className="bg-muted/40 mt-3 rounded-xl border p-3">
                                <p className="text-muted-foreground mb-2 text-[11px] font-medium uppercase tracking-wider">
                                    Replacement reason
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {replacementChildren.map((c) => (
                                        <Pill key={c.key} active={reason === c.key} onClick={() => setReason(c.key)}>
                                            {c.label}
                                        </Pill>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Section>

                    <Section number={2} title="PPE/RPE issued" subtitle="Tap each item being issued — set quantity, size, and details. Icons are illustrative only and do not represent the actual PPE supplied.">
                        <div className="space-y-2">
                            {options.catalog.map((cat) => {
                                const selected = items[cat.key];
                                return (
                                    <div
                                        key={cat.key}
                                        className={`rounded-xl border transition ${
                                            selected ? 'border-foreground bg-card shadow-sm' : 'bg-muted/40 border-border'
                                        }`}
                                    >
                                        <div className="flex w-full items-center gap-3 px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => toggleItem(cat)}
                                                className="flex flex-1 items-center gap-3 text-left"
                                            >
                                                <div
                                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                                                        selected ? 'border-foreground bg-foreground' : 'bg-card border-input'
                                                    }`}
                                                >
                                                    {selected && <Check className="text-background h-4 w-4" strokeWidth={3} />}
                                                </div>
                                                <CatalogIcon catKey={cat.key} active={!!selected} />
                                                <span className="text-foreground flex-1 text-[15px] font-medium">{cat.label}</span>
                                            </button>
                                            {selected && (
                                                <QtyStepper
                                                    value={selected.qty}
                                                    onChange={(v) => updateItem(cat.key, { qty: v })}
                                                />
                                            )}
                                        </div>
                                        {selected && ((cat.sizes && cat.sizes.length > 0) || cat.requires_make_model || cat.optional_make_model) && (
                                            <div className="bg-muted/30 flex flex-wrap items-end gap-3 border-t px-4 py-3">
                                                {cat.sizes && cat.sizes.length > 0 && (
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                                                            Size
                                                        </label>
                                                        <div className="flex gap-1">
                                                            {cat.sizes.map((s) => (
                                                                <button
                                                                    key={s}
                                                                    type="button"
                                                                    onClick={() => updateItem(cat.key, { size: s })}
                                                                    className={`h-9 min-w-9 rounded-md border px-3 text-sm font-medium transition ${
                                                                        selected.size === s
                                                                            ? 'border-foreground bg-foreground text-background'
                                                                            : 'border-border bg-card text-foreground hover:border-foreground/40'
                                                                    }`}
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {(cat.requires_make_model || cat.optional_make_model) && (
                                                    <div className="flex flex-1 flex-col gap-1 sm:min-w-[240px]">
                                                        <label className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                                                            {cat.key === 'other'
                                                                ? 'Please specify item'
                                                                : `Make & model${cat.optional_make_model && !cat.requires_make_model ? ' (optional)' : ''}`}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={selected.make_model ?? ''}
                                                            onChange={(e) => updateItem(cat.key, { make_model: e.target.value })}
                                                            placeholder={cat.key === 'other' ? 'Describe the item' : 'e.g. 3M 6200'}
                                                            className="bg-card text-foreground border-border focus:border-ring h-9 rounded-md border px-3 text-sm outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </Section>

                    {rpeSelected && (
                        <Section number={3} title="Quantitative fit test completed?">
                            <div className="flex gap-2">
                                <Pill active={fitTest === 'yes'} onClick={() => setFitTest('yes')}>
                                    Yes
                                </Pill>
                                <Pill active={fitTest === 'no'} onClick={() => setFitTest('no')}>
                                    No
                                </Pill>
                            </div>
                        </Section>
                    )}

                    <Section number={rpeSelected ? 4 : 3} title="Authorised by">
                        {managers.length === 0 ? (
                            <p className="border-border bg-muted/40 text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm italic">
                                No supervisors registered for this location.
                            </p>
                        ) : (
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {managers.map((m) => {
                                    const active = authorisedBy === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setAuthorisedBy(m.id)}
                                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                                                active
                                                    ? 'border-foreground bg-foreground text-background shadow-sm'
                                                    : 'border-border bg-card text-foreground hover:border-foreground/40'
                                            }`}
                                        >
                                            <span
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                                    active ? 'bg-background/15 text-background' : 'bg-muted text-muted-foreground'
                                                }`}
                                            >
                                                {initialsOf(m.name)}
                                            </span>
                                            <span className="text-sm font-medium">{m.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Section>

                    <Section number={rpeSelected ? 5 : 4} title="Damaged or worn PPE returned to supervisor?">
                        <div className="flex flex-wrap gap-2">
                            {returnedList.map(([key, label]) => (
                                <Pill key={key} active={returned === key} onClick={() => setReturned(key)}>
                                    {label}
                                </Pill>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>

            <footer className="bg-card shrink-0 border-t px-5 py-4">
                <div className="mx-auto w-full max-w-3xl space-y-3">
                    <button
                        type="button"
                        onClick={() => setAcknowledged(!acknowledged)}
                        className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            acknowledged ? 'bg-muted/40 border-border' : 'border-border bg-card'
                        }`}
                    >
                        <div
                            className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                                acknowledged ? 'border-foreground bg-foreground' : 'bg-card border-input'
                            }`}
                        >
                            {acknowledged && <Check className="text-background h-4 w-4" strokeWidth={3} />}
                        </div>
                        <p className="text-foreground/80 flex-1 text-[13px] leading-relaxed">{DISCLAIMER}</p>
                    </button>
                    {error && (
                        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-center text-xs font-medium">{error}</p>
                    )}
                    <button
                        onClick={submit}
                        disabled={!canSubmit || submitting}
                        className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {submitting ? 'Submitting…' : 'Submit PPE/RPE issuance'}
                    </button>
                </div>
            </footer>
        </div>
    );
}

function CatalogIcon({ catKey, active }: { catKey: string; active: boolean }) {
    const iconName = CATALOG_ICONS[catKey] ?? 'mdi:circle-outline';
    return (
        <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
            }`}
        >
            <Icon icon={iconName} width={18} height={18} />
        </div>
    );
}

function Section({ number, title, subtitle, children }: { number: number; title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section>
            <div className="mb-3 flex items-center gap-3">
                <span className="bg-foreground text-background flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">
                    {number}
                </span>
                <div>
                    <h2 className="text-foreground text-[15px] font-semibold">{title}</h2>
                    {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                active
                    ? 'border-foreground bg-foreground text-background shadow-sm'
                    : 'border-border bg-card text-foreground hover:border-foreground/40'
            }`}
        >
            {children}
        </button>
    );
}

function QtyStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div className="border-border bg-card inline-flex items-center overflow-hidden rounded-md border">
            <button
                type="button"
                onClick={() => onChange(Math.max(1, value - 1))}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center"
            >
                <Minus className="h-4 w-4" />
            </button>
            <span className="text-foreground w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
            <button
                type="button"
                onClick={() => onChange(Math.min(50, value + 1))}
                className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
}
