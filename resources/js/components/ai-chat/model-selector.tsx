'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AVAILABLE_MODELS,
    CHAT_MODES,
    DEFAULT_MODE_MODEL_MAP,
    type AiModel,
    type ChatMode,
} from './types';

interface ModelSelectorProps {
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    className?: string;
}

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

function saveModeMap(map: Record<ChatMode, string>) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(MODE_MAP_STORAGE_KEY, JSON.stringify(map));
    } catch {
        // localStorage disabled — silently ignore
    }
}

export function ModelSelector({ selectedModelId, onModelChange, className }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [configureOpen, setConfigureOpen] = useState(false);
    const [modeMap, setModeMap] = useState<Record<ChatMode, string>>(loadModeMap);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Derive the currently active mode from the selected model id.
    const activeMode = useMemo<ChatMode | null>(() => {
        const entry = (Object.entries(modeMap) as [ChatMode, string][]).find(([, modelId]) => modelId === selectedModelId);
        return entry ? entry[0] : null;
    }, [modeMap, selectedModelId]);

    // Trigger label: the active mode, or the underlying model name if user manually picked something off-map.
    const triggerLabel = activeMode
        ? CHAT_MODES.find((m) => m.id === activeMode)?.label ?? 'Instant'
        : AVAILABLE_MODELS.find((m) => m.id === selectedModelId)?.name ?? 'Model';

    // Close popover on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
            onModelChange(modeMap[mode]);
            setIsOpen(false);
        },
        [modeMap, onModelChange],
    );

    const handleRemap = useCallback(
        (mode: ChatMode, modelId: string) => {
            setModeMap((prev) => {
                const next = { ...prev, [mode]: modelId };
                saveModeMap(next);
                return next;
            });
            // If the user is currently on this mode, update the actively-used model immediately.
            if (activeMode === mode) {
                onModelChange(modelId);
            }
        },
        [activeMode, onModelChange],
    );

    return (
        <>
            <div ref={dropdownRef} className={cn('relative inline-flex', className)}>
                <button
                    type="button"
                    onClick={() => setIsOpen((o) => !o)}
                    className={cn(
                        'text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm transition-colors',
                        isOpen && 'text-foreground',
                    )}
                >
                    <span className="font-medium">{triggerLabel}</span>
                    <ChevronDown className={cn('size-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
                </button>

                {isOpen && (
                    <div className="border-border bg-popover absolute bottom-full right-0 z-50 mb-2 w-[200px] overflow-hidden rounded-xl border shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <ModeList
                            activeMode={activeMode}
                            onPick={handlePickMode}
                            onConfigure={() => {
                                setIsOpen(false);
                                setConfigureOpen(true);
                            }}
                        />
                    </div>
                )}
            </div>

            <Dialog open={configureOpen} onOpenChange={setConfigureOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Intelligence</DialogTitle>
                    </DialogHeader>
                    <div className="text-muted-foreground -mt-1 mb-3 text-xs">
                        Map each mode to the model it should call.
                    </div>
                    <div className="border-border border-t" />
                    {CHAT_MODES.map((mode, i) => (
                        <div key={mode.id}>
                            <ModelRow
                                label={mode.label}
                                description={mode.description}
                                modelId={modeMap[mode.id]}
                                isActive={activeMode === mode.id}
                                onChange={(id) => handleRemap(mode.id, id)}
                            />
                            {i < CHAT_MODES.length - 1 && <div className="border-border/60 border-t" />}
                        </div>
                    ))}
                </DialogContent>
            </Dialog>
        </>
    );
}

function ModeList({
    activeMode,
    onPick,
    onConfigure,
}: {
    activeMode: ChatMode | null;
    onPick: (mode: ChatMode) => void;
    onConfigure: () => void;
}) {
    return (
        <>
            <div className="text-muted-foreground px-3 pb-1 pt-2.5 text-[11px]">
                Latest <span className="opacity-60">·</span> {LATEST_FAMILY_LABEL}
            </div>
            <div className="p-1">
                {CHAT_MODES.map((mode) => {
                    const isActive = mode.id === activeMode;
                    return (
                        <button
                            key={mode.id}
                            type="button"
                            onClick={() => onPick(mode.id)}
                            className={cn(
                                'hover:bg-muted/80 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                                isActive && 'bg-muted/60 font-medium',
                            )}
                        >
                            <span>{mode.label}</span>
                            {isActive && <Check className="size-3.5 shrink-0 text-foreground" />}
                        </button>
                    );
                })}
            </div>
            <div className="border-border border-t p-1">
                <button
                    type="button"
                    onClick={onConfigure}
                    className="text-muted-foreground hover:bg-muted/80 hover:text-foreground w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors"
                >
                    Configure&hellip;
                </button>
            </div>
        </>
    );
}

// Derive the latest family label (e.g. "5.5") from the highest GPT version in AVAILABLE_MODELS.
const LATEST_FAMILY_LABEL = (() => {
    const versions = AVAILABLE_MODELS
        .map((m) => m.name.match(/(\d+(?:\.\d+)?)/)?.[1])
        .filter((v): v is string => !!v)
        .map((v) => parseFloat(v));
    if (!versions.length) return '';
    const max = Math.max(...versions);
    return max.toString();
})();

function ModelRow({
    label,
    description,
    modelId,
    isActive,
    onChange,
}: {
    label: string;
    description: string;
    modelId: string;
    isActive: boolean;
    onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) {
            document.addEventListener('mousedown', onClickOutside);
            return () => document.removeEventListener('mousedown', onClickOutside);
        }
    }, [open]);

    const current = AVAILABLE_MODELS.find((m) => m.id === modelId);

    return (
        <div ref={ref} className="relative flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                    {label}
                    {isActive && <Check className="size-3.5 shrink-0 text-foreground" />}
                </div>
                <div className="text-muted-foreground text-xs">{description}</div>
            </div>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/80 flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors"
            >
                <span className="max-w-[140px] truncate font-medium">{current?.name ?? 'Choose…'}</span>
                <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="border-border bg-popover absolute right-0 top-full z-10 mt-1 w-[220px] overflow-hidden rounded-lg border shadow-lg">
                    <div className="max-h-[260px] overflow-y-auto p-1">
                        {groupByProvider(AVAILABLE_MODELS).map(([provider, models], i) => (
                            <div key={provider}>
                                {i > 0 && <div className="border-border my-1 border-t" />}
                                <div className="text-muted-foreground px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider">
                                    {provider}
                                </div>
                                {models.map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                            onChange(m.id);
                                            setOpen(false);
                                        }}
                                        className={cn(
                                            'hover:bg-muted/80 flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                                            m.id === modelId && 'bg-muted/60',
                                        )}
                                    >
                                        <span className="truncate">{m.name}</span>
                                        {m.id === modelId && <Check className="size-3 shrink-0 text-foreground" />}
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function groupByProvider(models: AiModel[]): [string, AiModel[]][] {
    const groups: Record<string, AiModel[]> = {};
    for (const m of models) {
        if (!groups[m.provider]) groups[m.provider] = [];
        groups[m.provider].push(m);
    }
    return Object.entries(groups);
}
