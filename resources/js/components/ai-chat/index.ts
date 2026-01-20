// AI Chat Components - Public API
export { AiChat } from './ai-chat';
export { ChatInput } from './chat-input';
export { ChatMessage } from './chat-message';
export { ChatWelcome } from './chat-welcome';
export { VoiceCallModal } from './voice-call-modal';
export { chatService } from './chat-service';
export { useChat } from './use-chat';
export { useVoiceCall } from './use-voice-call';

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

export type {
    VoiceCallStatus,
    VoiceCallEvent,
    UseVoiceCallOptions,
    UseVoiceCallReturn,
} from './use-voice-call';
