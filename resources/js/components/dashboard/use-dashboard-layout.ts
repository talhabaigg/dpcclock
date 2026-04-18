import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getDefaultLayout, GRID_COLS, WIDGET_REGISTRY, type LayoutItem } from './widget-registry';
import { useHttp } from '@inertiajs/react';

export interface ActiveLayout {
    id: number;
    name: string;
    grid_layout: LayoutItem[];
    hidden_widgets: string[];
}

const OLD_STORAGE_KEY = 'dashboard-layout-settings';

/**
 * Detects if the device is mobile/tablet or below md breakpoint (768px).
 * Custom layout only works on desktop md+ devices with mouse as primary input.
 * Uses CSS media query (pointer: coarse) to detect touch-primary devices.
 */
function useIsFixedLayout(): boolean {
    const [isFixedLayout, setIsFixedLayout] = useState(() => {
        // Initial check to avoid flash of wrong layout
        const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;
        const isBelowMd = window.innerWidth < 768;
        return isTouchPrimary || isBelowMd;
    });

    useEffect(() => {
        const checkLayout = () => {
            // Check if primary pointing device is coarse (touch) - identifies phones/tablets
            const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;
            const isBelowMd = window.innerWidth < 768;
            setIsFixedLayout(isTouchPrimary || isBelowMd);
        };

        checkLayout();
        window.addEventListener('resize', checkLayout);
        return () => window.removeEventListener('resize', checkLayout);
    }, []);

    return isFixedLayout;
}

export function useDashboardLayout(activeLayout: ActiveLayout | null, isAdmin: boolean) {
    const isFixedLayout = useIsFixedLayout();
    const persistHttp = useHttp({
        grid_layout: [] as Array<{ i: string; x: number; y: number; w: number; h: number }>,
        hidden_widgets: [] as string[],
    });

    const [layouts, setLayouts] = useState<LayoutItem[]>(() => {
        const source = activeLayout?.grid_layout;
        if (source?.length) {
            const isValid = source.every(
                (l) => l.i && typeof l.x === 'number' && typeof l.y === 'number' &&
                    l.x + l.w <= GRID_COLS,
            );
            if (isValid) {
                const savedIds = new Set(source.map((l) => l.i));
                const defaults = getDefaultLayout();
                const newWidgets = defaults.filter((l) => !savedIds.has(l.i));
                return [
                    ...source.map((l) => {
                        const def = WIDGET_REGISTRY.find((w) => w.id === l.i);
                        return { ...l, minW: def?.minW, minH: def?.minH };
                    }),
                    ...newWidgets,
                ];
            }
        }
        return getDefaultLayout();
    });

    const [hiddenWidgets, setHiddenWidgets] = useState<string[]>(activeLayout?.hidden_widgets ?? []);
    const [isEditing, setIsEditing] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const layoutIdRef = useRef<number | null>(activeLayout?.id ?? null);

    // Clean up old localStorage on mount (one-time migration)
    useEffect(() => {
        try { localStorage.removeItem(OLD_STORAGE_KEY); } catch { /* ignore */ }
    }, []);

    // Disable editing on mobile/touch devices or for non-admins
    useEffect(() => {
        if ((isFixedLayout || !isAdmin) && isEditing) {
            setIsEditing(false);
        }
    }, [isFixedLayout, isAdmin, isEditing]);

    const persistLayout = useCallback(
        (newLayouts: LayoutItem[], newHidden: string[]) => {
            if (!isAdmin || !layoutIdRef.current) return;

            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                const cleanLayouts = newLayouts.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
                persistHttp.setData({
                    grid_layout: cleanLayouts,
                    hidden_widgets: newHidden,
                });
                persistHttp.put(`/dashboard-layouts/${layoutIdRef.current}`, {
                    onError: () => {
                        toast.error('Failed to save layout.');
                    },
                });
            }, 800);
        },
        [isAdmin, persistHttp],
    );

    const onLayoutChange = useCallback(
        (newLayout: LayoutItem[]) => {
            setLayouts(newLayout);
            persistLayout(newLayout, hiddenWidgets);
        },
        [hiddenWidgets, persistLayout],
    );

    const toggleWidget = useCallback(
        (widgetId: string) => {
            setHiddenWidgets((prev) => {
                const next = prev.includes(widgetId) ? prev.filter((id) => id !== widgetId) : [...prev, widgetId];
                persistLayout(layouts, next);
                return next;
            });
        },
        [layouts, persistLayout],
    );

    const resetLayout = useCallback(() => {
        const defaults = getDefaultLayout();
        setLayouts(defaults);
        setHiddenWidgets([]);
        persistLayout(defaults, []);
        toast.success('Dashboard layout reset to default.');
    }, [persistLayout]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, []);

    return {
        layouts,
        setLayouts,
        hiddenWidgets,
        setHiddenWidgets,
        isEditing,
        setIsEditing: isAdmin ? setIsEditing : () => {},
        onLayoutChange,
        toggleWidget,
        resetLayout,
        isFixedLayout,
    };
}
