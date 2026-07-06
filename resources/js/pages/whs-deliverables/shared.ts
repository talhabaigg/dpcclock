export type { RequestPayload } from '@inertiajs/core';

export type DeliverableType = 'plant' | 'electrical' | 'asset' | 'lifting';

export type StatusKey = 'expired' | 'due' | 'ok' | 'none';

export interface TypeField {
    key: string;
    label: string;
    type?: 'select';
    options?: string[];
    optional?: boolean;
    full?: boolean;
}

export interface ChecklistItem {
    key: string;
    label: string;
    /** When set, a free-text input appears beneath the checkbox once ticked; its value is stored in `details[input_key]`. */
    input_key?: string;
    input_placeholder?: string;
}

export interface TypeConfig {
    label: string;
    last_label: string;
    next_label: string;
    physical: boolean;
    next_optional?: boolean;
    fields: TypeField[];
    checklist_label?: string;
    checklist?: ChecklistItem[];
}

export type TypesConfig = Record<DeliverableType, TypeConfig>;

export interface DeliverableLocation {
    id: number;
    name: string;
    external_id?: string | null;
}

export interface DeliverableCard {
    id: string;
    type: DeliverableType;
    type_label: string;
    name: string;
    physical: boolean;
    photo_url: string | null;
    details: Record<string, string>;
    last_label: string;
    next_label: string;
    last_date: string | null;
    next_date: string | null;
    notify: boolean;
    status_key: StatusKey;
    days_until: number | null;
}

export interface DeliverableDetail extends DeliverableCard {
    checklist: Record<string, boolean>;
    created_at: string | null;
    creator: { id: number; name: string } | null;
}

export const TYPE_ORDER: DeliverableType[] = ['plant', 'electrical', 'asset', 'lifting'];

/** Short badge label, e.g. "Expired", "Due in 5d", "In date", "No date". */
export function statusLabel(key: StatusKey, days: number | null): string {
    switch (key) {
        case 'expired':
            return days === null ? 'Expired' : `Overdue ${Math.abs(days)}d`;
        case 'due':
            return days === 0 ? 'Due today' : `Due in ${days}d`;
        case 'ok':
            return 'In date';
        default:
            return 'No date';
    }
}

/** Tailwind classes for the status badge — readable in both light and dark themes. */
export function statusBadgeClass(key: StatusKey): string {
    switch (key) {
        case 'expired':
            return 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400';
        case 'due':
            return 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400';
        case 'ok':
            return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
        default:
            return 'border-border bg-muted text-muted-foreground';
    }
}

/** Solid colour for the small status dot. */
export function statusDotClass(key: StatusKey): string {
    switch (key) {
        case 'expired':
            return 'bg-red-500';
        case 'due':
            return 'bg-amber-500';
        case 'ok':
            return 'bg-emerald-500';
        default:
            return 'bg-muted-foreground/40';
    }
}

/** dd/mm/yyyy from an ISO yyyy-mm-dd date, or an em-dash when missing. */
export function formatDate(iso: string | null): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

/** The most identifying detail value for a card subline (serial / fleet / asset id). */
export function cardSubline(card: DeliverableCard): string | null {
    const d = card.details ?? {};
    const candidate = d.serial_number || d.fleet_number || d.asset_id || d.plant_type || d.lifting_type || d.description || d.asset_type;
    return candidate ?? null;
}
