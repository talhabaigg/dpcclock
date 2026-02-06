'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mic, MicOff, PhoneOff, Sparkles } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useVoiceCall, VoiceCallStatus } from './use-voice-call';

interface VoiceCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
}

const statusMessages: Record<VoiceCallStatus, string> = {
    idle: 'Tap to start',
    connecting: 'Connecting...',
    connected: 'Connected',
    listening: 'Listening...',
    speaking: "You're speaking",
    processing: 'Thinking...',
    error: 'Connection failed',
    disconnected: 'Call ended',
};

// Animated sound wave bars component
function SoundWave({ isActive, variant }: { isActive: boolean; variant: 'listening' | 'speaking' | 'processing' }) {
    const barCount = 5;
    const colors = {
        listening: 'bg-violet-500',
        speaking: 'bg-emerald-500',
        processing: 'bg-purple-500',
    };

    return (
        <div className="flex h-12 items-center justify-center gap-1">
            {Array.from({ length: barCount }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        'w-1 rounded-full transition-all duration-300',
                        isActive ? colors[variant] : 'bg-muted-foreground/30',
                        isActive && 'voice-wave-bar',
                    )}
                    style={{
                        height: isActive ? '100%' : '8px',
                        animationDelay: `${i * 0.1}s`,
                    }}
                />
            ))}
        </div>
    );
}

// Floating orb with smooth animations
function VoiceOrb({ status }: { status: VoiceCallStatus }) {
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
                    width: 200,
                    height: 200,
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
                    width: 160,
                    height: 160,
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
                    'relative flex size-28 items-center justify-center rounded-full shadow-2xl transition-all duration-500',
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
                            <Sparkles className="voice-sparkle size-10 text-white" />
                        </div>
                    ) : (
                        <SoundWave isActive={isListening || isSpeaking} variant={isSpeaking ? 'speaking' : 'listening'} />
                    )}
                </div>
            </div>
        </div>
    );
}

export function VoiceCallModal({ isOpen, onClose, className }: VoiceCallModalProps) {
    const { status, isConnected, isMuted, userTranscript, aiResponse, startCall, endCall, toggleMute } = useVoiceCall({
        onError: (error) => {
            console.error('Voice call error:', error);
        },
        onStatusChange: (newStatus) => {
            console.log('Voice status:', newStatus);
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
                    'border-border/50 bg-card/80 relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border p-8 shadow-2xl backdrop-blur-sm',
                    className,
                )}
            >
                {/* Header */}
                <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="size-5 text-violet-500" />
                    <h2 className="text-lg font-semibold">Superior AI</h2>
                </div>

                {/* Status */}
                <p
                    className={cn(
                        'mb-8 text-sm font-medium transition-colors duration-300',
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
                <div className="mb-8">
                    <VoiceOrb status={status} />
                </div>

                {/* Live transcripts */}
                <div className="mb-8 min-h-[80px] w-full space-y-3">
                    {/* User transcript */}
                    {userTranscript && (
                        <div className="bg-muted/50 rounded-2xl px-4 py-3 backdrop-blur-sm">
                            <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wider uppercase">You</p>
                            <p className="text-sm leading-relaxed">{userTranscript}</p>
                        </div>
                    )}

                    {/* AI response */}
                    {aiResponse && (
                        <div className="rounded-2xl bg-violet-500/10 px-4 py-3 backdrop-blur-sm">
                            <p className="mb-1 text-[10px] font-medium tracking-wider text-violet-500 uppercase">AI Response</p>
                            <p className="text-sm leading-relaxed">{aiResponse}</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-6">
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

                {/* Help text */}
                <p className="text-muted-foreground/70 mt-8 text-center text-xs">
                    Press <kbd className="bg-muted/80 rounded-md px-1.5 py-0.5 font-mono text-[10px]">ESC</kbd> to end call
                </p>
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
