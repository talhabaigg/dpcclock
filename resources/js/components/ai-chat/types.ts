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
    /** Reasoning / chain-of-thought summary streamed before the answer (reasoning-capable models only). */
    reasoning?: string;
    /** True while reasoning is actively streaming; false (or undefined) once the answer has started. */
    reasoningStreaming?: boolean;
    /** Timestamp (ms) when the first reasoning chunk arrived — used to compute the duration. */
    reasoningStartedAt?: number;
    /** Total reasoning duration in milliseconds, set when the answer starts streaming. */
    reasoningDurationMs?: number;
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
    type: 'delta' | 'reasoning_delta' | 'done' | 'error';
    data: {
        delta?: string;
        reasoning_delta?: string;
        conversation_id?: string;
        error?: string;
    };
}

export interface AiModel {
    id: string;
    name: string;
    provider: string;
    description?: string;
}

export const AVAILABLE_MODELS: AiModel[] = [
    { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'OpenAI', description: 'Latest flagship — frontier reasoning' },
    { id: 'gpt-5.5-mini', name: 'GPT-5.5 Mini', provider: 'OpenAI', description: 'Latest — fast & powerful' },
    { id: 'gpt-5.5-nano', name: 'GPT-5.5 Nano', provider: 'OpenAI', description: 'Latest — cheapest tier' },
    { id: 'gpt-5.4', name: 'GPT-5.4', provider: 'OpenAI', description: 'Most capable — 1M context' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'OpenAI', description: 'Fast & powerful' },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', provider: 'OpenAI', description: 'Cheapest GPT-5 class' },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', description: 'Reliable & efficient' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', description: 'Fast & affordable' },
    { id: 'o4-mini', name: 'O4 Mini', provider: 'OpenAI', description: 'Reasoning model' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', description: 'Balanced performance' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'Anthropic', description: 'Fast & affordable' },
];

export const DEFAULT_MODEL_ID = 'gpt-5.4-mini';

export type ChatMode = 'instant' | 'thinking' | 'pro';

export const CHAT_MODES: { id: ChatMode; label: string; description: string }[] = [
    { id: 'instant', label: 'Instant', description: 'Fast everyday replies' },
    { id: 'thinking', label: 'Thinking', description: 'Step-by-step reasoning' },
    { id: 'pro', label: 'Pro', description: 'Frontier capability for hard tasks' },
];

export const DEFAULT_MODE_MODEL_MAP: Record<ChatMode, string> = {
    instant: 'gpt-5.4-mini',
    thinking: 'o4-mini',
    pro: 'gpt-5.5',
};

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
    sendMessage: (content: string, attachments?: File[], model?: string) => Promise<void>;
    regenerateLastMessage: () => Promise<void>;
    clearMessages: () => void;
    stopGeneration: () => void;
    loadMessages: (messages: ChatMessage[], conversationId: string) => void;
    appendMessages: (messages: ChatMessage[], conversationId: string) => void;
}
