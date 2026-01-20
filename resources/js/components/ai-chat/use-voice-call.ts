// useVoiceCall Hook - OpenAI Realtime API voice call management
import { useCallback, useRef, useState } from 'react';

export type VoiceCallStatus =
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'speaking'
    | 'listening'
    | 'processing'
    | 'error'
    | 'disconnected';

export interface VoiceCallEvent {
    type: 'transcript' | 'response' | 'tool_call' | 'error' | 'status';
    data: {
        text?: string;
        tool?: string;
        error?: string;
        status?: VoiceCallStatus;
    };
}

export interface CallDurationInfo {
    durationSeconds: number;
    durationMinutes: number;
    estimatedCost: number;
}

export interface UseVoiceCallOptions {
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
    startCall: () => Promise<void>;
    endCall: () => void;
    toggleMute: () => void;
}

export function useVoiceCall(options: UseVoiceCallOptions = {}): UseVoiceCallReturn {
    const { onTranscript, onResponse, onToolCall, onError, onStatusChange, onCallEnded } = options;

    const [status, setStatus] = useState<VoiceCallStatus>('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [userTranscript, setUserTranscript] = useState('');
    const [aiResponse, setAiResponse] = useState('');

    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const voiceSessionIdRef = useRef<number | null>(null);

    const updateStatus = useCallback(
        (newStatus: VoiceCallStatus) => {
            setStatus(newStatus);
            onStatusChange?.(newStatus);
        },
        [onStatusChange]
    );

    const handleDataChannelMessage = useCallback(
        async (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);
                const type = message.type as string;

                // Log all events for debugging
                console.log('Realtime event:', type, message);

                switch (type) {
                    case 'session.created':
                        console.log('Session created:', message.session?.id);
                        console.log('Session config:', message.session);
                        break;

                    case 'session.updated':
                        console.log('Session updated:', message.session);
                        break;

                    case 'input_audio_buffer.speech_started':
                        updateStatus('speaking');
                        break;

                    case 'input_audio_buffer.speech_stopped':
                        updateStatus('processing');
                        break;

                    case 'conversation.item.input_audio_transcription.completed':
                        // User's speech transcribed
                        const transcript = message.transcript || '';
                        setUserTranscript(transcript);
                        onTranscript?.(transcript, true);
                        break;

                    case 'response.audio.delta':
                        // Audio is being streamed - this means AI is speaking
                        // The actual audio is handled by WebRTC, but this tells us speech is happening
                        break;

                    case 'response.audio.done':
                        // Audio output finished
                        console.log('Audio output completed');
                        break;

                    case 'response.audio_transcript.delta':
                        // AI is speaking - accumulate transcript
                        const delta = message.delta || '';
                        setAiResponse((prev) => prev + delta);
                        updateStatus('processing'); // AI is responding
                        break;

                    case 'response.audio_transcript.done':
                        // AI finished speaking this segment
                        const fullTranscript = message.transcript || '';
                        setAiResponse(fullTranscript);
                        onResponse?.(fullTranscript);
                        break;

                    case 'response.output_item.done':
                        // An output item (audio/text) completed
                        console.log('Output item done:', message.item?.type);
                        break;

                    case 'response.function_call_arguments.done':
                        // Tool call completed from AI
                        const toolCallId = message.call_id;
                        const toolName = message.name;
                        const toolArgs = JSON.parse(message.arguments || '{}');

                        console.log('Tool call requested:', toolName, toolArgs);
                        onToolCall?.(toolName, toolArgs);

                        // Execute tool via server
                        try {
                            const toolResponse = await fetch('/voice/tool', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-CSRF-TOKEN':
                                        document.querySelector<HTMLMetaElement>(
                                            'meta[name="csrf-token"]'
                                        )?.content || '',
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
                                    })
                                );

                                // Trigger response generation
                                dataChannelRef.current.send(
                                    JSON.stringify({
                                        type: 'response.create',
                                    })
                                );
                            }
                        } catch (toolError) {
                            console.error('Tool execution error:', toolError);
                        }
                        break;

                    case 'response.done':
                        // Full response completed
                        updateStatus('listening');
                        // Clear AI response for next turn
                        setAiResponse('');
                        break;

                    case 'error':
                        console.error('Realtime API error:', message.error);
                        const error = new Error(message.error?.message || 'Unknown error');
                        onError?.(error);
                        updateStatus('error');
                        break;
                }
            } catch (err) {
                console.error('Error parsing data channel message:', err);
            }
        },
        [onTranscript, onResponse, onToolCall, onError, updateStatus]
    );

    const startCall = useCallback(async () => {
        try {
            updateStatus('connecting');

            // Step 1: Get ephemeral token from server
            const sessionResponse = await fetch('/voice/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                            ?.content || '',
                },
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to create voice session');
            }

            const sessionData = await sessionResponse.json();
            console.log('Session response:', sessionData);

            const ephemeralKey = sessionData.client_secret?.value;
            voiceSessionIdRef.current = sessionData.voice_session_id;

            if (!ephemeralKey) {
                console.error('Session data:', sessionData);
                throw new Error('No ephemeral key received. Check console for session data.');
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
                console.log('Data channel opened');
                updateStatus('connected');
                // Clear transcripts for new call
                setUserTranscript('');
                setAiResponse('');

                // Send initial response.create to prompt AI greeting
                setTimeout(() => {
                    if (dc.readyState === 'open') {
                        // Prompt the AI to greet the user
                        dc.send(
                            JSON.stringify({
                                type: 'response.create',
                                response: {
                                    modalities: ['text', 'audio'],
                                    instructions: 'Greet the user briefly and ask how you can help them today.',
                                },
                            })
                        );
                        updateStatus('listening');
                    }
                }, 500);
            };

            dc.onclose = () => {
                console.log('Data channel closed');
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
            const model = 'gpt-4o-mini-realtime-preview-2024-12-17';

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
            console.error('Voice call error:', err);
            const error = err instanceof Error ? err : new Error('Failed to start voice call');
            onError?.(error);
            updateStatus('error');
            endCall();
        }
    }, [handleDataChannelMessage, onError, updateStatus, status]);

    const endCall = useCallback(async () => {
        // Report session end to server first
        if (voiceSessionIdRef.current) {
            try {
                const response = await fetch('/voice/session/end', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN':
                            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
                                ?.content || '',
                    },
                    body: JSON.stringify({
                        voice_session_id: voiceSessionIdRef.current,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Voice session ended:', data);
                    onCallEnded?.({
                        durationSeconds: data.duration_seconds,
                        durationMinutes: data.duration_minutes,
                        estimatedCost: data.estimated_cost,
                    });
                }
            } catch (err) {
                console.error('Failed to end voice session on server:', err);
            }
            voiceSessionIdRef.current = null;
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

        // Clean up audio element
        if (audioElementRef.current) {
            audioElementRef.current.srcObject = null;
            audioElementRef.current = null;
        }

        setIsMuted(false);
        updateStatus('idle');
    }, [updateStatus, onCallEnded]);

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
        startCall,
        endCall,
        toggleMute,
    };
}
