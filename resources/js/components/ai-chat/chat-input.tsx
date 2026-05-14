'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowUp, AudioLines, Mic, Paperclip, Plus, Square, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { chatService } from './chat-service';
import { MobileActionsMenu } from './mobile-actions-menu';
import { ModelSelector } from './model-selector';
import { DEFAULT_MODEL_ID } from './types';
import { VoiceWaveform } from './voice-waveform';

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
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
                if (audioBlob.size < 1000) return; // too short

                setIsTranscribing(true);
                try {
                    const text = await chatService.transcribeAudio(audioBlob);
                    if (text.trim()) {
                        onSubmit(text.trim());
                    }
                } catch {
                    // Transcription failed — silently ignore
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

    // Cleanup on unmount
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

    const canSubmit = value.trim().length > 0 && !disabled;

    return (
        <div className={cn('relative w-full', className)}>
            {/* Attachments preview */}
            {attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2 px-2">
                    {attachments.map((file, index) => (
                        <AttachmentChip key={`${file.name}-${index}`} file={file} onRemove={() => removeAttachment(index)} />
                    ))}
                </div>
            )}

            {/* Slim pill input */}
            <div
                className={cn(
                    'bg-muted/70 flex items-center gap-1 rounded-full pl-1.5 pr-1.5 py-1.5 transition-colors',
                    'border border-transparent',
                    isFocused && 'border-border bg-muted/90',
                )}
            >
                {/* Left: attachment / mobile actions */}
                {!isRecording && !isTranscribing && (
                    <>
                        {enableAttachments && (
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                                accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                            />
                        )}

                        {/* Mobile: combined + menu with Attach + Intelligence modes */}
                        {(enableAttachments || onModelChange) && (
                            <div className="sm:hidden">
                                <MobileActionsMenu
                                    enableAttachments={enableAttachments}
                                    attachmentCount={attachments.length}
                                    onAttachClick={enableAttachments ? () => fileInputRef.current?.click() : undefined}
                                    selectedModelId={selectedModelId}
                                    onModelChange={onModelChange}
                                    disabled={disabled || isLoading}
                                />
                            </div>
                        )}

                        {/* Desktop: dedicated + (attach) button */}
                        {enableAttachments && (
                            <div className="hidden sm:inline-flex">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground hover:bg-background/60 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={disabled || isLoading}
                                        >
                                            {attachments.length > 0 ? <Paperclip className="size-4" /> : <Plus className="size-4" />}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Attach file</TooltipContent>
                                </Tooltip>
                            </div>
                        )}
                    </>
                )}

                {/* Cancel recording button */}
                {isRecording && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
                                onClick={cancelRecording}
                            >
                                <X className="size-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel recording</TooltipContent>
                    </Tooltip>
                )}

                {/* Center: textarea / recording / transcribing */}
                <div className="flex min-w-0 flex-1 items-center px-1.5">
                    {isRecording ? (
                        <div className="flex min-h-[24px] w-full items-center gap-2.5">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                            </span>
                            <span className="text-foreground/80 shrink-0 text-sm font-medium">Recording</span>
                            <VoiceWaveform stream={audioStream} className="text-foreground/70" />
                            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{formatRecordingTime(recordingDuration)}</span>
                        </div>
                    ) : isTranscribing ? (
                        <div className="flex min-h-[24px] items-center gap-2.5">
                            <svg className="text-muted-foreground size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-muted-foreground text-sm">Transcribing voice note…</span>
                        </div>
                    ) : (
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
                                'max-h-[160px] min-h-[24px] w-full resize-none bg-transparent text-sm leading-6 outline-none',
                                'placeholder:text-muted-foreground/60',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                            )}
                            rows={1}
                        />
                    )}
                </div>

                {/* Right: model selector (desktop only) + mic + send/stop */}
                {!isRecording && !isTranscribing && onModelChange && (
                    <div className="hidden shrink-0 sm:block">
                        <ModelSelector selectedModelId={selectedModelId} onModelChange={onModelChange} />
                    </div>
                )}

                {!isLoading && !isTranscribing && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
                                    isRecording
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
                                )}
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={disabled}
                            >
                                <Mic className="size-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>{isRecording ? 'Send voice note' : 'Record voice note'}</TooltipContent>
                    </Tooltip>
                )}

                {isLoading ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="bg-foreground text-background hover:bg-foreground/90 flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
                                onClick={onStop}
                            >
                                <Square className="size-3.5" fill="currentColor" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Stop generating</TooltipContent>
                    </Tooltip>
                ) : !isRecording && !isTranscribing ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors',
                                    canSubmit
                                        ? 'bg-foreground text-background hover:bg-foreground/90'
                                        : 'bg-background text-muted-foreground hover:text-foreground',
                                )}
                                onClick={canSubmit ? handleSubmit : undefined}
                                disabled={!canSubmit && !value}
                                aria-label={canSubmit ? 'Send message' : 'Voice mode'}
                            >
                                {canSubmit ? <ArrowUp className="size-4" /> : <AudioLines className="size-4" />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>{canSubmit ? 'Send message' : 'Voice mode'}</TooltipContent>
                    </Tooltip>
                ) : null}
            </div>

            {/* Character count when nearing limit */}
            {value.length > maxLength * 0.8 && (
                <div className="text-muted-foreground mt-1 px-3 text-right text-xs">
                    {value.length.toLocaleString()} / {maxLength.toLocaleString()}
                </div>
            )}
        </div>
    );
});

export default ChatInput;
