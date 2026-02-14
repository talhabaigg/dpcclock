import { useEffect } from 'react';

export type ShortcutDefinition = {
    key: string;
    handler: () => void;
    ctrl?: boolean;
    shift?: boolean;
    enabled?: boolean;
};

function isInputFocused(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (isInputFocused()) return;

            for (const shortcut of shortcuts) {
                if (shortcut.enabled === false) continue;

                const wantsCtrl = shortcut.ctrl ?? false;
                const wantsShift = shortcut.shift ?? false;

                if (e.ctrlKey !== wantsCtrl || e.metaKey !== false && wantsCtrl) {
                    // Allow Cmd on Mac as Ctrl equivalent
                    if (!(e.metaKey && wantsCtrl && !e.ctrlKey)) {
                        if (e.ctrlKey !== wantsCtrl) continue;
                    }
                }
                if (e.shiftKey !== wantsShift) continue;
                if (e.key.toLowerCase() !== shortcut.key.toLowerCase()) continue;

                e.preventDefault();
                shortcut.handler();
                return;
            }
        }

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shortcuts]);
}
