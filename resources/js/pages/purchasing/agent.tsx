import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    AlertTriangle,
    Bot,
    Check,
    Copy,
    Loader2,
    MapPin,
    Package,
    Plus,
    Send,
    ShoppingCart,
    Square,
    Sparkles,
    Truck,
    User,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolResultData {
    tool_name: string;
     
    result: Record<string, any>;
}

interface AgentMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    status: 'sending' | 'thinking' | 'streaming' | 'complete' | 'error';
    toolResults?: ToolResultData[];
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    cost: string;
}

// ─── Agent Service ────────────────────────────────────────────────────────────

function getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

async function fetchModels(): Promise<{ models: ModelOption[]; default: string }> {
    const res = await fetch('/api/requisition-agent/models', {
        headers: { 'X-CSRF-TOKEN': getCsrfToken(), 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
}

async function sendChat(
    message: string,
    conversationId: string | null,
    model: string,
): Promise<{ reply: string; conversation_id: string; tool_results?: ToolResultData[] }> {
    const res = await fetch('/api/requisition-agent/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ message, conversation_id: conversationId, model }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }
    return res.json();
}

type StreamEvent =
    | { type: 'delta'; text: string }
    | { type: 'tool_result'; data: ToolResultData }
    | { type: 'done' };

async function* streamChat(
    message: string,
    conversationId: string,
    model: string,
    signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
    const res = await fetch('/api/requisition-agent/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ message, conversation_id: conversationId, model }),
        signal,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data:'));
            if (!dataLine) continue;
            const raw = dataLine.slice(5).trim();
            if (raw === '[DONE]') {
                yield { type: 'done' };
                return;
            }
            try {
                const parsed = JSON.parse(raw);
                if (parsed.type === 'text_delta' && parsed.delta) {
                    yield { type: 'delta', text: parsed.delta };
                } else if (parsed.type === 'tool_result' && parsed.successful) {
                    const displayableTools = ['SearchLocations', 'ListSuppliers', 'SearchMaterials'];
                    if (displayableTools.includes(parsed.tool_name)) {
                        yield {
                            type: 'tool_result',
                            data: {
                                tool_name: parsed.tool_name,
                                result: typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result,
                            },
                        };
                    }
                } else if (parsed.type === 'stream_end') {
                    yield { type: 'done' };
                    return;
                }
            } catch {
                // skip
            }
        }
    }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useRequisitionAgent() {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [models, setModels] = useState<ModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        fetchModels().then((data) => {
            setModels(data.models);
            setSelectedModel(data.default);
        }).catch(() => {});
    }, []);

    const sendMessage = useCallback(
        async (content: string) => {
            if (!content.trim() || isLoading) return;

            const userMsg: AgentMessage = {
                id: crypto.randomUUID(),
                role: 'user',
                content: content.trim(),
                timestamp: new Date(),
                status: 'complete',
            };

            const assistantMsg: AgentMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                status: conversationId ? 'streaming' : 'thinking',
            };

            setMessages((prev) => [...prev, userMsg, assistantMsg]);
            setIsLoading(true);

            try {
                // First message: use non-streaming to get conversation_id
                if (!conversationId) {
                    const result = await sendChat(content.trim(), null, selectedModel);
                    setConversationId(result.conversation_id);
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id
                                ? { ...m, content: result.reply, status: 'complete', toolResults: result.tool_results }
                                : m,
                        ),
                    );
                } else {
                    // Subsequent messages: stream
                    const controller = new AbortController();
                    abortRef.current = controller;

                    let accumulated = '';
                    const toolResults: ToolResultData[] = [];
                    for await (const event of streamChat(content.trim(), conversationId, selectedModel, controller.signal)) {
                        if (event.type === 'delta') {
                            accumulated += event.text;
                            const text = accumulated;
                            const trs = [...toolResults];
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsg.id
                                        ? { ...m, content: text, status: 'streaming', toolResults: trs.length ? trs : undefined }
                                        : m,
                                ),
                            );
                        } else if (event.type === 'tool_result') {
                            toolResults.push(event.data);
                            const trs = [...toolResults];
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantMsg.id
                                        ? { ...m, toolResults: trs }
                                        : m,
                                ),
                            );
                        }
                    }

                    const finalToolResults = [...toolResults];
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id
                                ? { ...m, status: 'complete', toolResults: finalToolResults.length ? finalToolResults : undefined }
                                : m,
                        ),
                    );
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id ? { ...m, status: 'complete' } : m,
                        ),
                    );
                } else {
                    const errorText = err instanceof Error ? err.message : 'Something went wrong';
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id
                                ? { ...m, content: errorText, status: 'error' }
                                : m,
                        ),
                    );
                }
            } finally {
                setIsLoading(false);
                abortRef.current = null;
            }
        },
        [conversationId, isLoading, selectedModel],
    );

    const stopGeneration = useCallback(() => {
        abortRef.current?.abort();
    }, []);

    const newConversation = useCallback(() => {
        setMessages([]);
        setConversationId(null);
    }, []);

    return {
        messages,
        isLoading,
        conversationId,
        models,
        selectedModel,
        setSelectedModel,
        sendMessage,
        stopGeneration,
        newConversation,
    };
}

// ─── Message Component ────────────────────────────────────────────────────────

function CodeBlock({ language, children }: { language: string; children: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="group/code relative my-3 overflow-hidden rounded-lg border border-zinc-700">
            <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5">
                <span className="text-xs text-zinc-400">{language || 'code'}</span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-zinc-400 hover:text-zinc-200"
                    onClick={async () => {
                        await navigator.clipboard.writeText(children);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    }}
                >
                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            <SyntaxHighlighter
                language={language || 'text'}
                style={oneDark}
                customStyle={{ margin: 0, padding: '0.75rem', fontSize: '0.8rem', background: '#1e1e1e', borderRadius: 0 }}
                showLineNumbers={children.split('\n').length > 3}
                lineNumberStyle={{ minWidth: '2em', paddingRight: '0.75em', color: '#6b7280', userSelect: 'none' }}
            >
                {children}
            </SyntaxHighlighter>
        </div>
    );
}

// ─── Tool Result Cards ───────────────────────────────────────────────────────

function ToolResultCards({ toolResults, onSelect }: { toolResults: ToolResultData[]; onSelect: (text: string) => void }) {
    return (
        <div className="mt-3 space-y-3">
            {toolResults.map((tr, i) => {
                if (tr.tool_name === 'SearchLocations' && tr.result.locations?.length) {
                    return <LocationCards key={i} locations={tr.result.locations} onSelect={onSelect} />;
                }
                if (tr.tool_name === 'ListSuppliers' && tr.result.suppliers?.length) {
                    return <SupplierCards key={i} suppliers={tr.result.suppliers} onSelect={onSelect} />;
                }
                if (tr.tool_name === 'SearchMaterials' && tr.result.materials?.length) {
                    return <MaterialCards key={i} materials={tr.result.materials} warning={tr.result.warning} onSelect={onSelect} />;
                }
                return null;
            })}
        </div>
    );
}

function LocationCards({ locations, onSelect }: {
    locations: Array<{ id: number; name: string; external_id?: string; state?: string; is_deprecated?: boolean }>;
    onSelect: (text: string) => void;
}) {
    if (locations.length > 10) return null;
    return (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {locations.map((loc) => (
                <button
                    key={loc.id}
                    onClick={() => onSelect(`Use location: ${loc.name} (ID ${loc.id})`)}
                    className={cn(
                        'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        loc.is_deprecated && 'border-dashed opacity-60',
                    )}
                >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-violet-500" />
                    <div className="min-w-0">
                        <div className="font-medium leading-tight">{loc.name}</div>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                            {loc.state && <span>{loc.state}</span>}
                            {loc.external_id && <span>({loc.external_id})</span>}
                            {loc.is_deprecated && (
                                <span className="rounded bg-amber-500/10 px-1 py-0.5 text-amber-600 dark:text-amber-400">Deprecated</span>
                            )}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}

function SupplierCards({ suppliers, onSelect }: {
    suppliers: Array<{ id: number; name: string; code?: string }>;
    onSelect: (text: string) => void;
}) {
    if (suppliers.length > 10) return null;
    return (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {suppliers.map((sup) => (
                <button
                    key={sup.id}
                    onClick={() => onSelect(`Use supplier: ${sup.name} (ID ${sup.id})`)}
                    className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                    <Truck className="size-4 shrink-0 text-blue-500" />
                    <div className="min-w-0">
                        <div className="font-medium leading-tight">{sup.name}</div>
                        {sup.code && <div className="text-muted-foreground text-xs">{sup.code}</div>}
                    </div>
                </button>
            ))}
        </div>
    );
}

function MaterialCards({ materials, warning, onSelect }: {
    materials: Array<{ id: number; code: string; description: string; unit_cost: number; price_source: string; cost_code?: string }>;
    warning?: string;
    onSelect: (text: string) => void;
}) {
    if (materials.length > 10) return null;
    return (
        <div className="space-y-1.5">
            {warning && (
                <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {warning}
                </div>
            )}
            <div className="grid grid-cols-1 gap-1.5">
                {materials.map((mat) => (
                    <button
                        key={mat.id}
                        onClick={() => onSelect(`Add material ${mat.code} - ${mat.description}`)}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <Package className="size-4 shrink-0 text-emerald-500" />
                            <div className="min-w-0">
                                <div className="font-medium leading-tight truncate">{mat.description}</div>
                                <div className="text-muted-foreground text-xs">{mat.code}{mat.cost_code ? ` / ${mat.cost_code}` : ''}</div>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="font-semibold">${mat.unit_cost.toFixed(2)}</div>
                            <span className={cn(
                                'text-[10px] rounded px-1 py-0.5',
                                mat.price_source === 'location_price'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                            )}>
                                {mat.price_source === 'location_price' ? 'Location' : 'Base'}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ─── Message Component ────────────────────────────────────────────────────────

const AgentMessageBubble = memo(function AgentMessageBubble({ message, onSendMessage }: { message: AgentMessage; onSendMessage: (text: string) => void }) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const isThinking = message.status === 'thinking';
    const isStreaming = message.status === 'streaming';
    const isActive = isThinking || isStreaming;
    const isError = message.status === 'error';
    const showThinkingIndicator = isActive && !message.content;

    return (
        <div className={cn('group relative flex gap-3 px-4 py-3', !isUser && 'bg-muted/30')}>
            <Avatar className={cn('size-7 shrink-0', isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-600')}>
                <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-white')}>
                    {isUser ? <User className="size-3.5" /> : <Sparkles className="size-3.5" />}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold">{isUser ? 'You' : 'Requisition Agent'}</span>
                <div className={cn('prose prose-sm dark:prose-invert mt-1 max-w-none', isError && 'text-destructive')}>
                    {showThinkingIndicator ? (
                        <div className="flex items-center gap-2 py-1">
                            <Loader2 className="size-4 animate-spin text-violet-500" />
                            <span className="text-sm text-muted-foreground">
                                {isThinking ? 'Working on it...' : 'Thinking...'}
                            </span>
                        </div>
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const codeString = String(children).replace(/\n$/, '');
                                    if (!className) {
                                        return <code className="rounded bg-zinc-100 px-1 py-0.5 text-sm dark:bg-zinc-800">{children}</code>;
                                    }
                                    return <CodeBlock language={match?.[1] || ''}>{codeString}</CodeBlock>;
                                },
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                                table({ children }) {
                                    return (
                                        <div className="my-3 overflow-x-auto rounded-lg border">
                                            <table className="w-full text-sm">{children}</table>
                                        </div>
                                    );
                                },
                                thead({ children }) {
                                    return <thead className="bg-muted/50">{children}</thead>;
                                },
                                th({ children }) {
                                    return <th className="border-b px-3 py-2 text-left font-semibold">{children}</th>;
                                },
                                td({ children }) {
                                    return <td className="border-b px-3 py-2">{children}</td>;
                                },
                                p({ children }) {
                                    return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                ul({ children }) {
                                    return <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>;
                                },
                                ol({ children }) {
                                    return <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}
                    {isActive && message.content && (
                        <span className="bg-primary ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm" />
                    )}
                </div>
                {!isUser && message.toolResults?.length && message.status === 'complete' ? (
                    <ToolResultCards toolResults={message.toolResults} onSelect={onSendMessage} />
                ) : null}
                {!isUser && message.status === 'complete' && (
                    <div className="mt-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground h-6 px-1.5"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(message.content);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
                        </Tooltip>
                    </div>
                )}
            </div>
        </div>
    );
});

// ─── Page ─────────────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Requisitions', href: '/requisition/all' },
    { title: 'AI Agent', href: '/requisition/agent' },
];

const suggestedPrompts = [
    { icon: ShoppingCart, label: 'Order materials', prompt: 'I need to order materials for a project' },
    { icon: Bot, label: 'Reorder from supplier', prompt: 'Help me reorder from HD Supply for one of my projects' },
];

export default function RequisitionAgentPage() {
    const {
        messages,
        isLoading,
        models,
        selectedModel,
        setSelectedModel,
        sendMessage,
        stopGeneration,
        newConversation,
    } = useRequisitionAgent();

    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
        }
    }, [input]);

    const handleSubmit = () => {
        if (!input.trim() || isLoading) return;
        sendMessage(input);
        setInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSuggestedPrompt = (prompt: string) => {
        sendMessage(prompt);
    };

    const isEmpty = messages.length === 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Requisition Agent" />
            <div className="flex h-[calc(100vh-8rem)] flex-col">
                {/* Header bar */}
                <div className="border-b px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="size-5 text-violet-500" />
                        <h1 className="text-sm font-semibold">Requisition Agent</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {models.length > 0 && (
                            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                                <SelectTrigger className="h-8 w-[200px] text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {models.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="text-xs">
                                            <span className="flex items-center gap-2">
                                                <span>{m.name}</span>
                                                <span className="text-muted-foreground">{m.cost}</span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={newConversation} disabled={isLoading}>
                                    <Plus className="size-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>New conversation</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Messages area */}
                <ScrollArea className="flex-1">
                    {isEmpty ? (
                        <div className="flex h-full items-center justify-center p-8">
                            <div className="max-w-md text-center space-y-6">
                                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                                    <Bot className="size-8 text-violet-500" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Requisition Agent</h2>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        Create purchase requisitions through conversation. Tell me what you need to order.
                                    </p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-2">
                                    {suggestedPrompts.map((sp) => (
                                        <Button
                                            key={sp.label}
                                            variant="outline"
                                            size="sm"
                                            className="gap-2 text-xs"
                                            onClick={() => handleSuggestedPrompt(sp.prompt)}
                                        >
                                            <sp.icon className="size-3.5" />
                                            {sp.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="pb-4">
                            {messages.map((msg) => (
                                <AgentMessageBubble key={msg.id} message={msg} onSendMessage={sendMessage} />
                            ))}
                            <div ref={bottomRef} />
                        </div>
                    )}
                </ScrollArea>

                {/* Input area */}
                <div className="border-t p-4">
                    <div className="bg-background mx-auto flex max-w-3xl items-end gap-2 rounded-xl border p-2 shadow-sm focus-within:ring-2 focus-within:ring-violet-500/50">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tell me what you need to order..."
                            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
                            rows={1}
                            disabled={isLoading}
                        />
                        {isLoading ? (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 p-0"
                                onClick={stopGeneration}
                            >
                                <Square className="size-4" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                className="h-8 w-8 shrink-0 p-0 bg-violet-600 hover:bg-violet-700"
                                onClick={handleSubmit}
                                disabled={!input.trim()}
                            >
                                <Send className="size-4" />
                            </Button>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1.5 text-center text-[10px]">
                        AI can make mistakes. Always verify requisition details before confirming.
                    </p>
                </div>
            </div>
        </AppLayout>
    );
}
