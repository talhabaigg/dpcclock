'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { ArrowRight, ArrowUp, AudioLines, Mic, Paperclip, Plus, X } from 'lucide-react';
import { SuperiorMark } from './superior-mark';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatService } from './chat-service';
import { ModelSelector } from './model-selector';
import { DEFAULT_MODEL_ID } from './types';
import type { SuggestedPrompt } from './types';
import { VoiceWaveform } from './voice-waveform';

interface ChatWelcomeProps {
    title?: string;
    subtitle?: string;
    suggestedPrompts?: SuggestedPrompt[];
    onPromptClick?: (prompt: string) => void;
    className?: string;
    /** Centered mode with large input box (Copilot/Gemini style) */
    centered?: boolean;
    /** Placeholder for the input */
    placeholder?: string;
    /** Called when user submits a message */
    onSubmit?: (message: string, attachments?: File[]) => void;
    /** Whether the chat is loading */
    isLoading?: boolean;
    /** Called when user clicks the voice call button */
    onVoiceCall?: () => void;
    /** Currently selected model ID */
    selectedModelId?: string;
    /** Called when user changes the model */
    onModelChange?: (modelId: string) => void;
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

// Animated text component for typing effect.
// Fetches a fresh AI-generated greeting on every mount, then types it out.
function AnimatedGreeting({ userName }: { userName?: string }) {
    const fallback = userName ? `What can I help with, ${userName}?` : 'What can I help with?';
    const [greeting, setGreeting] = useState<string | null>(null);
    const [displayedGreeting, setDisplayedGreeting] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    // Fetch a fresh AI greeting on every mount (every home-page visit).
    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        chatService
            .getWelcomeMessage(controller.signal)
            .then((text) => {
                if (cancelled) return;
                const trimmed = text?.trim();
                setGreeting(trimmed && trimmed.length > 0 ? trimmed : fallback);
            })
            .catch((err) => {
                if (cancelled || (err instanceof Error && err.name === 'AbortError')) return;
                setGreeting(fallback);
            });

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [fallback]);

    // Type-out animation, runs once the greeting resolves.
    useEffect(() => {
        if (!greeting) return;

        setDisplayedGreeting('');
        setIsComplete(false);
        let i = 0;

        const interval = setInterval(() => {
            if (i < greeting.length) {
                setDisplayedGreeting(greeting.slice(0, i + 1));
                i++;
            } else {
                clearInterval(interval);
                setIsComplete(true);
            }
        }, 40);

        return () => clearInterval(interval);
    }, [greeting]);

    return (
        <div className="mb-6 w-full max-w-3xl">
            <h1 className="text-center text-xl font-medium tracking-tight md:text-2xl">
                <span className="text-foreground">
                    {displayedGreeting}
                    {!isComplete && <span className="text-muted-foreground animate-pulse">|</span>}
                </span>
            </h1>
        </div>
    );
}

export function ChatWelcome({
    title = 'Superior AI',
    subtitle = 'How can I help you today?',
    suggestedPrompts = [],
    onPromptClick,
    className,
    centered = false,
    placeholder = 'Ask anything...',
    onSubmit,
    isLoading = false,
    onVoiceCall,
    selectedModelId = DEFAULT_MODEL_ID,
    onModelChange,
}: ChatWelcomeProps) {
    const [inputValue, setInputValue] = useState('');
    const [attachments, setAttachments] = useState<File[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Get user name from Inertia props
    const { auth } = usePage<{ auth: { user?: { name?: string } } }>().props;
    const userName = auth?.user?.name?.split(' ')[0]; // Get first name

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
    }, [inputValue]);

    const handleSubmit = useCallback(() => {
        if (!inputValue.trim() || isLoading) return;
        onSubmit?.(inputValue.trim(), attachments.length > 0 ? attachments : undefined);
        setInputValue('');
        setAttachments([]);
    }, [inputValue, attachments, isLoading, onSubmit]);

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

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            audioChunksRef.current = [];
            mediaRecorderRef.current = mediaRecorder;
            setAudioStream(stream);

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((t) => t.stop());
                setAudioStream(null);
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                    recordingTimerRef.current = null;
                }
                setRecordingDuration(0);

                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size < 1000) return;

                setIsTranscribing(true);
                try {
                    const text = await chatService.transcribeAudio(audioBlob);
                    if (text.trim()) {
                        onSubmit?.(text.trim());
                    }
                } catch {
                    // Transcription failed
                } finally {
                    setIsTranscribing(false);
                }
            };

            mediaRecorder.start(250);
            setIsRecording(true);
            setRecordingDuration(0);
            recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
        } catch {
            // Microphone access denied
        }
    }, [onSubmit]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    }, []);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.ondataavailable = null;
            mediaRecorderRef.current.onstop = () => {
                mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
            };
            mediaRecorderRef.current.stop();
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setIsRecording(false);
        setRecordingDuration(0);
        setAudioStream(null);
        audioChunksRef.current = [];
    }, []);

    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
                mediaRecorderRef.current.stop();
            }
        };
    }, []);

    const formatRecordingTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const canSubmit = inputValue.trim().length > 0 && !isLoading;

    if (centered) {
        return (
            <div className={cn('flex h-full flex-col items-center justify-center px-4', className)}>
                {/* Animated greeting */}
                <AnimatedGreeting userName={userName} />

                {/* Slim pill input */}
                <div className="w-full max-w-3xl">
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                    />

                    {/* Attachments preview (above pill) */}
                    {attachments.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-2 px-2">
                            {attachments.map((file, index) => (
                                <AttachmentChip key={`${file.name}-${index}`} file={file} onRemove={() => removeAttachment(index)} />
                            ))}
                        </div>
                    )}

                    <div
                        className={cn(
                            'bg-muted/70 flex items-center gap-1.5 rounded-full pl-3 pr-3 py-3 transition-colors',
                            'border border-transparent',
                            isFocused && 'border-border bg-muted/90',
                        )}
                    >
                        {/* Left: attach button */}
                        {!isRecording && !isTranscribing && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-foreground hover:bg-background/60 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isLoading}
                                    >
                                        {attachments.length > 0 ? <Paperclip className="size-5" /> : <Plus className="size-5" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Attach file</TooltipContent>
                            </Tooltip>
                        )}

                        {/* Cancel recording */}
                        {isRecording && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-10 shrink-0 items-center justify-center rounded-full transition-colors"
                                        onClick={cancelRecording}
                                    >
                                        <X className="size-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>Cancel recording</TooltipContent>
                            </Tooltip>
                        )}

                        {/* Center: textarea / recording / transcribing */}
                        <div className="flex min-w-0 flex-1 items-center px-3">
                            {isRecording ? (
                                <div className="flex min-h-[28px] w-full items-center gap-2.5">
                                    <span className="relative flex size-2 shrink-0">
                                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                                        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                                    </span>
                                    <span className="text-foreground/80 shrink-0 text-sm font-medium">Recording</span>
                                    <VoiceWaveform stream={audioStream} className="text-foreground/70" />
                                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatRecordingTime(recordingDuration)}</span>
                                </div>
                            ) : isTranscribing ? (
                                <div className="flex min-h-[28px] items-center gap-2.5">
                                    <svg className="text-muted-foreground size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    <span className="text-muted-foreground text-sm">Transcribing voice note…</span>
                                </div>
                            ) : (
                                <textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder={placeholder}
                                    disabled={isLoading}
                                    className={cn(
                                        'max-h-[200px] min-h-[28px] w-full resize-none bg-transparent text-base leading-7 outline-none',
                                        'placeholder:text-muted-foreground/60',
                                        'disabled:cursor-not-allowed disabled:opacity-50',
                                    )}
                                    rows={1}
                                />
                            )}
                        </div>

                        {/* Right: model selector + voice-call + mic + send */}
                        {!isRecording && !isTranscribing && onModelChange && (
                            <div className="shrink-0">
                                <ModelSelector selectedModelId={selectedModelId} onModelChange={onModelChange} />
                            </div>
                        )}

                        {!isLoading && !isTranscribing && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
                                            isRecording
                                                ? 'bg-red-500 text-white hover:bg-red-600'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                                        )}
                                        onClick={isRecording ? stopRecording : startRecording}
                                    >
                                        <Mic className="size-5" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{isRecording ? 'Send voice note' : 'Record voice note'}</TooltipContent>
                            </Tooltip>
                        )}

                        {!isRecording && !isTranscribing && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            'flex size-10 shrink-0 items-center justify-center rounded-full transition-colors',
                                            canSubmit
                                                ? 'bg-foreground text-background hover:bg-foreground/90'
                                                : onVoiceCall
                                                  ? 'bg-background text-muted-foreground hover:text-foreground'
                                                  : 'bg-muted-foreground/20 text-muted-foreground cursor-not-allowed',
                                        )}
                                        onClick={canSubmit ? handleSubmit : onVoiceCall}
                                        disabled={!canSubmit && !onVoiceCall}
                                        aria-label={canSubmit ? 'Send message' : 'Voice mode'}
                                    >
                                        {canSubmit ? <ArrowUp className="size-5" /> : <AudioLines className="size-5" />}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>{canSubmit ? 'Send message' : 'Voice mode'}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Original compact welcome (for dock mode)
    return (
        <div className={cn('flex flex-col items-center justify-center px-4 py-8', className)}>
            {/* Logo/Icon */}
            <div className="border-border bg-background mb-6 flex size-16 items-center justify-center rounded-2xl border">
                <SuperiorMark className="text-foreground size-8" />
            </div>

            {/* Title */}
            <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">{title}</h2>

            {/* Subtitle */}
            <p className="text-muted-foreground mb-8 max-w-sm text-center text-sm">{subtitle}</p>

            {/* Suggested prompts */}
            {suggestedPrompts.length > 0 && (
                <div className="flex w-full max-w-md flex-col gap-2">
                    {suggestedPrompts.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <Button
                                key={index}
                                variant="outline"
                                className="group h-auto justify-start gap-3 px-4 py-3 text-left"
                                onClick={() => onPromptClick?.(item.prompt)}
                            >
                                {Icon && (
                                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                                        <Icon className="text-muted-foreground size-4" />
                                    </div>
                                )}
                                <span className="flex-1 text-sm">{item.label}</span>
                                <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ChatWelcome;
