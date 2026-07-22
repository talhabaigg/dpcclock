import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type * as React from 'react';
import type { ReactNode } from 'react';

/**
 * Shared primitives for floating viewer toolbars (plan rail, takeoff bar,
 * annotation tool groups). Kept in their own module so the annotation module
 * and the page toolbars can both use them without circular imports.
 */

export function ToolGroup({ children, orientation = 'vertical' }: { children: ReactNode; orientation?: 'vertical' | 'horizontal' }) {
    return (
        <div
            className={cn(
                'bg-background/90 flex overflow-hidden rounded-md border shadow-sm backdrop-blur',
                orientation === 'vertical' ? 'flex-col divide-y' : 'flex-row divide-x',
            )}
        >
            {children}
        </div>
    );
}

/** Class string for a rail button — use on a plain `Button` when it must be a
 *  Base UI popover/menu trigger (`asChild` prop-merging needs the Button
 *  element directly; an intermediate wrapper component breaks it). */
export function toolButtonClass(active = false): string {
    return cn('h-8 w-8 rounded-none p-0', active && 'bg-primary text-primary-foreground');
}

export function ToolButton({
    title,
    onClick,
    disabled = false,
    active = false,
    children,
    className,
    ...rest
}: {
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    active?: boolean;
    children: ReactNode;
    className?: string;
} & Omit<React.ComponentProps<typeof Button>, 'title' | 'onClick' | 'disabled' | 'children' | 'className'>) {
    // Rest props are spread so this can be used as a Base UI popover/menu
    // trigger (`render` injects its handlers + ref into the element).
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'ghost'}
            size="sm"
            className={cn('h-8 w-8 rounded-none p-0', active && 'bg-primary text-primary-foreground', className)}
            title={title}
            onClick={onClick}
            disabled={disabled}
            {...rest}
        >
            {children}
        </Button>
    );
}
