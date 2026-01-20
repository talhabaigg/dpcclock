'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowUp, Paperclip, Square, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface ChatInputProps {
    onSubmit: (message: string, attachments?: File[]) => void;
    onStop?: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    maxLength?: number;
    enableAttachments?: boolean;
    className?: string;
}

export interface ChatInputRef {
    focus: () => void;
    clear: () => void;
    setValue: (value: string) => void;
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
    },
    ref
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
        [handleSubmit, isLoading]
    );

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAttachments((prev) => [...prev, ...files]);
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
                <div className="mb-2 flex flex-wrap gap-2 px-2">
                    {attachments.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="bg-muted flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm"
                        >
                            <Paperclip className="text-muted-foreground size-3.5" />
                            <span className="max-w-[150px] truncate">{file.name}</span>
                            <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input container with rainbow glow */}
            <div className="relative">
                {/* Rainbow gradient border effect */}
                <div
                    className={cn(
                        'absolute -inset-[1px] rounded-3xl opacity-0 blur-sm transition-opacity duration-300',
                        isFocused && 'opacity-60'
                    )}
                    style={{
                        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)',
                        backgroundSize: '200% 100%',
                        animation: 'rainbow-shift 8s linear infinite',
                    }}
                />
            <div
                className={cn(
                    'relative flex items-center gap-3 rounded-3xl border border-border/50 bg-card px-4 py-3 shadow-sm transition-all duration-200',
                    isFocused && 'border-border shadow-md'
                )}
            >
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
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground hover:bg-muted size-9 shrink-0 rounded-full"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={disabled || isLoading}
                                >
                                    <Paperclip className="size-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Attach file</TooltipContent>
                        </Tooltip>
                    </>
                )}

                {/* Textarea - using plain textarea for cleaner look */}
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
                        'min-h-[24px] max-h-[200px] flex-1 resize-none bg-transparent text-base leading-relaxed outline-none',
                        'placeholder:text-muted-foreground/60',
                        'disabled:cursor-not-allowed disabled:opacity-50'
                    )}
                    rows={1}
                />

                {/* Submit/Stop button */}
                <div className="flex shrink-0 items-center">
                    {isLoading ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="outline"
                                    className="size-9 rounded-full"
                                    onClick={onStop}
                                >
                                    <Square className="size-4" fill="currentColor" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Stop generating</TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon"
                                    className={cn(
                                        'size-9 rounded-full transition-all',
                                        canSubmit
                                            ? 'bg-foreground text-background shadow-md hover:bg-foreground/90 hover:scale-105'
                                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                                    )}
                                    onClick={handleSubmit}
                                    disabled={!canSubmit}
                                >
                                    <ArrowUp className="size-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {canSubmit ? 'Send message' : 'Type a message'}
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
            </div>

            {/* Character count */}
            {value.length > maxLength * 0.8 && (
                <div className="text-muted-foreground mt-1 text-right text-xs">
                    {value.length.toLocaleString()} / {maxLength.toLocaleString()}
                </div>
            )}

            {/* CSS animation for rainbow effect */}
            <style>{`
                @keyframes rainbow-shift {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                }
            `}</style>
        </div>
    );
});

export default ChatInput;
