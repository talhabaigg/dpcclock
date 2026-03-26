// AI Chat Types - Production-grade type definitions

export interface ChatAttachment {
    name: string;
    type: string;
    size: number;
    url?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    status: 'sending' | 'streaming' | 'complete' | 'error';
    attachments?: ChatAttachment[];
    metadata?: {
        model?: string;
        tokensUsed?: number;
        sources?: string[];
    };
}

export interface Conversation {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: ChatMessage[];
}

export interface ChatConfig {
    placeholder?: string;
    welcomeMessage?: string;
    suggestedPrompts?: SuggestedPrompt[];
    maxMessageLength?: number;
    enableMarkdown?: boolean;
    enableCodeHighlight?: boolean;
    showTimestamps?: boolean;
    showCopyButton?: boolean;
    showRegenerateButton?: boolean;
    streamingEnabled?: boolean;
}

export interface SuggestedPrompt {
    icon?: React.ComponentType<{ className?: string }>;
    label: string;
    prompt: string;
}

export interface ChatApiResponse {
    reply: string;
    conversation_id: string;
    model?: string;
    tokens_used?: number;
}

export interface StreamEvent {
    type: 'delta' | 'done' | 'error';
    data: {
        delta?: string;
        conversation_id?: string;
        error?: string;
    };
}

export interface ConversationSummary {
    conversation_id: string;
    title: string;
    last_message_at: string;
    message_count: number;
}

export interface UseChatOptions {
    conversationId?: string | null;
    onError?: (error: Error) => void;
    onMessageComplete?: (message: ChatMessage) => void;
}

export interface UseChatReturn {
    messages: ChatMessage[];
    isLoading: boolean;
    error: Error | null;
    conversationId: string | null;
    sendMessage: (content: string, attachments?: File[]) => Promise<void>;
    regenerateLastMessage: () => Promise<void>;
    clearMessages: () => void;
    stopGeneration: () => void;
    loadMessages: (messages: ChatMessage[], conversationId: string) => void;
}
