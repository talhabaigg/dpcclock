'use client';

import { cn } from '@/lib/utils';
import { Brain, Check, ChevronLeft, ChevronRight, Paperclip, Plus, Sparkles, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AVAILABLE_MODELS,
    CHAT_MODES,
    DEFAULT_MODE_MODEL_MAP,
    type ChatMode,
} from './types';

const MODE_MAP_STORAGE_KEY = 'chat:mode-model-map';

function loadModeMap(): Record<ChatMode, string> {
    if (typeof window === 'undefined') return DEFAULT_MODE_MODEL_MAP;
    try {
        const raw = window.localStorage.getItem(MODE_MAP_STORAGE_KEY);
        if (!raw) return DEFAULT_MODE_MODEL_MAP;
        const parsed = JSON.parse(raw) as Partial<Record<ChatMode, string>>;
        return {
            instant: parsed.instant && AVAILABLE_MODELS.some((m) => m.id === parsed.instant) ? parsed.instant : DEFAULT_MODE_MODEL_MAP.instant,
            thinking: parsed.thinking && AVAILABLE_MODELS.some((m) => m.id === parsed.thinking) ? parsed.thinking : DEFAULT_MODE_MODEL_MAP.thinking,
            pro: parsed.pro && AVAILABLE_MODELS.some((m) => m.id === parsed.pro) ? parsed.pro : DEFAULT_MODE_MODEL_MAP.pro,
        };
    } catch {
        return DEFAULT_MODE_MODEL_MAP;
    }
}

const MODE_ICONS: Record<ChatMode, React.ComponentType<{ className?: string }>> = {
    instant: Zap,
    thinking: Brain,
    pro: Sparkles,
};

interface MobileActionsMenuProps {
    enableAttachments?: boolean;
    attachmentCount?: number;
    onAttachClick?: () => void;
    selectedModelId: string;
    onModelChange?: (modelId: string) => void;
    disabled?: boolean;
    triggerSizeClass?: string;
    iconSizeClass?: string;
}

export function MobileActionsMenu({
    enableAttachments = false,
    attachmentCount = 0,
    onAttachClick,
    selectedModelId,
    onModelChange,
    disabled = false,
    triggerSizeClass = 'size-8',
    iconSizeClass = 'size-4',
}: MobileActionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'main' | 'intelligence'>('main');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const [modeMap, setModeMap] = useState<Record<ChatMode, string>>(loadModeMap);

    useEffect(() => {
        if (isOpen) {
            setModeMap(loadModeMap());
        } else {
            // Reset to the main view whenever the menu closes
            setView('main');
        }
    }, [isOpen]);

    const activeMode = useMemo<ChatMode | null>(() => {
        const entry = (Object.entries(modeMap) as [ChatMode, string][]).find(([, id]) => id === selectedModelId);
        return entry ? entry[0] : null;
    }, [modeMap, selectedModelId]);

    const activeModeLabel = activeMode
        ? CHAT_MODES.find((m) => m.id === activeMode)?.label ?? 'Auto'
        : 'Auto';

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handlePickMode = useCallback(
        (mode: ChatMode) => {
            onModelChange?.(modeMap[mode]);
            setIsOpen(false);
        },
        [modeMap, onModelChange],
    );

    const handleAttach = useCallback(() => {
        onAttachClick?.();
        setIsOpen(false);
    }, [onAttachClick]);

    const showAttach = enableAttachments && !!onAttachClick;
    const showModes = !!onModelChange;
    const TriggerIcon = attachmentCount > 0 ? Paperclip : Plus;
    const ActiveModeIcon = activeMode ? MODE_ICONS[activeMode] : Sparkles;

    return (
        <div ref={wrapperRef} className="relative inline-flex">
            <button
                type="button"
                onClick={() => setIsOpen((o) => !o)}
                disabled={disabled}
                aria-label="More actions"
                className={cn(
                    'text-muted-foreground hover:text-foreground hover:bg-background/60 flex shrink-0 items-center justify-center rounded-full transition-colors',
                    triggerSizeClass,
                    isOpen && 'text-foreground bg-background/60',
                    disabled && 'cursor-not-allowed opacity-50',
                )}
            >
                <TriggerIcon className={iconSizeClass} />
            </button>

            {isOpen && (
                <div className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 z-50 mb-2 w-[240px] overflow-hidden rounded-2xl border shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {view === 'main' ? (
                        <div className="py-1.5">
                            {showAttach && (
                                <MenuRow
                                    icon={Paperclip}
                                    label="Add photos & files"
                                    onClick={handleAttach}
                                />
                            )}
                            {showModes && (
                                <MenuRow
                                    icon={ActiveModeIcon}
                                    label="Intelligence"
                                    trailing={
                                        <span className="text-muted-foreground flex items-center gap-1 text-[12px]">
                                            <span>{activeModeLabel}</span>
                                            <ChevronRight className="size-3.5" />
                                        </span>
                                    }
                                    onClick={() => setView('intelligence')}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="py-1.5">
                            <button
                                type="button"
                                onClick={() => setView('main')}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted/60 flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12px] font-medium transition-colors"
                            >
                                <ChevronLeft className="size-3.5" />
                                <span>Intelligence</span>
                            </button>
                            <div className="border-border/70 mx-3 border-t" />
                            <div className="pt-1">
                                {CHAT_MODES.map((mode) => {
                                    const Icon = MODE_ICONS[mode.id];
                                    const isActive = mode.id === activeMode;
                                    return (
                                        <MenuRow
                                            key={mode.id}
                                            icon={Icon}
                                            label={mode.label}
                                            description={mode.description}
                                            isActive={isActive}
                                            trailing={isActive ? <Check className="text-foreground size-4" /> : undefined}
                                            onClick={() => handlePickMode(mode.id)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function MenuRow({
    icon: Icon,
    label,
    description,
    isActive = false,
    trailing,
    onClick,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description?: string;
    isActive?: boolean;
    trailing?: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'hover:bg-muted/70 flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors',
                isActive && 'text-foreground font-medium',
            )}
        >
            <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')} />
            <span className="min-w-0 flex-1">
                <span className="block truncate">{label}</span>
                {description && (
                    <span className="text-muted-foreground block truncate text-[11px] font-normal">{description}</span>
                )}
            </span>
            {trailing && <span className="shrink-0">{trailing}</span>}
        </button>
    );
}

export default MobileActionsMenu;
