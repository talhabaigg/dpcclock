import { Building, CircleCheck, CircleX, Hourglass, Loader, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StatusTone = 'neutral' | 'review' | 'ready' | 'done' | 'danger';

export interface StatusConfig {
    key: string;
    label: string;
    columnLabel: string;
    icon: LucideIcon;
    tone: StatusTone;
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
    pending:       { key: 'pending',       label: 'Pending',           columnLabel: 'Pending',             icon: Loader,      tone: 'neutral' },
    office_review: { key: 'office_review', label: 'Office Review',     columnLabel: 'Waiting for Review',  icon: Building,    tone: 'review'  },
    processed:     { key: 'processed',     label: 'Processed',         columnLabel: 'Processed',           icon: CircleCheck, tone: 'review'  },
    success:       { key: 'success',       label: 'Awaiting Delivery', columnLabel: 'Awaiting',            icon: Hourglass,   tone: 'ready'   },
    sent:          { key: 'sent',          label: 'Sent',              columnLabel: 'Sent',                icon: Truck,       tone: 'done'    },
    failed:        { key: 'failed',        label: 'Failed',            columnLabel: 'Failed',              icon: CircleX,     tone: 'danger'  },
};

export function getStatus(status: string): StatusConfig {
    return (
        STATUS_CONFIG[status] ?? {
            key: status,
            label: status.replace(/_/g, ' '),
            columnLabel: status.replace(/_/g, ' '),
            icon: Loader,
            tone: 'neutral',
        }
    );
}

export const TONE_STYLES: Record<StatusTone, {
    badge: string;
    dot: string;
    band: string;
    text: string;
}> = {
    neutral: {
        badge: 'border-border/70 bg-muted/60 text-muted-foreground',
        dot:   'bg-muted-foreground/50',
        band:  'bg-muted-foreground/30',
        text:  'text-muted-foreground',
    },
    review: {
        badge: 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-400',
        dot:   'bg-amber-500/80',
        band:  'bg-amber-500/70',
        text:  'text-amber-700 dark:text-amber-400',
    },
    ready: {
        badge: 'border-sky-500/20 bg-sky-500/8 text-sky-700 dark:text-sky-400',
        dot:   'bg-sky-500/80',
        band:  'bg-sky-500/70',
        text:  'text-sky-700 dark:text-sky-400',
    },
    done: {
        badge: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-400',
        dot:   'bg-emerald-500/80',
        band:  'bg-emerald-500/70',
        text:  'text-emerald-700 dark:text-emerald-400',
    },
    danger: {
        badge: 'border-destructive/25 bg-destructive/8 text-destructive',
        dot:   'bg-destructive/80',
        band:  'bg-destructive/70',
        text:  'text-destructive',
    },
};
