import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { getDefaultLayout, GRID_COLS, WIDGET_REGISTRY, type LayoutItem } from './widget-registry';

export interface GridLayoutSettings {
    grid_layout?: LayoutItem[];
    hidden_widgets?: string[];
}

const STORAGE_KEY = 'dashboard-layout-settings';

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

function loadLayoutFromStorage(): GridLayoutSettings | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

function saveLayoutToStorage(settings: GridLayoutSettings): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
        // Silently fail if localStorage is not available
    }
}

export function useDashboardLayout(savedSettings: GridLayoutSettings | null) {
    const isFixedLayout = useIsFixedLayout();

    // Always prefer localStorage over location-specific settings
    const globalSettings = loadLayoutFromStorage();
    const settingsToUse = globalSettings || savedSettings;

    const [layouts, setLayouts] = useState<LayoutItem[]>(() => {
        if (settingsToUse?.grid_layout?.length) {
            // Validate saved layout has valid structure (allow items beyond GRID_ROWS during editing)
            const isValid = settingsToUse.grid_layout.every(
                (l) => l.i && typeof l.x === 'number' && typeof l.y === 'number' &&
                    l.x + l.w <= GRID_COLS,
            );
            if (isValid) {
                const savedIds = new Set(settingsToUse.grid_layout.map((l) => l.i));
                const defaults = getDefaultLayout();
                const newWidgets = defaults.filter((l) => !savedIds.has(l.i));
                return [
                    ...settingsToUse.grid_layout.map((l) => {
                        const def = WIDGET_REGISTRY.find((w) => w.id === l.i);
                        return { ...l, minW: def?.minW, minH: def?.minH };
                    }),
                    ...newWidgets,
                ];
            }
        }
        return getDefaultLayout();
    });

    const [hiddenWidgets, setHiddenWidgets] = useState<string[]>(settingsToUse?.hidden_widgets ?? []);
    const [isEditing, setIsEditing] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Disable editing on mobile/touch devices
    useEffect(() => {
        if (isFixedLayout && isEditing) {
            setIsEditing(false);
        }
    }, [isFixedLayout, isEditing]);

    const persistLayout = useCallback(
        (newLayouts: LayoutItem[], newHidden: string[]) => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            saveTimerRef.current = setTimeout(() => {
                const cleanLayouts = newLayouts.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
                saveLayoutToStorage({
                    grid_layout: cleanLayouts,
                    hidden_widgets: newHidden,
                });
            }, 800);
        },
        [],
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
        setIsEditing,
        onLayoutChange,
        toggleWidget,
        resetLayout,
        isFixedLayout,
    };
}
