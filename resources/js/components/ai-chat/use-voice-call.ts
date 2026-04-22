// useVoiceCall Hook - OpenAI Realtime API voice call management
import { useCallback, useEffect, useRef, useState } from 'react';
import { csrfFetch } from './csrf-fetch';

export type VoiceCallStatus = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'processing' | 'error' | 'disconnected';

export interface TranscriptEntry {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export interface CallDurationInfo {
    durationSeconds: number;
    durationMinutes: number;
    estimatedCost: number;
}

export interface UseVoiceCallOptions {
    voice?: string;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onResponse?: (text: string) => void;
    onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: VoiceCallStatus) => void;
    onCallEnded?: (duration: CallDurationInfo) => void;
}

export interface UseVoiceCallReturn {
    status: VoiceCallStatus;
    isConnected: boolean;
    isMuted: boolean;
    userTranscript: string;
    aiResponse: string;
    transcriptHistory: TranscriptEntry[];
    callDuration: number;
    audioLevels: number[];
    startCall: () => Promise<void>;
    endCall: () => void;
    toggleMute: () => void;
}

export function useVoiceCall(options: UseVoiceCallOptions = {}): UseVoiceCallReturn {
    const { voice = 'ash', onTranscript, onResponse, onToolCall, onError, onStatusChange, onCallEnded } = options;

    const [status, setStatus] = useState<VoiceCallStatus>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [userTranscript, setUserTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
    const [callDuration, setCallDuration] = useState(0);
    const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const voiceSessionIdRef = useRef<number | null>(null);
    const conversationIdRef = useRef<string | null>(null);
    const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const aiResponseAccRef = useRef('');
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);

    const updateStatus = useCallback(
        (newStatus: VoiceCallStatus) => {
            setStatus(newStatus);
            onStatusChange?.(newStatus);
        },
        [onStatusChange],
    );

    // Save transcript to server for conversation persistence
    const saveTranscript = useCallback(async (userText?: string, aiText?: string) => {
        if (!voiceSessionIdRef.current) return;

        try {
            await csrfFetch('/voice/transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({
                    voice_session_id: voiceSessionIdRef.current,
                    conversation_id: conversationIdRef.current,
                    user_transcript: userText || undefined,
                    ai_transcript: aiText || undefined,
                }),
            });
        } catch { /* ignored */ }
    }, []);

    const handleDataChannelMessage = useCallback(
        async (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);
                const type = message.type as string;

                switch (type) {
                    case 'session.created':
                    case 'session.updated':
                        break;

                    case 'input_audio_buffer.speech_started':
                        updateStatus('speaking');
                        break;

                    case 'input_audio_buffer.speech_stopped':
                        updateStatus('processing');
                        break;

                    case 'conversation.item.input_audio_transcription.completed': {
                        // User's speech transcribed
                        const transcript = message.transcript || '';
                        setUserTranscript(transcript);
                        setTranscriptHistory((prev) => [...prev, { role: 'user', text: transcript, timestamp: new Date() }]);
                        onTranscript?.(transcript, true);
                        // Save user transcript
                        saveTranscript(transcript, undefined);
                        break;
                    }

                    case 'response.audio.delta':
                    case 'response.audio.done':
                        break;

                    case 'response.audio_transcript.delta': {
                        // AI is speaking - accumulate transcript
                        const delta = message.delta || '';
                        aiResponseAccRef.current += delta;
                        setAiResponse(aiResponseAccRef.current);
                        updateStatus('processing');
                        break;
                    }

                    case 'response.audio_transcript.done': {
                        // AI finished speaking this segment
                        const fullTranscript = message.transcript || '';
                        setAiResponse(fullTranscript);
                        aiResponseAccRef.current = '';
                        setTranscriptHistory((prev) => [...prev, { role: 'assistant', text: fullTranscript, timestamp: new Date() }]);
                        onResponse?.(fullTranscript);
                        // Save AI transcript
                        saveTranscript(undefined, fullTranscript);
                        break;
                    }

                    case 'response.output_item.done':
                        break;

                    case 'response.function_call_arguments.done': {
                        // Tool call completed from AI
                        const toolCallId = message.call_id;
                        const toolName = message.name;
                        const toolArgs = JSON.parse(message.arguments || '{}');

                        onToolCall?.(toolName, toolArgs);

                        // Execute tool via server
                        try {
                            const toolResponse = await csrfFetch('/voice/tool', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                                },
                                body: JSON.stringify({
                                    tool_name: toolName,
                                    arguments: toolArgs,
                                    call_id: toolCallId,
                                }),
                            });

                            const result = await toolResponse.json();

                            // Send tool result back to Realtime API
                            if (dataChannelRef.current?.readyState === 'open') {
                                dataChannelRef.current.send(
                                    JSON.stringify({
                                        type: 'conversation.item.create',
                                        item: {
                                            type: 'function_call_output',
                                            call_id: toolCallId,
                                            output: result.output,
                                        },
                                    }),
                                );

                                // Trigger response generation
                                dataChannelRef.current.send(
                                    JSON.stringify({
                                        type: 'response.create',
                                    }),
                                );
                            }
                        } catch { /* ignored */ }
                        break;
                    }

                    case 'response.done':
                        // Full response completed — clear current response for next turn but keep history
                        updateStatus('listening');
                        setAiResponse('');
                        aiResponseAccRef.current = '';
                        break;

                    case 'error': {
                        const error = new Error(message.error?.message || 'Unknown error');
                        onError?.(error);
                        updateStatus('error');
                        break;
                    }
                }
            } catch { /* ignored */ }
        },
        [onTranscript, onResponse, onToolCall, onError, updateStatus, saveTranscript],
    );

    const startCall = useCallback(async () => {
        try {
            updateStatus('connecting');

            // Reset state for new call
            setTranscriptHistory([]);
            setCallDuration(0);
            setUserTranscript('');
            setAiResponse('');
            aiResponseAccRef.current = '';

            // Step 1: Get ephemeral token from server
            const sessionResponse = await csrfFetch('/voice/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({ voice }),
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to create voice session');
            }

            const sessionData = await sessionResponse.json();

            const ephemeralKey = sessionData.client_secret?.value;
            voiceSessionIdRef.current = sessionData.voice_session_id;
            conversationIdRef.current = `voice-${sessionData.voice_session_id}`;

            if (!ephemeralKey) {
                throw new Error('No ephemeral key received');
            }

            // Step 2: Create WebRTC peer connection
            const pc = new RTCPeerConnection();
            peerConnectionRef.current = pc;

            // Set up audio element for AI voice output
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioElementRef.current = audioEl;

            pc.ontrack = (e) => {
                audioEl.srcObject = e.streams[0];

                // Set up audio analyser for reactive waveform
                try {
                    const audioCtx = new AudioContext();
                    audioContextRef.current = audioCtx;
                    const source = audioCtx.createMediaStreamSource(e.streams[0]);
                    const analyser = audioCtx.createAnalyser();
                    analyser.fftSize = 32;
                    analyser.smoothingTimeConstant = 0.6;
                    source.connect(analyser);
                    analyserRef.current = analyser;

                    // Start animation loop to read audio levels
                    const dataArray = new Uint8Array(analyser.frequencyBinCount);
                    const updateLevels = () => {
                        analyser.getByteFrequencyData(dataArray);
                        // Pick 5 spread-out frequency bins, normalize to 0-1
                        const bins = analyser.frequencyBinCount;
                        const levels = [
                            dataArray[Math.floor(bins * 0.1)] / 255,
                            dataArray[Math.floor(bins * 0.25)] / 255,
                            dataArray[Math.floor(bins * 0.4)] / 255,
                            dataArray[Math.floor(bins * 0.6)] / 255,
                            dataArray[Math.floor(bins * 0.8)] / 255,
                        ];
                        setAudioLevels(levels);
                        animFrameRef.current = requestAnimationFrame(updateLevels);
                    };
                    animFrameRef.current = requestAnimationFrame(updateLevels);
                } catch { /* ignored */ }
            };

            // Step 3: Get user microphone
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 24000,
                },
            });
            mediaStreamRef.current = mediaStream;

            // Add audio track to peer connection
            mediaStream.getTracks().forEach((track) => {
                pc.addTrack(track, mediaStream);
            });

            // Step 4: Create data channel for events
            const dc = pc.createDataChannel('oai-events');
            dataChannelRef.current = dc;

            dc.onopen = () => {
                updateStatus('connected');
                setUserTranscript('');
                setAiResponse('');

                // Start call duration timer
                const startTime = Date.now();
                durationIntervalRef.current = setInterval(() => {
                    setCallDuration(Math.floor((Date.now() - startTime) / 1000));
                }, 1000);

                // Prompt AI greeting
                setTimeout(() => {
                    if (dc.readyState === 'open') {
                        dc.send(
                            JSON.stringify({
                                type: 'response.create',
                                response: {
                                    modalities: ['text', 'audio'],
                                    instructions: 'Greet the user briefly. Say something like "Hey, how can I help?" — keep it short and natural.',
                                },
                            }),
                        );
                        updateStatus('listening');
                    }
                }, 500);
            };

            dc.onclose = () => {
                if (status !== 'idle' && status !== 'disconnected') {
                    updateStatus('disconnected');
                }
            };

            dc.onmessage = handleDataChannelMessage;

            // Step 5: Create and set local offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Step 6: Connect to OpenAI Realtime API
            const baseUrl = 'https://api.openai.com/v1/realtime';
            const model = 'gpt-4o-mini-realtime';

            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${ephemeralKey}`,
                    'Content-Type': 'application/sdp',
                },
                body: offer.sdp,
            });

            if (!sdpResponse.ok) {
                throw new Error('Failed to connect to Realtime API');
            }

            const answerSdp = await sdpResponse.text();
            await pc.setRemoteDescription({
                type: 'answer',
                sdp: answerSdp,
            });

            updateStatus('listening');
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to start voice call');
            onError?.(error);
            updateStatus('error');
            endCall();
        }
    }, [handleDataChannelMessage, onError, updateStatus, status, voice]);

    const endCall = useCallback(async () => {
        // Stop duration timer
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        // Report session end to server first
        if (voiceSessionIdRef.current) {
            try {
                const response = await csrfFetch('/voice/session/end', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                    },
                    body: JSON.stringify({
                        voice_session_id: voiceSessionIdRef.current,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    onCallEnded?.({
                        durationSeconds: data.duration_seconds,
                        durationMinutes: data.duration_minutes,
                        estimatedCost: data.estimated_cost,
                    });
                }
            } catch { /* ignored */ }
            voiceSessionIdRef.current = null;
            conversationIdRef.current = null;
        }

        // Close data channel
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        // Stop media stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        // Stop audio analyser
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => {});
            audioContextRef.current = null;
        }
        analyserRef.current = null;

        // Clean up audio element
        if (audioElementRef.current) {
            audioElementRef.current.srcObject = null;
            audioElementRef.current = null;
        }

        setIsMuted(false);
        setAudioLevels([0, 0, 0, 0, 0]);
        updateStatus('idle');
    }, [updateStatus, onCallEnded]);

    // Clean up timer and analyser on unmount
    useEffect(() => {
        return () => {
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => {});
            }
        };
    }, []);

    const toggleMute = useCallback(() => {
        if (mediaStreamRef.current) {
            const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    }, []);

    return {
        status,
        isConnected: status === 'connected' || status === 'listening' || status === 'speaking' || status === 'processing',
        isMuted,
        userTranscript,
        aiResponse,
        transcriptHistory,
        callDuration,
        audioLevels,
        startCall,
        endCall,
        toggleMute,
    };
}
