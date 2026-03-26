'use client';

import { cn } from '@/lib/utils';
import { ChevronDown, Check, Zap, Sparkles, Cpu, BrainCircuit } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AVAILABLE_MODELS, type AiModel } from './types';

interface ModelSelectorProps {
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    className?: string;
    compact?: boolean;
}

const providerIcon = (provider: string) => {
    switch (provider) {
        case 'OpenAI':
            return Sparkles;
        case 'Anthropic':
            return BrainCircuit;
        default:
            return Cpu;
    }
};

export function ModelSelector({ selectedModelId, onModelChange, className, compact = false }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) ?? AVAILABLE_MODELS[0];

    // Close on outside click
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

    const handleSelect = useCallback(
        (model: AiModel) => {
            onModelChange(model.id);
            setIsOpen(false);
        },
        [onModelChange],
    );

    return (
        <div ref={dropdownRef} className={cn('relative', className)}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    isOpen && 'bg-muted/60 text-foreground',
                )}
            >
                <Zap className="size-3" />
                <span>{compact ? selectedModel.name : selectedModel.name}</span>
                <ChevronDown className={cn('size-3 transition-transform', isOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="border-border bg-popover text-popover-foreground absolute bottom-full left-0 z-50 mb-2 min-w-[220px] overflow-hidden rounded-xl border shadow-lg">
                    <div className="px-3 py-2">
                        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider">Model</p>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto py-1">
                        {AVAILABLE_MODELS.map((model) => {
                            const Icon = providerIcon(model.provider);
                            const isSelected = model.id === selectedModelId;
                            return (
                                <button
                                    key={model.id}
                                    type="button"
                                    onClick={() => handleSelect(model)}
                                    className={cn(
                                        'hover:bg-muted/80 flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                                        isSelected && 'bg-muted/50',
                                    )}
                                >
                                    <Icon className="text-muted-foreground size-4 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{model.name}</span>
                                        </div>
                                        {model.description && (
                                            <span className="text-muted-foreground text-xs">{model.description}</span>
                                        )}
                                    </div>
                                    {isSelected && <Check className="size-4 shrink-0 text-violet-500" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
