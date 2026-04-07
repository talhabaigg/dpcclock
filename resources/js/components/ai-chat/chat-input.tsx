'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowUp, Paperclip, Square, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ModelSelector } from './model-selector';
import { DEFAULT_MODEL_ID } from './types';

export interface ChatInputProps {
    onSubmit: (message: string, attachments?: File[]) => void;
    onStop?: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    maxLength?: number;
    enableAttachments?: boolean;
    className?: string;
    selectedModelId?: string;
    onModelChange?: (modelId: string) => void;
}

export interface ChatInputRef {
    focus: () => void;
    clear: () => void;
    setValue: (value: string) => void;
}

function AttachmentChip({ file, onRemove }: { file: File; onRemove: () => void }) {
    const isImage = file.type.startsWith('image/');
    const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    if (isImage && previewUrl) {
        return (
            <div className="group/att relative size-16 shrink-0 overflow-hidden rounded-lg">
                <img src={previewUrl} alt={file.name} className="size-full object-cover" />
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/att:opacity-100"
                >
                    <X className="size-3" />
                </button>
            </div>
        );
    }

    return (
        <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
            <Paperclip className="text-muted-foreground size-3.5" />
            <span className="max-w-[150px] truncate">{file.name}</span>
            <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
            </button>
        </div>
    );
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput(
    {
        onSubmit,
        onStop,
        isLoading = false,
        disabled = false,
        placeholder = 'Message Superior AI...',
        maxLength = 10000,
        enableAttachments = false,
        className,
        selectedModelId = DEFAULT_MODEL_ID,
        onModelChange,
    },
    ref,
) {
    const [value, setValue] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        focus: () => textareaRef.current?.focus(),
        clear: () => {
            setValue('');
            setAttachments([]);
        },
        setValue: (newValue: string) => setValue(newValue),
    }));

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
    }, [value]);

    const handleSubmit = useCallback(() => {
        if (!value.trim() || disabled) return;

        onSubmit(value.trim(), attachments.length > 0 ? attachments : undefined);
        setValue('');
        setAttachments([]);

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    }, [value, attachments, disabled, onSubmit]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!isLoading) {
                    handleSubmit();
                }
            }
        },
        [handleSubmit, isLoading],
    );

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        const files = Array.from(e.target.files || []).filter((f) => {
            if (f.size > MAX_FILE_SIZE) {
                alert(`File "${f.name}" exceeds the 10MB limit.`);
                return false;
            }
            return true;
        });
        setAttachments((prev) => [...prev, ...files].slice(0, 5));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, []);

    const removeAttachment = useCallback((index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const canSubmit = value.trim().length > 0 && !disabled;

    return (
        <div className={cn('relative w-full', className)}>
            {/* Attachments preview */}
            {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 px-1">
                    {attachments.map((file, index) => (
                        <AttachmentChip key={`${file.name}-${index}`} file={file} onRemove={() => removeAttachment(index)} />
                    ))}
                </div>
            )}

            {/* Gemini-style input container */}
            <div className="relative rounded-[28px] p-[2px]">
                {/* Animated conic gradient border */}
                <div
                    className={cn(
                        'gemini-border absolute inset-0 rounded-[28px] transition-opacity duration-500',
                        isFocused ? 'opacity-100' : 'opacity-0',
                    )}
                />
                {/* Soft glow */}
                <div
                    className={cn(
                        'gemini-border absolute inset-0 rounded-[28px] blur-md transition-opacity duration-500',
                        isFocused ? 'opacity-50' : 'opacity-0',
                    )}
                />

                {/* Inner card */}
                <div className={cn(
                    'relative rounded-[26px] transition-all duration-300',
                    'bg-card',
                    !isFocused && 'border border-border/80',
                    'shadow-sm',
                    isFocused && 'shadow-lg',
                )}>
                    {/* Textarea area */}
                    <div className="relative px-4 pt-3 pb-1.5">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            placeholder={placeholder}
                            disabled={disabled || isLoading}
                            className={cn(
                                'max-h-[200px] min-h-[24px] w-full resize-none bg-transparent text-base leading-relaxed outline-none',
                                'placeholder:text-muted-foreground/50',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                            )}
                            rows={1}
                        />
                    </div>

                    {/* Bottom toolbar */}
                    <div className="relative flex items-center justify-between px-3 pb-2.5">
                        <div className="flex items-center gap-1">
                            {/* Attachment button */}
                            {enableAttachments && (
                                <>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="hidden"
                                        onChange={handleFileSelect}
                                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                                    />
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-full transition-colors"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={disabled || isLoading}
                                            >
                                                <Paperclip className="size-[18px]" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Attach file</TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                        </div>

                        {/* Submit/Stop button */}
                        {isLoading ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="bg-foreground text-background flex size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/90"
                                        onClick={onStop}
                                    >
                                        <Square className="size-3.5" fill="currentColor" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Stop generating</TooltipContent>
                            </Tooltip>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex size-8 items-center justify-center rounded-full transition-all',
                                            canSubmit
                                                ? 'bg-foreground text-background hover:bg-foreground/90'
                                                : 'bg-muted-foreground/20 text-muted-foreground cursor-not-allowed',
                                        )}
                                        onClick={handleSubmit}
                                        disabled={!canSubmit}
                                    >
                                        <ArrowUp className="size-[18px]" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{canSubmit ? 'Send message' : 'Type a message'}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>

            {/* Model selector & character count */}
            <div className="mt-1.5 flex items-center justify-between px-1">
                <div>
                    {onModelChange && (
                        <ModelSelector
                            selectedModelId={selectedModelId}
                            onModelChange={onModelChange}
                        />
                    )}
                </div>
                {value.length > maxLength * 0.8 && (
                    <div className="text-muted-foreground text-right text-xs">
                        {value.length.toLocaleString()} / {maxLength.toLocaleString()}
                    </div>
                )}
            </div>

            {/* Gemini gradient animation */}
            <style>{`
                @property --gemini-angle {
                    syntax: '<angle>';
                    initial-value: 0deg;
                    inherits: false;
                }
                @keyframes gemini-spin {
                    to { --gemini-angle: 360deg; }
                }
                .gemini-border {
                    background: conic-gradient(
                        from var(--gemini-angle),
                        #4285f4, #9b72cb, #d96570,
                        #d96570, #9b72cb, #4285f4
                    );
                    animation: gemini-spin 3s linear infinite;
                }
            `}</style>
        </div>
    );
});

export default ChatInput;
