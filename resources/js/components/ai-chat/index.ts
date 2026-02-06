// AI Chat Components - Public API
export { AiChat } from './ai-chat';
export { ChatInput } from './chat-input';
export { ChatMessage } from './chat-message';
export { chatService } from './chat-service';
export { ChatWelcome } from './chat-welcome';
export { useChat } from './use-chat';
export { useVoiceCall } from './use-voice-call';
export { VoiceCallModal } from './voice-call-modal';

// Types
export type {
    ChatApiResponse,
    ChatConfig,
    ChatMessage as ChatMessageType,
    Conversation,
    StreamEvent,
    SuggestedPrompt,
    UseChatOptions,
    UseChatReturn,
} from './types';

export type { UseVoiceCallOptions, UseVoiceCallReturn, VoiceCallEvent, VoiceCallStatus } from './use-voice-call';
