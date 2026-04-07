'use client';

import { cn } from '@/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AVAILABLE_MODELS, type AiModel } from './types';

interface ModelSelectorProps {
    selectedModelId: string;
    onModelChange: (modelId: string) => void;
    className?: string;
}

// Simple provider logo components
function OpenAILogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
        </svg>
    );
}

function AnthropicLogo({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.304 3.541h-3.483l6.15 16.918h3.483l-6.15-16.918zm-10.608 0l-6.15 16.918h3.483l1.26-3.564h6.395l1.26 3.564h3.483l-6.15-16.918h-3.581zm-.588 10.378l2.378-6.717 2.378 6.717h-4.756z" />
        </svg>
    );
}

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
    if (provider === 'Anthropic') return <AnthropicLogo className={className} />;
    return <OpenAILogo className={className} />;
}

// Group models by provider
function groupByProvider(models: AiModel[]) {
    const groups: Record<string, AiModel[]> = {};
    for (const model of models) {
        if (!groups[model.provider]) groups[model.provider] = [];
        groups[model.provider].push(model);
    }
    return groups;
}

export function ModelSelector({ selectedModelId, onModelChange, className }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedModel = AVAILABLE_MODELS.find((m) => m.id === selectedModelId) ?? AVAILABLE_MODELS[0];
    const grouped = groupByProvider(AVAILABLE_MODELS);

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
        <div ref={dropdownRef} className={cn('relative inline-flex', className)}>
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors',
                    isOpen && 'text-foreground',
                )}
            >
                <ProviderIcon provider={selectedModel.provider} className="size-4" />
                <span className="font-medium">{selectedModel.name}</span>
                <ChevronDown className={cn('size-3.5 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="border-border bg-popover absolute bottom-full left-0 z-50 mb-2 w-[260px] overflow-hidden rounded-xl border shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150">
                    {Object.entries(grouped).map(([provider, models], groupIdx) => (
                        <div key={provider}>
                            {groupIdx > 0 && <div className="border-border mx-3 border-t" />}
                            <div className="px-3 pb-1 pt-2.5">
                                <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                                    <ProviderIcon provider={provider} className="size-3" />
                                    {provider}
                                </div>
                            </div>
                            <div className="pb-1">
                                {models.map((model) => {
                                    const isSelected = model.id === selectedModelId;
                                    return (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => handleSelect(model)}
                                            className={cn(
                                                'hover:bg-muted/80 flex w-full items-center gap-3 rounded-lg mx-1 px-2.5 py-2 text-left transition-colors',
                                                'w-[calc(100%-8px)]',
                                                isSelected && 'bg-muted/60',
                                            )}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[13px] font-medium">{model.name}</div>
                                                {model.description && (
                                                    <div className="text-muted-foreground text-[11px] leading-tight">{model.description}</div>
                                                )}
                                            </div>
                                            {isSelected && <Check className="size-3.5 shrink-0 text-violet-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
