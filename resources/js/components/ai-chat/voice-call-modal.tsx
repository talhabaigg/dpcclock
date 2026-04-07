'use client';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Mic, MicOff, PhoneOff, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceCall, VoiceCallStatus, TranscriptEntry } from './use-voice-call';

interface VoiceCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
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
    const colors = {
        listening: 'bg-violet-500',
        speaking: 'bg-emerald-500',
        processing: 'bg-purple-500',
    };

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
                            isActive ? colors[variant] : 'bg-muted-foreground/30',
                            // Only use CSS animation for listening (user mic doesn't have analyser)
                            isActive && !useRealData && 'voice-wave-bar',
                            // Smooth transitions for real data
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
        <div className="relative flex items-center justify-center">
            {/* Outer glow rings - smooth breathing animation */}
            <div
                className={cn('absolute rounded-full transition-all duration-1000 ease-in-out', isActive && 'voice-glow-outer')}
                style={{
                    width: 180,
                    height: 180,
                    background: isListening
                        ? 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)'
                        : isSpeaking
                          ? 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)'
                          : isProcessing
                            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(100, 100, 100, 0.1) 0%, transparent 70%)',
                }}
            />

            {/* Middle ring */}
            <div
                className={cn('absolute rounded-full transition-all duration-700 ease-in-out', isActive && 'voice-glow-middle')}
                style={{
                    width: 140,
                    height: 140,
                    background: isListening
                        ? 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)'
                        : isSpeaking
                          ? 'radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)'
                          : isProcessing
                            ? 'radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(100, 100, 100, 0.15) 0%, transparent 70%)',
                }}
            />

            {/* Main orb */}
            <div
                className={cn(
                    'relative flex size-24 items-center justify-center rounded-full shadow-2xl transition-all duration-500',
                    status === 'idle' && 'bg-gradient-to-br from-zinc-700 to-zinc-800',
                    isConnecting && 'voice-orb-connecting bg-gradient-to-br from-amber-500 to-orange-600',
                    isListening && 'bg-gradient-to-br from-violet-500 to-purple-600',
                    isSpeaking && 'bg-gradient-to-br from-emerald-500 to-teal-600',
                    isProcessing && 'bg-gradient-to-br from-purple-500 to-pink-600',
                    status === 'error' && 'bg-gradient-to-br from-red-500 to-rose-600',
                    status === 'disconnected' && 'bg-gradient-to-br from-zinc-600 to-zinc-700',
                )}
            >
                {/* Inner glow */}
                <div
                    className={cn(
                        'absolute inset-2 rounded-full opacity-50 blur-md transition-all duration-500',
                        isListening && 'bg-violet-400',
                        isSpeaking && 'bg-emerald-400',
                        isProcessing && 'bg-purple-400',
                    )}
                />

                {/* Content */}
                <div className="relative z-10">
                    {isProcessing ? (
                        <div className="flex items-center justify-center">
                            <Sparkles className="voice-sparkle size-8 text-white" />
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
                            'rounded-xl px-3 py-2 text-sm',
                            entry.role === 'user' ? 'bg-muted/50' : 'bg-violet-500/10',
                        )}
                    >
                        <p
                            className={cn(
                                'mb-0.5 text-[10px] font-medium tracking-wider uppercase',
                                entry.role === 'user' ? 'text-muted-foreground' : 'text-violet-500',
                            )}
                        >
                            {entry.role === 'user' ? 'You' : 'AI'}
                        </p>
                        <p className="leading-relaxed">{entry.text}</p>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
}

export function VoiceCallModal({ isOpen, onClose, className }: VoiceCallModalProps) {
    const [selectedVoice, setSelectedVoice] = useState('ash');

    const { status, isConnected, isMuted, aiResponse, transcriptHistory, callDuration, audioLevels, startCall, endCall, toggleMute } = useVoiceCall({
        voice: selectedVoice,
        onError: (error) => {
            console.error('Voice call error:', error);
        },
    });

    // Auto-start call when modal opens
    useEffect(() => {
        if (isOpen && status === 'idle') {
            startCall();
        }
    }, [isOpen, status, startCall]);

    // Clean up on close
    const handleClose = useCallback(() => {
        endCall();
        onClose();
    }, [endCall, onClose]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with gradient */}
            <div
                className="from-background/95 via-background/90 to-background/95 absolute inset-0 bg-gradient-to-b backdrop-blur-md"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className={cn(
                    'border-border/50 bg-card/80 relative z-10 flex max-h-[90vh] w-full max-w-md flex-col items-center rounded-3xl border p-8 shadow-2xl backdrop-blur-sm',
                    className,
                )}
            >
                {/* Header */}
                <div className="mb-1 flex shrink-0 items-center gap-2">
                    <Sparkles className="size-5 text-violet-500" />
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
                        status === 'listening' && 'text-violet-500',
                        status === 'speaking' && 'text-emerald-500',
                        status === 'processing' && 'text-purple-500',
                        status === 'connecting' && 'text-amber-500',
                        status === 'error' && 'text-red-500',
                        (status === 'idle' || status === 'disconnected' || status === 'connected') && 'text-muted-foreground',
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
                    <div className="mb-3 w-full shrink-0 rounded-2xl bg-violet-500/10 px-4 py-3 backdrop-blur-sm">
                        <p className="mb-1 text-[10px] font-medium tracking-wider text-violet-500 uppercase">Speaking</p>
                        <p className="text-sm leading-relaxed">{aiResponse}</p>
                    </div>
                )}

                {/* Transcript history — scrollable, takes remaining space */}
                <div className="mb-4 min-h-0 w-full flex-1 overflow-hidden">
                    <TranscriptHistory entries={transcriptHistory} />
                </div>

                {/* Controls */}
                <div className="flex shrink-0 items-center gap-6">
                    {/* Mute button */}
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            'size-14 rounded-full border-2 transition-all duration-300',
                            isMuted
                                ? 'border-red-500 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                : 'border-border hover:border-foreground/50 hover:bg-muted',
                        )}
                        onClick={toggleMute}
                        disabled={!isConnected}
                    >
                        {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                    </Button>

                    {/* End call button */}
                    <Button
                        size="icon"
                        className="size-16 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/25 transition-all duration-300 hover:scale-105 hover:bg-red-600 hover:shadow-red-500/40"
                        onClick={handleClose}
                    >
                        <PhoneOff className="size-7" />
                    </Button>
                </div>

                {/* Voice selector + help */}
                <div className="mt-6 flex w-full shrink-0 items-center justify-between">
                    <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isConnected}>
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
