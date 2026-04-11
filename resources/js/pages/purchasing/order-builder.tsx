import { DatePickerDemo } from '@/components/date-picker';
import { SearchSelect } from '@/components/search-select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { api } from '@/lib/api';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO } from 'date-fns';
import {
    AlertTriangle,
    ArrowRight,
    ArrowUp,
    Bot,
    Check,
    ChevronsUpDown,
    Copy,
    FileUp,
    Loader2,
    Lock,
    MapPin,
    Package,
    Paperclip,
    Plus,
    Send,
    ShoppingCart,
    Sparkles,
    Square,
    Star,
    Trash2,
    Truck,
    User,
    X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

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
    fileName?: string;
}

interface ModelOption {
    id: string;
    name: string;
    provider: string;
    cost: string;
}

interface DraftHeader {
    location_id?: number;
    location_name?: string;
    supplier_id?: number;
    supplier_name?: string;
    date_required?: string;
    delivery_contact?: string;
    requested_by?: string;
    deliver_to?: string;
    order_reference?: string;
}

interface DraftLineItem {
    serial_number: number;
    code: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    cost_code: string;
    price_list: string;
    is_locked: boolean;
}

type Supplier = { id: number; code: string; name: string };
type Location = {
    id: number;
    name: string;
    external_id: string;
    eh_location_id: string;
    header?: {
        delivery_contact?: string;
        requested_by?: string;
        deliver_to?: string;
        order_reference?: string;
    };
};
type CostCode = { id: number; code: string; description: string };

type OrderBuilderProps = {
    auth: { user: { name: string; phone: string } };
    suppliers: Supplier[];
    locations: Location[];
    costCodes: CostCode[];
};

// ─── API Service ──────────────────────────────────────────────────────────────

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
                    const displayableTools = ['SearchLocations', 'ListSuppliers', 'SearchMaterials', 'UpdateRequisitionDraft'];
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

async function extractFileFromServer(file: File): Promise<{ supplier_name?: string; items: any[]; notes?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/requisition-agent/extract-file', {
        method: 'POST',
        headers: {
            'X-CSRF-TOKEN': getCsrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.extracted;
}

// ─── Chat Hook ────────────────────────────────────────────────────────────────

function useOrderBuilderAgent(onDraftUpdate: (draft: { header: DraftHeader; items: DraftLineItem[] }) => void) {
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [models, setModels] = useState<ModelOption[]>([]);
    const [selectedModel, setSelectedModel] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        fetchModels()
            .then((data) => {
                setModels(data.models);
                setSelectedModel(data.default);
            })
            .catch(() => {});
    }, []);

    const handleToolResults = useCallback(
        (toolResults: ToolResultData[]) => {
            for (const tr of toolResults) {
                if (tr.tool_name === 'UpdateRequisitionDraft' && tr.result?.draft) {
                    onDraftUpdate(tr.result.draft);
                }
            }
        },
        [onDraftUpdate],
    );

    const sendMessage = useCallback(
        async (content: string, fileName?: string) => {
            if (!content.trim() || isLoading) return;

            const userMsg: AgentMessage = {
                id: crypto.randomUUID(),
                role: 'user',
                content: content.trim(),
                timestamp: new Date(),
                status: 'complete',
                fileName,
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
                if (!conversationId) {
                    const result = await sendChat(content.trim(), null, selectedModel);
                    setConversationId(result.conversation_id);
                    if (result.tool_results) handleToolResults(result.tool_results);
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id
                                ? { ...m, content: result.reply, status: 'complete', toolResults: result.tool_results }
                                : m,
                        ),
                    );
                } else {
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
                            handleToolResults([event.data]);
                            const trs = [...toolResults];
                            setMessages((prev) =>
                                prev.map((m) => (m.id === assistantMsg.id ? { ...m, toolResults: trs } : m)),
                            );
                        }
                    }

                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMsg.id
                                ? { ...m, status: 'complete', toolResults: toolResults.length ? toolResults : undefined }
                                : m,
                        ),
                    );
                }
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, status: 'complete' } : m)));
                } else {
                    const errorText = err instanceof Error ? err.message : 'Something went wrong';
                    setMessages((prev) =>
                        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: errorText, status: 'error' } : m)),
                    );
                }
            } finally {
                setIsLoading(false);
                abortRef.current = null;
            }
        },
        [conversationId, isLoading, selectedModel, handleToolResults],
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

// ─── Chat Message Components ──────────────────────────────────────────────────

function ToolResultCards({ toolResults, onSelect }: { toolResults: ToolResultData[]; onSelect: (text: string) => void }) {
    return (
        <div className="mt-2 space-y-2">
            {toolResults.map((tr, i) => {
                if (tr.tool_name === 'UpdateRequisitionDraft') {
                    return (
                        <div key={i} className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <Check className="size-3.5" />
                            Order form updated
                        </div>
                    );
                }
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

function LocationCards({
    locations,
    onSelect,
}: {
    locations: Array<{ id: number; name: string; external_id?: string; state?: string; is_deprecated?: boolean }>;
    onSelect: (text: string) => void;
}) {
    if (locations.length > 8) return null;
    return (
        <div className="grid grid-cols-1 gap-1">
            {locations.map((loc) => (
                <button
                    key={loc.id}
                    onClick={() => onSelect(`Use location: ${loc.name} (ID ${loc.id})`)}
                    className={cn(
                        'flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent',
                        loc.is_deprecated && 'border-dashed opacity-60',
                    )}
                >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
                    <div className="min-w-0">
                        <div className="font-medium leading-tight">{loc.name}</div>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
                            {loc.state && <span>{loc.state}</span>}
                            {loc.external_id && <span>({loc.external_id})</span>}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}

function SupplierCards({
    suppliers,
    onSelect,
}: {
    suppliers: Array<{ id: number; name: string; code?: string }>;
    onSelect: (text: string) => void;
}) {
    if (suppliers.length > 8) return null;
    return (
        <div className="grid grid-cols-1 gap-1">
            {suppliers.map((sup) => (
                <button
                    key={sup.id}
                    onClick={() => onSelect(`Use supplier: ${sup.name} (ID ${sup.id})`)}
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                >
                    <Truck className="size-3.5 shrink-0 text-blue-500" />
                    <div className="min-w-0">
                        <div className="font-medium leading-tight">{sup.name}</div>
                        {sup.code && <div className="text-muted-foreground text-[10px]">{sup.code}</div>}
                    </div>
                </button>
            ))}
        </div>
    );
}

function MaterialCards({
    materials,
    warning,
    onSelect,
}: {
    materials: Array<{ id: number; code: string; description: string; unit_cost: number; price_source: string; cost_code?: string }>;
    warning?: string;
    onSelect: (text: string) => void;
}) {
    if (materials.length > 8) return null;
    return (
        <div className="space-y-1">
            {warning && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="size-3 shrink-0" />
                    {warning}
                </div>
            )}
            <div className="grid grid-cols-1 gap-1">
                {materials.map((mat) => (
                    <button
                        key={mat.id}
                        onClick={() => onSelect(`Add material ${mat.code} - ${mat.description}`)}
                        className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                    >
                        <div className="flex min-w-0 items-center gap-2">
                            <Package className="size-3.5 shrink-0 text-emerald-500" />
                            <div className="min-w-0">
                                <div className="truncate font-medium leading-tight">{mat.description}</div>
                                <div className="text-muted-foreground text-[10px]">{mat.code}</div>
                            </div>
                        </div>
                        <div className="shrink-0 text-right">
                            <div className="font-semibold">${mat.unit_cost.toFixed(2)}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// Streaming shimmer indicator (matches ai-chat design)
function StreamingIndicator() {
    return (
        <div className="flex flex-col gap-[10px] py-1">
            <div className="gemini-line h-[14px] w-[85%] rounded-full" style={{ animationDelay: '0s' }} />
            <div className="gemini-line h-[14px] w-[70%] rounded-full" style={{ animationDelay: '0.15s' }} />
            <div className="gemini-line h-[14px] w-[50%] rounded-full" style={{ animationDelay: '0.3s' }} />
            <style>{`
                @keyframes gemini-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
                .gemini-line {
                    background: linear-gradient(90deg,
                        rgba(66,133,244,0.08) 0%, rgba(155,114,203,0.2) 20%,
                        rgba(217,101,112,0.25) 40%, rgba(155,114,203,0.2) 60%,
                        rgba(66,133,244,0.08) 80%, transparent 100%);
                    background-size: 200% 100%;
                    animation: gemini-shimmer 2s ease-in-out infinite;
                }
                :is(.dark) .gemini-line {
                    background: linear-gradient(90deg,
                        rgba(66,133,244,0.12) 0%, rgba(155,114,203,0.3) 20%,
                        rgba(217,101,112,0.35) 40%, rgba(155,114,203,0.3) 60%,
                        rgba(66,133,244,0.12) 80%, transparent 100%);
                    background-size: 200% 100%;
                    animation: gemini-shimmer 2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

// Smooth word-by-word deblur streaming text (matches ai-chat design)
function SmoothStreamingText({ content }: { content: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const revealedCountRef = useRef(0);
    const rafRef = useRef<number>(0);
    const words = content.split(/(\s+)/);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const spans = container.querySelectorAll<HTMLSpanElement>('span[data-word]');
        let current = revealedCountRef.current;

        const reveal = () => {
            const batch = Math.max(2, Math.ceil((spans.length - current) * 0.15));
            const end = Math.min(current + batch, spans.length);

            for (let i = current; i < end; i++) {
                spans[i].classList.add('gemini-word-visible');
            }

            current = end;
            revealedCountRef.current = current;

            if (current < spans.length) {
                rafRef.current = requestAnimationFrame(reveal);
            }
        };

        rafRef.current = requestAnimationFrame(reveal);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [words.length]);

    return (
        <>
            <div ref={containerRef} className="gemini-smooth-stream whitespace-pre-wrap text-sm leading-relaxed">
                {words.map((word, i) => (
                    <span
                        key={i}
                        data-word
                        className={i < revealedCountRef.current ? 'gemini-word-visible' : ''}
                    >
                        {word}
                    </span>
                ))}
            </div>
            <style>{`
                .gemini-smooth-stream span[data-word] {
                    opacity: 0;
                    filter: blur(6px);
                    transition: opacity 0.3s ease-out, filter 0.3s ease-out;
                    display: inline;
                }
                .gemini-smooth-stream span.gemini-word-visible {
                    opacity: 1;
                    filter: blur(0);
                }
            `}</style>
        </>
    );
}

// Attachment chip for file previews
function AttachmentChip({ file, onRemove }: { file: File; onRemove: () => void }) {
    const isImage = file.type.startsWith('image/');
    const previewUrl = useMemo(() => (isImage ? URL.createObjectURL(file) : null), [file, isImage]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    if (isImage && previewUrl) {
        return (
            <div className="group/att relative size-16 shrink-0 overflow-hidden rounded-lg">
                <img src={previewUrl} alt={file.name} className="size-full object-cover" />
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/att:opacity-100"
                >
                    <X className="size-3" />
                </button>
            </div>
        );
    }

    return (
        <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
            <Paperclip className="text-muted-foreground size-3.5" />
            <span className="max-w-[150px] truncate">{file.name}</span>
            <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground">
                <X className="size-3.5" />
            </button>
        </div>
    );
}

// Extract clickable options from assistant messages.
// Detects markdown list items with bold text like:
//   - **COAST** — Coastal Development
//   - **HD Supply** (HDS003)
// and renders them as clickable buttons below the message.
function ClickableOptions({ content, onSelect }: { content: string; onSelect: (text: string) => void }) {
    const options = useMemo(() => {
        const lines = content.split('\n');
        const opts: { label: string; detail: string; fullText: string }[] = [];

        for (const line of lines) {
            // Match list items like: - **Bold Text** — description  OR  - **Bold Text** (detail)
            const match = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[—–\-:]?\s*(.*)/);
            if (match) {
                const label = match[1].trim();
                const detail = match[2].trim();
                // Skip generic "other" / "none" options
                if (/^(other|none|skip|cancel)$/i.test(label)) continue;
                opts.push({ label, detail, fullText: label });
            }
        }

        return opts;
    }, [content]);

    if (options.length === 0) return null;

    return (
        <div className="mt-3 flex flex-wrap gap-1.5">
            {options.map((opt, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(opt.fullText)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:border-accent-foreground/20"
                >
                    <span>{opt.label}</span>
                    {opt.detail && (
                        <span className="text-muted-foreground text-[10px] font-normal">{opt.detail.length > 30 ? opt.detail.slice(0, 30) + '...' : opt.detail}</span>
                    )}
                </button>
            ))}
        </div>
    );
}

const ChatBubble = memo(function ChatBubble({
    message,
    onSendMessage,
}: {
    message: AgentMessage;
    onSendMessage: (text: string) => void;
}) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const isStreaming = message.status === 'streaming';
    const isActive = message.status === 'thinking' || isStreaming;
    const isError = message.status === 'error';

    return (
        <div className={cn('group relative flex gap-3 px-4 py-4 transition-colors', isUser ? 'bg-transparent' : 'bg-muted/30')}>
            {/* Avatar — matches ai-chat/chat-message.tsx */}
            <div className="flex-shrink-0">
                <Avatar className={cn('size-8', isUser ? 'bg-primary' : 'border-border bg-background border')}>
                    <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-foreground')}>
                        {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
                    </AvatarFallback>
                </Avatar>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{isUser ? 'You' : 'Order Assistant'}</span>
                </div>

                {/* File attachment badge */}
                {message.fileName && (
                    <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
                        <FileUp className="text-muted-foreground size-3.5" />
                        <span className="max-w-[200px] truncate">{message.fileName}</span>
                    </div>
                )}

                {/* Message content */}
                <div className={cn('prose prose-sm dark:prose-invert max-w-none', isError && 'text-destructive')}>
                    {isActive && !message.content ? (
                        <StreamingIndicator />
                    ) : isStreaming ? (
                        <SmoothStreamingText content={message.content} />
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                code({ className, children }) {
                                    if (!className) {
                                        return (
                                            <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                                                {children}
                                            </code>
                                        );
                                    }
                                    return <code className={className}>{children}</code>;
                                },
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                                table({ children }) {
                                    return (
                                        <div className="my-4 overflow-x-auto rounded-lg border">
                                            <table className="w-full text-sm">{children}</table>
                                        </div>
                                    );
                                },
                                thead({ children }) {
                                    return <thead className="bg-muted/50">{children}</thead>;
                                },
                                th({ children }) {
                                    return <th className="border-b px-4 py-2 text-left font-semibold">{children}</th>;
                                },
                                td({ children }) {
                                    return <td className="border-b px-4 py-2">{children}</td>;
                                },
                                a({ href, children }) {
                                    return (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                            {children}
                                        </a>
                                    );
                                },
                                ul({ children }) {
                                    return <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>;
                                },
                                ol({ children }) {
                                    return <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>;
                                },
                                p({ children }) {
                                    return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                blockquote({ children }) {
                                    return <blockquote className="border-primary/50 my-2 border-l-4 pl-4 italic">{children}</blockquote>;
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}
                </div>

                {/* Tool result cards */}
                {!isUser && message.toolResults?.length && message.status === 'complete' ? (
                    <ToolResultCards toolResults={message.toolResults} onSelect={onSendMessage} />
                ) : null}

                {/* Clickable option buttons parsed from markdown lists */}
                {!isUser && message.status === 'complete' && message.content && (
                    <ClickableOptions content={message.content} onSelect={onSendMessage} />
                )}

                {/* Copy button on hover */}
                {!isUser && message.status === 'complete' && message.content && (
                    <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground h-7 px-2"
                                    onClick={async () => {
                                        await navigator.clipboard.writeText(message.content);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                >
                                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
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

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function ChatPanel({
    messages,
    isLoading,
    models,
    selectedModel,
    setSelectedModel,
    sendMessage,
    stopGeneration,
    newConversation,
}: {
    messages: AgentMessage[];
    isLoading: boolean;
    models: ModelOption[];
    selectedModel: string;
    setSelectedModel: (m: string) => void;
    sendMessage: (content: string, fileName?: string) => void;
    stopGeneration: () => void;
    newConversation: () => void;
}) {
    const [input, setInput] = useState('');
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        }
    }, [input]);

    const handleFileUpload = async (file: File) => {
        setAttachedFile(file);
        setExtracting(true);
        try {
            const extracted = await extractFileFromServer(file);
            const itemSummary = extracted.items
                ?.map((item: any) => `${item.description} (qty: ${item.qty}, $${item.unit_cost})`)
                .join(', ');
            const prompt = [
                `I've uploaded a quote from ${extracted.supplier_name || 'a supplier'}.`,
                extracted.items?.length ? `Extracted ${extracted.items.length} items: ${itemSummary}` : '',
                extracted.notes ? `Notes: ${extracted.notes}` : '',
                `\nExtracted data: ${JSON.stringify(extracted)}`,
                '\nPlease add these items to the order form. Look up proper material codes and pricing.',
            ]
                .filter(Boolean)
                .join('\n');

            sendMessage(prompt, file.name);
            setAttachedFile(null);
        } catch (err) {
            toast.error('Failed to extract file', {
                description: err instanceof Error ? err.message : 'Unknown error',
            });
            setAttachedFile(null);
        } finally {
            setExtracting(false);
        }
    };

    const handleSubmit = () => {
        if (extracting) return;
        if (!input.trim() && !attachedFile) return;
        if (isLoading) return;

        if (attachedFile) {
            handleFileUpload(attachedFile);
            setInput('');
            return;
        }

        sendMessage(input);
        setInput('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && /\.(jpg|jpeg|png|pdf|webp)$/i.test(file.name)) {
            setAttachedFile(file);
        }
    };

    const isEmpty = messages.length === 0;

    const suggestedPrompts = [
        { icon: ShoppingCart, label: 'Order materials', prompt: 'I need to order materials for a project' },
        { icon: FileUp, label: 'Upload a quote', prompt: null },
        { icon: Bot, label: 'Reorder from supplier', prompt: 'Help me reorder from a supplier' },
    ];

    return (
        <div className="flex h-full flex-col">
            {/* Chat header */}
            <div className="flex items-center justify-between border-b px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                        <Sparkles className="size-3.5 text-white" />
                    </div>
                    <span className="text-sm font-semibold">Order Assistant</span>
                </div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={newConversation} disabled={isLoading}>
                            <Plus className="size-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>New conversation</TooltipContent>
                </Tooltip>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
                {isEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center px-4 py-8">
                        {/* Logo */}
                        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                            <Sparkles className="size-8 text-white" />
                        </div>

                        <h2 className="mb-2 text-center text-xl font-semibold tracking-tight">Order Builder</h2>
                        <p className="text-muted-foreground mb-8 max-w-sm text-center text-sm">
                            Build a purchase order through conversation, or upload a supplier quote to extract line items.
                        </p>

                        {/* Suggested prompts — card style matching ai-chat */}
                        <div className="flex w-full max-w-sm flex-col gap-2">
                            {suggestedPrompts.map((sp) => (
                                <Button
                                    key={sp.label}
                                    variant="outline"
                                    className="group h-auto justify-start gap-3 px-4 py-3 text-left"
                                    onClick={() => {
                                        if (sp.prompt) {
                                            sendMessage(sp.prompt);
                                        } else {
                                            fileInputRef.current?.click();
                                        }
                                    }}
                                >
                                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                                        <sp.icon className="text-muted-foreground size-4" />
                                    </div>
                                    <span className="flex-1 text-sm">{sp.label}</span>
                                    <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="pb-2">
                        {messages.map((msg) => (
                            <ChatBubble key={msg.id} message={msg} onSendMessage={sendMessage} />
                        ))}
                        <div ref={bottomRef} />
                    </div>
                )}
            </ScrollArea>

            {/* Gemini-style input area */}
            <div
                className="p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.webp"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setAttachedFile(file);
                        e.target.value = '';
                    }}
                />

                {/* Outer wrapper — gradient border */}
                <div className="relative rounded-[28px] p-[2px]">
                    {/* Animated conic gradient border */}
                    <div
                        className={cn(
                            'gemini-border absolute inset-0 rounded-[28px] transition-opacity duration-500',
                            isFocused ? 'opacity-100' : 'opacity-0',
                        )}
                    />
                    {/* Soft glow */}
                    <div
                        className={cn(
                            'gemini-border absolute inset-0 rounded-[28px] blur-md transition-opacity duration-500',
                            isFocused ? 'opacity-50' : 'opacity-0',
                        )}
                    />

                    {/* Inner card */}
                    <div className={cn(
                        'relative rounded-[26px] transition-all duration-300',
                        'bg-card',
                        !isFocused && 'border border-border/80',
                        'shadow-sm',
                        isFocused && 'shadow-lg',
                    )}>
                        {/* Attachment preview */}
                        {attachedFile && (
                            <div className="flex flex-wrap gap-2 px-4 pt-3">
                                <AttachmentChip file={attachedFile} onRemove={() => setAttachedFile(null)} />
                                {extracting && <Loader2 className="mt-1 size-4 animate-spin text-violet-500" />}
                            </div>
                        )}

                        {/* Textarea */}
                        <div className="relative px-4 pt-3 pb-1.5">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                placeholder={attachedFile ? 'Add a message or press Enter to extract...' : 'Describe what you need to order...'}
                                disabled={isLoading || extracting}
                                className={cn(
                                    'max-h-[160px] min-h-[24px] w-full resize-none bg-transparent text-sm leading-relaxed outline-none',
                                    'placeholder:text-muted-foreground/50',
                                    'disabled:cursor-not-allowed disabled:opacity-50',
                                )}
                                rows={1}
                            />
                        </div>

                        {/* Bottom toolbar */}
                        <div className="relative flex items-center justify-between px-3 pb-2.5">
                            <div className="flex items-center gap-1">
                                {/* Attachment button */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-full transition-colors"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isLoading || extracting}
                                        >
                                            <Paperclip className="size-[18px]" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Attach quote (PDF/image)</TooltipContent>
                                </Tooltip>
                            </div>

                            {/* Submit/Stop button */}
                            {isLoading ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="bg-foreground text-background flex size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/90"
                                            onClick={stopGeneration}
                                        >
                                            <Square className="size-3.5" fill="currentColor" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Stop generating</TooltipContent>
                                </Tooltip>
                            ) : (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className={cn(
                                                'flex size-8 items-center justify-center rounded-full transition-all',
                                                (input.trim() || attachedFile) && !extracting
                                                    ? 'bg-foreground text-background hover:bg-foreground/90'
                                                    : 'bg-muted-foreground/20 text-muted-foreground cursor-not-allowed',
                                            )}
                                            onClick={handleSubmit}
                                            disabled={(!input.trim() && !attachedFile) || extracting}
                                        >
                                            <ArrowUp className="size-[18px]" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>{input.trim() || attachedFile ? 'Send message' : 'Type a message'}</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                </div>

                {/* Model selector below input */}
                <div className="mt-1.5 flex items-center justify-between px-1">
                    <div>
                        {models.length > 0 && (
                            <Select value={selectedModel} onValueChange={setSelectedModel} disabled={isLoading}>
                                <SelectTrigger className="h-7 w-[150px] rounded-full border-0 bg-transparent text-[10px] shadow-none hover:bg-muted">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {models.map((m) => (
                                        <SelectItem key={m.id} value={m.id} className="text-xs">
                                            {m.name} <span className="text-muted-foreground">{m.cost}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <p className="text-muted-foreground text-[9px]">AI can make mistakes</p>
                </div>

                {/* Gemini gradient animation */}
                <style>{`
                    @property --gemini-angle {
                        syntax: '<angle>';
                        initial-value: 0deg;
                        inherits: false;
                    }
                    @keyframes gemini-spin {
                        to { --gemini-angle: 360deg; }
                    }
                    .gemini-border {
                        background: conic-gradient(
                            from var(--gemini-angle),
                            #4285f4, #9b72cb, #d96570,
                            #d96570, #9b72cb, #4285f4
                        );
                        animation: gemini-spin 3s linear infinite;
                    }
                `}</style>
            </div>
        </div>
    );
}

// ─── Material Search Select ───────────────────────────────────────────────────

function MaterialSearchSelect({
    value,
    onSelect,
    supplierId,
    locationId,
}: {
    value: string;
    onSelect: (item: { id: number; code: string; description: string; unit_cost: number; cost_code: string; price_list: string; is_locked: boolean }) => void;
    supplierId?: number;
    locationId?: number;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !supplierId) return;
        const fetchItems = async () => {
            setLoading(true);
            try {
                const data = await api.get<any[]>('/material-items', {
                    params: {
                        search,
                        supplier_id: String(supplierId),
                        location_id: locationId ? String(locationId) : undefined,
                    },
                });
                setItems(data);
            } catch {
                setItems([]);
            } finally {
                setLoading(false);
            }
        };
        const debounce = setTimeout(fetchItems, 300);
        return () => clearTimeout(debounce);
    }, [search, open, supplierId, locationId]);

    const handleSelect = async (itemId: number) => {
        try {
            const res = await fetch(`/material-items/${itemId}/${locationId || 0}`);
            if (res.ok) {
                const data = await res.json();
                onSelect({
                    id: data.id,
                    code: data.code,
                    description: data.description,
                    unit_cost: data.unit_cost,
                    cost_code: data.cost_code || '',
                    price_list: data.price_list || '',
                    is_locked: data.is_locked ?? false,
                });
            }
        } catch { /* ignore */ }
        setOpen(false);
        setSearch('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-7 w-full justify-between text-xs">
                    <span className="truncate">{value || 'Search material...'}</span>
                    <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Search code or description..."
                        className="h-9 text-xs"
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="mr-2 size-3.5 animate-spin" />
                                <span className="text-xs">Loading...</span>
                            </div>
                        ) : (
                            <>
                                <CommandEmpty className="py-3 text-center text-xs">
                                    {!supplierId ? 'Select a supplier first' : 'No items found'}
                                </CommandEmpty>
                                <CommandGroup>
                                    {items.map((item) => (
                                        <CommandItem
                                            key={item.id}
                                            value={`${item.code} ${item.description}`}
                                            onSelect={() => handleSelect(item.id)}
                                            className="text-xs"
                                        >
                                            <div className="flex w-full items-center justify-between">
                                                <div className="min-w-0">
                                                    <div className="font-medium">{item.code}</div>
                                                    <div className="text-muted-foreground truncate text-[10px]">{item.description}</div>
                                                </div>
                                                <div className="ml-2 shrink-0 text-right">
                                                    <div className="font-medium">${Number(item.unit_cost).toFixed(2)}</div>
                                                    {item.is_favourite && <Star className="size-3 fill-yellow-500 text-yellow-500" />}
                                                </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Cost Code Inline Selector ────────────────────────────────────────────────

function CostCodeSelect({
    value,
    onValueChange,
    costCodes,
}: {
    value: string;
    onValueChange: (val: string) => void;
    costCodes: CostCode[];
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = costCodes
        .filter((cc) => `${cc.code} ${cc.description}`.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.code.localeCompare(b.code));

    const selected = costCodes.find((cc) => cc.code === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="h-7 w-full justify-between text-xs">
                    <span className="truncate">{selected ? `${selected.code} - ${selected.description}` : 'Select cost code...'}</span>
                    <ChevronsUpDown className="ml-1 size-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search code..." className="h-9 text-xs" value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty className="py-3 text-center text-xs">No matching cost codes.</CommandEmpty>
                        <CommandGroup>
                            {filtered.map((cc) => (
                                <CommandItem
                                    key={cc.id}
                                    value={`${cc.code} ${cc.description}`}
                                    onSelect={() => {
                                        onValueChange(cc.code);
                                        setSearch('');
                                        setOpen(false);
                                    }}
                                    className="text-xs"
                                >
                                    <div className="flex flex-col">
                                        <span className="font-medium">{cc.code}</span>
                                        <span className="text-muted-foreground text-[10px]">{cc.description}</span>
                                    </div>
                                    <Check className={cn('ml-auto size-3', value === cc.code ? 'opacity-100' : 'opacity-0')} />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Order Form Panel ─────────────────────────────────────────────────────────

function OrderFormPanel({
    suppliers,
    locations,
    costCodes,
    header,
    setHeader,
    lineItems,
    setLineItems,
    onSubmit,
    isSubmitting,
}: {
    suppliers: Supplier[];
    locations: Location[];
    costCodes: CostCode[];
    header: DraftHeader;
    setHeader: (h: DraftHeader) => void;
    lineItems: DraftLineItem[];
    setLineItems: (items: DraftLineItem[]) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}) {
    const totalAmount = lineItems.reduce((sum, item) => sum + (item.total_cost || 0), 0);

    const updateHeader = (field: keyof DraftHeader, value: any) => {
        setHeader({ ...header, [field]: value });
    };

    const updateLineItem = (index: number, field: keyof DraftLineItem, value: any) => {
        const updated = [...lineItems];
        (updated[index] as any)[field] = value;
        if (field === 'qty' || field === 'unit_cost') {
            updated[index].total_cost = (updated[index].qty || 0) * (updated[index].unit_cost || 0);
        }
        setLineItems(updated);
    };

    const addEmptyRow = () => {
        setLineItems([
            ...lineItems,
            {
                serial_number: lineItems.length + 1,
                code: '',
                description: '',
                qty: 1,
                unit_cost: 0,
                total_cost: 0,
                cost_code: '',
                price_list: '',
                is_locked: false,
            },
        ]);
    };

    const removeRow = (index: number) => {
        setLineItems(lineItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, serial_number: i + 1 })));
    };

    const locationOptions = locations.map((l) => ({ value: String(l.id), label: l.name }));
    const supplierOptions = suppliers.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` }));

    const handleLocationChange = (val: string) => {
        updateHeader('location_id', Number(val));
        const loc = locations.find((l) => String(l.id) === val);
        if (loc) {
            updateHeader('location_name', loc.name);
            if (loc.header) {
                setHeader({
                    ...header,
                    location_id: Number(val),
                    location_name: loc.name,
                    delivery_contact: loc.header.delivery_contact || header.delivery_contact,
                    requested_by: loc.header.requested_by || header.requested_by,
                    deliver_to: loc.header.deliver_to || header.deliver_to,
                    order_reference: loc.header.order_reference || header.order_reference,
                });
            }
        }
    };

    const handleSupplierChange = (val: string) => {
        const sup = suppliers.find((s) => String(s.id) === val);
        setHeader({
            ...header,
            supplier_id: Number(val),
            supplier_name: sup?.name,
        });
    };

    return (
        <div className="flex h-full flex-col">
            {/* Form header */}
            <div className="flex items-center justify-between border-b px-4 py-2">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-emerald-500" />
                    <span className="text-xs font-semibold">Order Form</span>
                </div>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>
                        <span className="font-medium tabular-nums">{lineItems.length}</span> items
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-semibold tabular-nums">
                        ${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Scrollable form body */}
            <ScrollArea className="flex-1">
                <div className="space-y-4 p-4">
                    {/* Header fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <Label className="text-xs">Location / Project</Label>
                            <SearchSelect
                                options={locationOptions}
                                optionName="location"
                                selectedOption={String(header.location_id || '')}
                                onValueChange={handleLocationChange}
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-xs">Supplier</Label>
                            <SearchSelect
                                options={supplierOptions}
                                optionName="supplier"
                                selectedOption={String(header.supplier_id || '')}
                                onValueChange={handleSupplierChange}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Date Required</Label>
                            <DatePickerDemo
                                value={header.date_required ? parseISO(header.date_required) : undefined}
                                onChange={(date) => updateHeader('date_required', date ? format(date, 'yyyy-MM-dd') : '')}
                                placeholder="Pick a date"
                                fromDate={new Date()}
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Delivery Contact</Label>
                            <Input
                                value={header.delivery_contact || ''}
                                onChange={(e) => updateHeader('delivery_contact', e.target.value)}
                                placeholder="Contact name"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Requested By</Label>
                            <Input
                                value={header.requested_by || ''}
                                onChange={(e) => updateHeader('requested_by', e.target.value)}
                                placeholder="Your name"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">Deliver To</Label>
                            <Input
                                value={header.deliver_to || ''}
                                onChange={(e) => updateHeader('deliver_to', e.target.value)}
                                placeholder="Delivery address"
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="col-span-2">
                            <Label className="text-xs">Order Reference</Label>
                            <Input
                                value={header.order_reference || ''}
                                onChange={(e) => updateHeader('order_reference', e.target.value)}
                                placeholder="Optional reference"
                                className="h-9 text-sm"
                                maxLength={80}
                            />
                        </div>
                    </div>

                    {/* Line items */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <Label className="text-xs font-semibold">Line Items</Label>
                            <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px]" onClick={addEmptyRow}>
                                <Plus className="size-3" />
                                Add Row
                            </Button>
                        </div>

                        {lineItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
                                <Package className="text-muted-foreground/50 mb-2 size-8" />
                                <p className="text-muted-foreground text-xs">No items yet</p>
                                <p className="text-muted-foreground mt-0.5 text-[10px]">
                                    Use the chat to add items, upload a quote, or add manually.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {lineItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="group relative rounded-lg border p-3 transition-colors hover:bg-muted/30"
                                    >
                                        {/* Row header: line number, code badge, price source, lock, delete */}
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <Badge variant="secondary" className="h-5 min-w-[20px] justify-center px-1.5 text-[10px]">
                                                    {item.serial_number}
                                                </Badge>
                                                {item.code && (
                                                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{item.code}</span>
                                                )}
                                                {item.is_locked && (
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <Lock className="size-3 text-amber-500" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>Location locked price</TooltipContent>
                                                    </Tooltip>
                                                )}
                                                {/* Price list source badge */}
                                                {item.price_list && (
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'h-4 text-[9px]',
                                                            item.price_list === 'base_price'
                                                                ? 'text-amber-600 dark:text-amber-400'
                                                                : 'text-emerald-600 dark:text-emerald-400',
                                                        )}
                                                    >
                                                        {item.price_list === 'base_price' ? 'Base Price' : item.price_list}
                                                    </Badge>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-destructive h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                                                onClick={() => removeRow(index)}
                                            >
                                                <Trash2 className="size-3" />
                                            </Button>
                                        </div>

                                        {/* Material selector */}
                                        <div className="mb-2">
                                            <Label className="text-[10px]">Material</Label>
                                            <MaterialSearchSelect
                                                value={item.code ? `${item.code} - ${item.description}` : ''}
                                                supplierId={header.supplier_id}
                                                locationId={header.location_id}
                                                onSelect={(mat) => {
                                                    const updated = [...lineItems];
                                                    updated[index] = {
                                                        ...updated[index],
                                                        code: mat.code,
                                                        description: mat.description,
                                                        unit_cost: mat.unit_cost,
                                                        cost_code: mat.cost_code,
                                                        price_list: mat.price_list,
                                                        is_locked: mat.is_locked,
                                                        total_cost: (updated[index].qty || 1) * mat.unit_cost,
                                                    };
                                                    setLineItems(updated);
                                                }}
                                            />
                                        </div>

                                        {/* Description (editable, separate from material search) */}
                                        <div className="mb-2">
                                            <Label className="text-[10px]">Description</Label>
                                            <Input
                                                value={item.description}
                                                onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                                                placeholder="Item description"
                                                className="h-8 text-sm"
                                            />
                                        </div>

                                        {/* Qty, Unit Cost, Total */}
                                        <div className="mb-2 grid grid-cols-3 gap-2">
                                            <div>
                                                <Label className="text-[10px]">Qty</Label>
                                                <Input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => updateLineItem(index, 'qty', parseFloat(e.target.value) || 0)}
                                                    className="h-7 text-xs"
                                                    step="any"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[10px]">Unit Cost</Label>
                                                <Input
                                                    type="number"
                                                    value={item.unit_cost}
                                                    onChange={(e) => updateLineItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                                                    className="h-7 text-xs"
                                                    step="any"
                                                    disabled={item.is_locked}
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-[10px]">Total</Label>
                                                <div className="flex h-7 items-center rounded-md border bg-muted/50 px-2 text-xs font-medium">
                                                    ${item.total_cost.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cost Code selector */}
                                        <div>
                                            <Label className="text-[10px]">Cost Code</Label>
                                            <CostCodeSelect
                                                value={item.cost_code}
                                                onValueChange={(val) => updateLineItem(index, 'cost_code', val)}
                                                costCodes={costCodes}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Submit footer */}
            <div className="border-t p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Order Total</span>
                    <span className="text-lg font-bold tabular-nums">
                        ${totalAmount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <Button
                    className="w-full gap-2"
                    onClick={onSubmit}
                    disabled={isSubmitting || !header.location_id || !header.supplier_id || lineItems.length === 0}
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Send className="size-4" />
                            Submit Requisition
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Requisitions', href: '/requisition/all' },
    { title: 'Order Builder', href: '/requisition/order-builder' },
];

export default function OrderBuilder() {
    const { suppliers, locations, costCodes, auth } = usePage<OrderBuilderProps>().props;

    const [header, setHeader] = useState<DraftHeader>({
        requested_by: `${auth.user.name} ${auth.user.phone}`,
        date_required: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleDraftUpdate = useCallback(
        (draft: { header: DraftHeader; items: DraftLineItem[] }) => {
            setHeader((prev) => {
                const merged = { ...prev };
                const h = draft.header;
                if (h.location_id) merged.location_id = h.location_id;
                if (h.location_name) merged.location_name = h.location_name;
                if (h.supplier_id) merged.supplier_id = h.supplier_id;
                if (h.supplier_name) merged.supplier_name = h.supplier_name;
                if (h.date_required) merged.date_required = h.date_required;
                if (h.delivery_contact) merged.delivery_contact = h.delivery_contact;
                if (h.requested_by) merged.requested_by = h.requested_by;
                if (h.deliver_to) merged.deliver_to = h.deliver_to;
                if (h.order_reference !== undefined) merged.order_reference = h.order_reference;
                return merged;
            });
            if (draft.items?.length) {
                setLineItems(draft.items);
            }
        },
        [],
    );

    const {
        messages,
        isLoading,
        models,
        selectedModel,
        setSelectedModel,
        sendMessage,
        stopGeneration,
        newConversation,
    } = useOrderBuilderAgent(handleDraftUpdate);

    const handleSubmit = () => {
        if (!header.location_id || !header.supplier_id || lineItems.length === 0) {
            toast.error('Please fill in location, supplier, and at least one line item');
            return;
        }

        setIsSubmitting(true);

        const formData = {
            project_id: String(header.location_id),
            supplier_id: String(header.supplier_id),
            date_required: header.date_required || '',
            delivery_contact: header.delivery_contact || '',
            requested_by: header.requested_by || '',
            deliver_to: header.deliver_to || '',
            order_reference: header.order_reference || '',
            items: lineItems.map((item, index) => ({
                code: item.code,
                description: item.description,
                qty: item.qty,
                unit_cost: item.unit_cost,
                total_cost: item.total_cost,
                cost_code: item.cost_code,
                price_list: item.price_list,
                serial_number: index + 1,
                is_locked: item.is_locked,
            })),
        };

        router.post('/requisition/store', formData, {
            onSuccess: () => {
                toast.success('Requisition created successfully');
                setIsSubmitting(false);
            },
            onError: (errors) => {
                const firstError = Object.values(errors)[0];
                toast.error('Validation error', { description: String(firstError) });
                setIsSubmitting(false);
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Order Builder" />
            <div className="h-[calc(100vh-4rem)]">
                <ResizablePanelGroup direction="horizontal">
                    {/* Chat Panel */}
                    <ResizablePanel defaultSize={45} minSize={30}>
                        <ChatPanel
                            messages={messages}
                            isLoading={isLoading}
                            models={models}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            sendMessage={sendMessage}
                            stopGeneration={stopGeneration}
                            newConversation={newConversation}
                        />
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Order Form Panel */}
                    <ResizablePanel defaultSize={55} minSize={35}>
                        <OrderFormPanel
                            suppliers={suppliers}
                            locations={locations}
                            costCodes={costCodes}
                            header={header}
                            setHeader={setHeader}
                            lineItems={lineItems}
                            setLineItems={setLineItems}
                            onSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                        />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </AppLayout>
    );
}
