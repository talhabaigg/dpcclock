'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SuperiorMark } from './superior-mark';
import { useVoiceCall, VoiceCallStatus, TranscriptEntry } from './use-voice-call';

interface VoiceCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
    /** Active chat conversation id (for merging voice transcripts back into the same thread). */
    conversationId?: string | null;
    /** Called once the call has fully ended, with the transcripts captured during the call. */
    onTranscriptsReady?: (
        entries: Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>,
    ) => void;
}

const VOICE_OPTIONS = [
    { id: 'ash', label: 'Ash' },
    { id: 'ballad', label: 'Ballad' },
    { id: 'coral', label: 'Coral' },
    { id: 'echo', label: 'Echo' },
    { id: 'sage', label: 'Sage' },
    { id: 'shimmer', label: 'Shimmer' },
    { id: 'verse', label: 'Verse' },
] as const;

const statusMessages: Record<VoiceCallStatus, string> = {
    idle: 'Ready to connect',
    connecting: 'Connecting...',
    connected: 'Connected',
    listening: 'Listening...',
    speaking: "You're speaking",
    processing: 'Thinking...',
    error: 'Connection failed',
    disconnected: 'Call ended',
};

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// Animated sound wave bars component — uses real audio levels when available
function SoundWave({
    isActive,
    variant,
    audioLevels,
}: {
    isActive: boolean;
    variant: 'listening' | 'speaking' | 'processing';
    audioLevels?: number[];
}) {
    const barCount = 5;
    const hasRealLevels = audioLevels && audioLevels.some((l) => l > 0.02);

    return (
        <div className="flex h-12 items-center justify-center gap-1">
            {Array.from({ length: barCount }).map((_, i) => {
                // Use real audio data when AI is speaking with levels, otherwise CSS animation
                const useRealData = isActive && hasRealLevels;
                const level = audioLevels?.[i] ?? 0;
                const barHeight = useRealData
                    ? `${Math.max(15, level * 100)}%`
                    : isActive
                      ? '100%'
                      : '8px';

                return (
                    <div
                        key={i}
                        className={cn(
                            'w-1 rounded-full',
                            isActive
                                ? variant === 'speaking'
                                    ? 'bg-foreground'
                                    : 'bg-foreground/70'
                                : 'bg-muted-foreground/30',
                            isActive && !useRealData && 'voice-wave-bar',
                            useRealData ? 'transition-[height] duration-75' : 'transition-all duration-300',
                        )}
                        style={{
                            height: barHeight,
                            animationDelay: !useRealData ? `${i * 0.1}s` : undefined,
                        }}
                    />
                );
            })}
        </div>
    );
}

// Floating orb with smooth animations
function VoiceOrb({ status, audioLevels }: { status: VoiceCallStatus; audioLevels?: number[] }) {
    const isListening = status === 'listening';
    const isSpeaking = status === 'speaking';
    const isProcessing = status === 'processing';
    const isConnecting = status === 'connecting';
    const isActive = isListening || isSpeaking || isProcessing;

    return (
        <div className="relative flex size-44 items-center justify-center">
            {/* Outer glow ring — soft breathing fade */}
            <div
                className={cn(
                    'text-foreground/[0.10] pointer-events-none absolute rounded-full transition-all duration-1000 ease-in-out',
                    isActive && 'voice-glow-outer',
                )}
                style={{
                    width: 160,
                    height: 160,
                    background: 'radial-gradient(circle, currentColor 0%, transparent 70%)',
                }}
            />

            {/* Middle ring */}
            <div
                className={cn(
                    'text-foreground/[0.16] pointer-events-none absolute rounded-full transition-all duration-700 ease-in-out',
                    isActive && 'voice-glow-middle',
                )}
                style={{
                    width: 124,
                    height: 124,
                    background: 'radial-gradient(circle, currentColor 0%, transparent 70%)',
                }}
            />

            {/* Main orb */}
            <div
                className={cn(
                    'relative flex size-24 items-center justify-center rounded-full shadow-lg transition-all duration-500',
                    'border-border border',
                    status === 'idle' && 'bg-muted',
                    isConnecting && 'voice-orb-connecting bg-muted',
                    isListening && 'bg-muted',
                    isSpeaking && 'bg-foreground/10',
                    isProcessing && 'bg-muted',
                    status === 'error' && 'border-destructive/40 bg-destructive/10',
                    status === 'disconnected' && 'bg-muted',
                )}
            >
                {/* Inner subtle glow when active */}
                <div
                    className={cn(
                        'absolute inset-2 rounded-full opacity-50 blur-md transition-all duration-500',
                        isActive ? 'bg-foreground/15' : 'bg-transparent',
                    )}
                />

                {/* Content */}
                <div className="relative z-10">
                    {isProcessing ? (
                        <div className="flex items-center justify-center">
                            <SuperiorMark className="voice-sparkle text-foreground size-8" />
                        </div>
                    ) : (
                        <SoundWave isActive={isListening || isSpeaking} variant={isSpeaking ? 'speaking' : 'listening'} audioLevels={audioLevels} />
                    )}
                </div>
            </div>
        </div>
    );
}

// Transcript history list
function TranscriptHistory({ entries }: { entries: TranscriptEntry[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [entries]);

    if (entries.length === 0) return null;

    return (
        <ScrollArea ref={scrollRef} className="h-full w-full">
            <div className="space-y-2 px-1">
                {entries.map((entry, i) => (
                    <div
                        key={i}
                        className={cn(
                            'rounded-lg px-3 py-2 text-sm',
                            entry.role === 'user' ? 'bg-muted/60' : 'border-border bg-muted/30 border',
                        )}
                    >
                        <p className="text-muted-foreground mb-0.5 text-[10px] font-medium tracking-wider uppercase">
                            {entry.role === 'user' ? 'You' : 'AI'}
                        </p>
                        <p className="leading-relaxed">{entry.text}</p>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

const VOICE_STORAGE_KEY = 'voice-call:selected-voice';

export function VoiceCallModal({ isOpen, onClose, className, onTranscriptsReady }: VoiceCallModalProps) {
    const [selectedVoice, setSelectedVoice] = useState<string>(() => {
        if (typeof window === 'undefined') return 'ash';
        return localStorage.getItem(VOICE_STORAGE_KEY) ?? 'ash';
    });

    // Persist voice choice across calls so user only picks it once
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(VOICE_STORAGE_KEY, selectedVoice);
        }
    }, [selectedVoice]);

    const { status, isConnected, isMuted, aiResponse, transcriptHistory, callDuration, audioLevels, startCall, endCall, toggleMute } = useVoiceCall({
        voice: selectedVoice,
        onError: () => {
        },
    });

    const isPreCall = status === 'idle' || status === 'disconnected' || status === 'error';

    // Clean up on close — hand transcripts to parent so it can merge them into the chat thread.
    // Only persist if the user actually said something; a solo AI greeting isn't worth saving.
    const handleClose = useCallback(() => {
        const hasUserSpeech = transcriptHistory.some((e) => e.role === 'user');
        if (hasUserSpeech) {
            onTranscriptsReady?.(transcriptHistory);
        }
        endCall();
        onClose();
    }, [endCall, onClose, onTranscriptsReady, transcriptHistory]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                handleClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop — matches shadcn Dialog overlay */}
            <div
                className="bg-background/80 absolute inset-0 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Dialog content */}
            <div
                className={cn(
                    'border-border bg-background relative z-10 flex max-h-[90vh] w-full max-w-md flex-col items-center rounded-lg border p-6 shadow-lg',
                    className,
                )}
                role="dialog"
                aria-modal="true"
                aria-label="Voice call with Superior AI"
            >
                {/* Header */}
                <div className="mb-1 flex shrink-0 items-center gap-2">
                    <SuperiorMark className="text-foreground size-5" />
                    <h2 className="text-lg font-semibold">Superior AI</h2>
                </div>

                {/* Call timer */}
                {isConnected && (
                    <p className="text-muted-foreground mb-1 shrink-0 font-mono text-xs">{formatDuration(callDuration)}</p>
                )}

                {/* Status */}
                <p
                    className={cn(
                        'mb-4 shrink-0 text-sm font-medium transition-colors duration-300',
                        status === 'error' ? 'text-destructive' : 'text-muted-foreground',
                    )}
                >
                    {statusMessages[status]}
                </p>

                {/* Animated orb */}
                <div className="mb-4 shrink-0">
                    <VoiceOrb status={status} audioLevels={audioLevels} />
                </div>

                {/* Live AI response (current turn) */}
                {aiResponse && (
                    <div className="border-border bg-muted/40 mb-3 w-full shrink-0 rounded-lg border px-4 py-3">
                        <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase">Speaking</p>
                        <p className="text-sm leading-relaxed">{aiResponse}</p>
                    </div>
                )}

                {/* Transcript history — scrollable, takes remaining space */}
                <div className="mb-4 min-h-0 w-full flex-1 overflow-hidden">
                    <TranscriptHistory entries={transcriptHistory} />
                </div>

                {/* Controls */}
                <div className="flex shrink-0 items-center gap-3">
                    {isPreCall ? (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                Cancel
                            </Button>
                            <Button onClick={startCall} className="gap-2">
                                <Phone className="size-4" />
                                Start call
                            </Button>
                        </>
                    ) : (
                        <>
                            {/* Mute button */}
                            <Button
                                variant={isMuted ? 'destructive' : 'outline'}
                                size="icon"
                                className="size-12 rounded-full"
                                onClick={toggleMute}
                                disabled={!isConnected}
                                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                            >
                                {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                            </Button>

                            {/* End call button */}
                            <Button
                                variant="destructive"
                                size="icon"
                                className="size-12 rounded-full"
                                onClick={handleClose}
                                aria-label="End call"
                            >
                                <PhoneOff className="size-5" />
                            </Button>
                        </>
                    )}
                </div>

                {/* Voice selector + help */}
                <div className="mt-6 flex w-full shrink-0 items-center justify-between">
                    <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={!isPreCall}>
                        <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue placeholder="Voice" />
                        </SelectTrigger>
                        <SelectContent>
                            {VOICE_OPTIONS.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <p className="text-muted-foreground/70 text-xs">
                        Press <kbd className="bg-muted/80 rounded-md px-1.5 py-0.5 font-mono text-[10px]">ESC</kbd> to end
                    </p>
                </div>
            </div>

            {/* CSS animations */}
            <style>{`
                @keyframes voice-wave {
                    0%, 100% {
                        transform: scaleY(0.3);
                    }
                    50% {
                        transform: scaleY(1);
                    }
                }

                @keyframes voice-glow-breathe {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.6;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 1;
                    }
                }

                @keyframes voice-glow-breathe-slow {
                    0%, 100% {
                        transform: scale(1);
                        opacity: 0.4;
                    }
                    50% {
                        transform: scale(1.15);
                        opacity: 0.8;
                    }
                }

                @keyframes voice-connecting {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                }

                @keyframes voice-sparkle {
                    0%, 100% {
                        transform: rotate(0deg) scale(1);
                    }
                    25% {
                        transform: rotate(-10deg) scale(1.1);
                    }
                    75% {
                        transform: rotate(10deg) scale(0.95);
                    }
                }

                .voice-wave-bar {
                    animation: voice-wave 0.8s ease-in-out infinite;
                }

                .voice-glow-outer {
                    animation: voice-glow-breathe-slow 3s ease-in-out infinite;
                }

                .voice-glow-middle {
                    animation: voice-glow-breathe 2s ease-in-out infinite;
                }

                .voice-orb-connecting {
                    animation: voice-connecting 1.5s ease-in-out infinite;
                }

                .voice-sparkle {
                    animation: voice-sparkle 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

export default VoiceCallModal;
