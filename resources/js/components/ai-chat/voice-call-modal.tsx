'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { useEffect, useCallback } from 'react';
import { useVoiceCall, VoiceCallStatus } from './use-voice-call';

interface VoiceCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    className?: string;
}

const statusMessages: Record<VoiceCallStatus, string> = {
    idle: 'Ready to start',
    connecting: 'Connecting...',
    connected: 'Connected',
    listening: 'Listening...',
    speaking: 'You are speaking...',
    processing: 'Processing...',
    error: 'Connection error',
    disconnected: 'Call ended',
};

export function VoiceCallModal({ isOpen, onClose, className }: VoiceCallModalProps) {
    const {
        status,
        isConnected,
        isMuted,
        userTranscript,
        aiResponse,
        startCall,
        endCall,
        toggleMute,
    } = useVoiceCall({
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

    const isListening = status === 'listening';
    const isSpeaking = status === 'speaking';
    const isProcessing = status === 'processing';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className={cn(
                    'relative z-10 flex w-full max-w-md flex-col items-center rounded-3xl border border-border bg-background p-8 shadow-2xl',
                    className
                )}
            >
                {/* Status indicator */}
                <div className="mb-6 text-center">
                    <h2 className="text-xl font-semibold">Voice Call</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{statusMessages[status]}</p>
                </div>

                {/* Animated orb */}
                <div className="relative mb-8">
                    {/* Outer glow rings */}
                    <div
                        className={cn(
                            'absolute inset-0 rounded-full transition-all duration-300',
                            isListening && 'animate-pulse bg-blue-500/20',
                            isSpeaking && 'animate-ping bg-green-500/20',
                            isProcessing && 'animate-pulse bg-purple-500/20'
                        )}
                        style={{
                            width: 160,
                            height: 160,
                            top: -20,
                            left: -20,
                        }}
                    />
                    <div
                        className={cn(
                            'absolute inset-0 rounded-full transition-all duration-300',
                            isListening && 'animate-pulse bg-blue-500/30 delay-75',
                            isSpeaking && 'animate-pulse bg-green-500/30 delay-100',
                            isProcessing && 'animate-pulse bg-purple-500/30 delay-75'
                        )}
                        style={{
                            width: 140,
                            height: 140,
                            top: -10,
                            left: -10,
                        }}
                    />

                    {/* Main orb */}
                    <div
                        className={cn(
                            'relative flex size-[120px] items-center justify-center rounded-full transition-all duration-300',
                            status === 'idle' && 'bg-muted',
                            status === 'connecting' && 'animate-pulse bg-yellow-500/50',
                            isListening && 'bg-gradient-to-br from-blue-500 to-cyan-500',
                            isSpeaking && 'bg-gradient-to-br from-green-500 to-emerald-500',
                            isProcessing && 'bg-gradient-to-br from-purple-500 to-violet-500',
                            status === 'error' && 'bg-red-500',
                            status === 'disconnected' && 'bg-muted'
                        )}
                    >
                        {/* Icon */}
                        {isSpeaking ? (
                            <Mic className="size-12 text-white" />
                        ) : isListening ? (
                            <Volume2 className="size-12 text-white" />
                        ) : isProcessing ? (
                            <div className="size-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                        ) : (
                            <Phone className="size-12 text-muted-foreground" />
                        )}
                    </div>
                </div>

                {/* Live transcripts */}
                <div className="mb-6 w-full space-y-3">
                    {/* User transcript */}
                    {userTranscript && (
                        <div className="rounded-xl bg-muted/50 p-3">
                            <p className="mb-1 text-xs font-medium text-muted-foreground">You said:</p>
                            <p className="text-sm">{userTranscript}</p>
                        </div>
                    )}

                    {/* AI response */}
                    {aiResponse && (
                        <div className="rounded-xl bg-primary/10 p-3">
                            <p className="mb-1 text-xs font-medium text-primary">AI:</p>
                            <p className="text-sm">{aiResponse}</p>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    {/* Mute button */}
                    <Button
                        variant="outline"
                        size="icon"
                        className={cn(
                            'size-14 rounded-full transition-all',
                            isMuted && 'bg-red-500/10 border-red-500 text-red-500'
                        )}
                        onClick={toggleMute}
                        disabled={!isConnected}
                    >
                        {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
                    </Button>

                    {/* End call button */}
                    <Button
                        variant="destructive"
                        size="icon"
                        className="size-16 rounded-full"
                        onClick={handleClose}
                    >
                        <PhoneOff className="size-7" />
                    </Button>
                </div>

                {/* Help text */}
                <p className="mt-6 text-center text-xs text-muted-foreground">
                    Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Esc</kbd> or click outside to end call
                </p>
            </div>
        </div>
    );
}

export default VoiceCallModal;
