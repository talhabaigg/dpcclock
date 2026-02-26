import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getDefaultLayout, GRID_COLS, GRID_ROWS, WIDGET_REGISTRY, type LayoutItem } from './widget-registry';

export interface GridLayoutSettings {
    grid_layout?: LayoutItem[];
    hidden_widgets?: string[];
}

export function useDashboardLayout(locationId: number, savedSettings: GridLayoutSettings | null) {
    const [layouts, setLayouts] = useState<LayoutItem[]>(() => {
        if (savedSettings?.grid_layout?.length) {
            // Validate saved layout has valid structure (allow items beyond GRID_ROWS during editing)
            const isValid = savedSettings.grid_layout.every(
                (l) => l.i && typeof l.x === 'number' && typeof l.y === 'number' &&
                    l.x + l.w <= GRID_COLS,
            );
            if (isValid) {
                const savedIds = new Set(savedSettings.grid_layout.map((l) => l.i));
                const defaults = getDefaultLayout();
                const newWidgets = defaults.filter((l) => !savedIds.has(l.i));
                return [
                    ...savedSettings.grid_layout.map((l) => {
                        const def = WIDGET_REGISTRY.find((w) => w.id === l.i);
                        return { ...l, minW: def?.minW, minH: def?.minH };
                    }),
                    ...newWidgets,
                ];
            }
        }
        return getDefaultLayout();
    });

    const [hiddenWidgets, setHiddenWidgets] = useState<string[]>(savedSettings?.hidden_widgets ?? []);
    const [isEditing, setIsEditing] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistLayout = useCallback(
        (newLayouts: LayoutItem[], newHidden: string[]) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(async () => {
                try {
                    const cleanLayouts = newLayouts.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
                    await api.put(`/locations/${locationId}/dashboard-settings`, {
                        grid_layout: cleanLayouts,
                        hidden_widgets: newHidden,
                    });
                } catch {
                    toast.error('Failed to save dashboard layout.');
                }
            }, 800);
        },
        [locationId],
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
        hiddenWidgets,
        isEditing,
        setIsEditing,
        onLayoutChange,
        toggleWidget,
        resetLayout,
    };
}
