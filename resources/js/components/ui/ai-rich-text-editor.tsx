import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';
import {
    ArrowLeft,
    Bold,
    Check,
    ClipboardCopy,
    CornerDownLeft,
    FileText,
    Heading2,
    Italic,
    List,
    ListOrdered,
    Minimize2,
    Paperclip,
    Redo,
    RefreshCw,
    RotateCcw,
    SpellCheck,
    Sparkles,
    Underline as UnderlineIcon,
    Undo,
    WandSparkles,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AiRichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    enableAttachments?: boolean;
    attachments?: File[];
    onAttachmentsChange?: (files: File[]) => void;
}

type AiAction = 'summarize' | 'proofread' | 'rephrase' | 'improve' | 'shorten' | 'write';

const ACTION_LABELS: Record<AiAction, string> = {
    summarize: 'Summarize',
    proofread: 'Proof read',
    rephrase: 'Rephrase',
    improve: 'Improve text',
    shorten: 'Shorten text',
    write: 'Write with AI',
};

const ACTION_ICONS: Record<AiAction, typeof Sparkles> = {
    summarize: FileText,
    proofread: SpellCheck,
    rephrase: RefreshCw,
    improve: Sparkles,
    shorten: Minimize2,
    write: WandSparkles,
};

function getPlainText(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function streamAiText(
    action: AiAction,
    text: string | null,
    prompt: string | null,
    onChunk: (chunk: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
): AbortController {
    const controller = new AbortController();
    const csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';

    fetch('/ai-text/stream', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken,
            Accept: 'text/event-stream',
        },
        credentials: 'same-origin',
        signal: controller.signal,
        body: JSON.stringify({ action, text, prompt }),
    })
        .then(async (res) => {
            if (!res.ok) {
                const err = await res.json().catch(() => ({ message: 'Request failed' }));
                onError(err.message || 'Request failed');
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                onError('No stream reader');
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith('data: ')) continue;
                    const data = trimmed.slice(6);
                    if (data === '[DONE]') {
                        onDone();
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) {
                            onError(parsed.error);
                            return;
                        }
                        if (parsed.content) onChunk(parsed.content);
                    } catch {
                        // skip
                    }
                }
            }
            onDone();
        })
        .catch((err) => {
            if (err.name !== 'AbortError') {
                onError(err.message || 'Network error');
            }
        });

    return controller;
}

export default function AiRichTextEditor({ content, onChange, placeholder, enableAttachments, attachments, onAttachmentsChange }: AiRichTextEditorProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiPreview, setAiPreview] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<AiAction | null>(null);
    const [promptMode, setPromptMode] = useState<'write' | 'rephrase' | null>(null);
    const [promptValue, setPromptValue] = useState('');
    const [lastActionPrompt, setLastActionPrompt] = useState<string | null>(null);
    const contentBeforeAi = useRef<string>('');
    const abortRef = useRef<AbortController | null>(null);
    const streamedHtml = useRef('');
    const promptInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] } }),
            Underline,
            Placeholder.configure({ placeholder: placeholder ?? 'Start typing...' }),
        ],
        content,
        onUpdate: ({ editor }) => {
            if (!aiLoading && aiPreview === null) {
                onChange(editor.getHTML());
            }
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2 dark:prose-invert',
            },
        },
    });

    useEffect(() => {
        if (editor && content !== editor.getHTML() && !aiLoading && aiPreview === null) {
            editor.commands.setContent(content);
        }
    }, [content]);

    // Focus the prompt input when entering prompt mode
    useEffect(() => {
        if (promptMode) {
            setTimeout(() => promptInputRef.current?.focus(), 50);
        }
    }, [promptMode]);

    const runAiAction = useCallback(
        (action: AiAction, prompt?: string) => {
            if (!editor) return;
            const currentHtml = editor.getHTML();
            const plainText = getPlainText(currentHtml);
            if (action !== 'write' && !plainText.trim()) return;

            contentBeforeAi.current = currentHtml;
            setActiveAction(action);
            setLastActionPrompt(prompt || null);
            setAiLoading(true);
            setAiError(null);
            setAiPreview('');
            streamedHtml.current = '';

            abortRef.current = streamAiText(
                action,
                action === 'write' ? null : plainText,
                prompt || null,
                (chunk) => {
                    streamedHtml.current += chunk;
                    setAiPreview(streamedHtml.current);
                },
                () => setAiLoading(false),
                (err) => {
                    setAiLoading(false);
                    setAiError(err);
                },
            );
        },
        [editor],
    );

    const acceptAi = useCallback(() => {
        if (!editor || aiPreview === null) return;
        editor.commands.setContent(aiPreview);
        editor.setEditable(true);
        onChange(aiPreview);
        setAiPreview(null);
        setAiError(null);
        setActiveAction(null);
        setPromptMode(null);
    }, [editor, aiPreview, onChange]);

    const rejectAi = useCallback(() => {
        if (!editor) return;
        abortRef.current?.abort();
        editor.commands.setContent(contentBeforeAi.current);
        editor.setEditable(true);
        setAiPreview(null);
        setAiLoading(false);
        setAiError(null);
        setActiveAction(null);
    }, [editor]);

    const retryAi = useCallback(() => {
        if (!activeAction) return;
        abortRef.current?.abort();
        setAiLoading(true);
        setAiError(null);
        setAiPreview('');
        streamedHtml.current = '';

        const plainText = getPlainText(contentBeforeAi.current);
        abortRef.current = streamAiText(
            activeAction,
            activeAction === 'write' ? null : plainText,
            lastActionPrompt,
            (chunk) => {
                streamedHtml.current += chunk;
                setAiPreview(streamedHtml.current);
            },
            () => setAiLoading(false),
            (err) => {
                setAiLoading(false);
                setAiError(err);
            },
        );
    }, [activeAction, lastActionPrompt]);

    const copyAi = useCallback(() => {
        if (aiPreview) navigator.clipboard.writeText(getPlainText(aiPreview));
    }, [aiPreview]);

    const handlePromptSubmit = useCallback(() => {
        if (!promptValue.trim() || !promptMode) return;
        runAiAction(promptMode, promptValue);
        setPromptValue('');
    }, [promptValue, promptMode, runAiAction]);

    const exitPromptMode = useCallback(() => {
        setPromptMode(null);
        setPromptValue('');
    }, []);

    if (!editor) return null;

    const hasContent = getPlainText(editor.getHTML()).trim().length > 0;
    const showAiPanel = aiPreview !== null || aiLoading;
    const inPromptMode = promptMode !== null;
    const promptPlaceholder = promptMode === 'rephrase'
        ? 'e.g. Make it more formal...'
        : 'Describe your message and what it should include...';

    return (
        <TooltipProvider delayDuration={300}>
        <div className="rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] dark:bg-input/30 overflow-hidden">
            {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/40 px-1 py-1">
                    <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()} aria-label="Bold" disabled={showAiPanel || inPromptMode}>
                        <Bold className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic" disabled={showAiPanel || inPromptMode}>
                        <Italic className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline" disabled={showAiPanel || inPromptMode}>
                        <UnderlineIcon className="h-4 w-4" />
                    </Toggle>
                    <div className="mx-1 h-5 w-px bg-border hidden sm:block" />
                    <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="Heading" disabled={showAiPanel || inPromptMode} className="hidden sm:inline-flex">
                        <Heading2 className="h-4 w-4" />
                    </Toggle>
                    <div className="mx-1 h-5 w-px bg-border hidden sm:block" />
                    <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list" disabled={showAiPanel || inPromptMode}>
                        <List className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Ordered list" disabled={showAiPanel || inPromptMode}>
                        <ListOrdered className="h-4 w-4" />
                    </Toggle>
                    <div className="mx-1 h-5 w-px bg-border hidden sm:block" />
                    <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || showAiPanel || inPromptMode} aria-label="Undo" className="hidden sm:inline-flex">
                        <Undo className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || showAiPanel || inPromptMode} aria-label="Redo" className="hidden sm:inline-flex">
                        <Redo className="h-4 w-4" />
                    </Toggle>
                </div>

                {/* Prompt mode (write / rephrase) — replaces editor */}
                {inPromptMode && !showAiPanel ? (
                    <div className="px-3 py-3 min-h-[80px] flex flex-col justify-center">
                        <div className="flex items-center gap-2">
                            <WandSparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                            <input
                                ref={promptInputRef}
                                type="text"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                placeholder={promptPlaceholder}
                                value={promptValue}
                                onChange={(e) => setPromptValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && promptValue.trim()) handlePromptSubmit();
                                    if (e.key === 'Escape') exitPromptMode();
                                }}
                            />
                            {promptValue.trim() && (
                                <Button size="sm" className="h-7 gap-1 text-xs shrink-0" onClick={handlePromptSubmit}>
                                    <CornerDownLeft className="h-3 w-3" />
                                    {promptMode === 'rephrase' ? 'Rephrase' : 'Generate'}
                                </Button>
                            )}
                        </div>
                        <button
                            onClick={exitPromptMode}
                            className="mt-2 text-xs text-muted-foreground hover:text-foreground self-start"
                        >
                            Press Esc to cancel
                        </button>
                    </div>
                ) : !showAiPanel ? (
                    <EditorContent editor={editor} />
                ) : null}

                {/* Attachment previews */}
                {enableAttachments && attachments && attachments.length > 0 && !showAiPanel && (
                    <div className="flex flex-wrap gap-2 px-3 py-2">
                        {attachments.map((file, i) =>
                            file.type.startsWith('image/') ? (
                                <div key={i} className="group/att relative size-16 shrink-0 overflow-hidden rounded-lg">
                                    <img src={URL.createObjectURL(file)} alt={file.name} className="size-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => onAttachmentsChange?.(attachments.filter((_, idx) => idx !== i))}
                                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/att:opacity-100"
                                    >
                                        <X className="size-3" />
                                    </button>
                                </div>
                            ) : (
                                <div key={i} className="bg-muted flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm">
                                    <Paperclip className="text-muted-foreground size-3.5" />
                                    <span className="max-w-[150px] truncate">{file.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => onAttachmentsChange?.(attachments.filter((_, idx) => idx !== i))}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            ),
                        )}
                    </div>
                )}

                {/* Bottom bar with AI wand + attach */}
                {!showAiPanel && !inPromptMode && (
                    <div className="flex items-center px-2 py-1">
                        {hasContent ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <div>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted">
                                                    <WandSparkles className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top"><p>AI actions</p></TooltipContent>
                                        </Tooltip>
                                    </div>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" side="bottom" sideOffset={4}>
                                    <DropdownMenuItem onClick={() => runAiAction('improve')}>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Improve text
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => runAiAction('shorten')}>
                                        <Minimize2 className="mr-2 h-4 w-4" />
                                        Shorten text
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => runAiAction('summarize')}>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Summarize
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => runAiAction('proofread')}>
                                        <SpellCheck className="mr-2 h-4 w-4" />
                                        Proof read
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={(e) => { e.preventDefault(); setPromptMode('rephrase'); }}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Rephrase...
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:bg-muted"
                                        onClick={() => setPromptMode('write')}
                                    >
                                        <WandSparkles className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Write with AI</p></TooltipContent>
                            </Tooltip>
                        )}

                        {enableAttachments && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files) {
                                            onAttachmentsChange?.([...(attachments || []), ...Array.from(e.target.files)]);
                                            e.target.value = '';
                                        }
                                    }}
                                />
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:bg-muted"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Paperclip className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top"><p>Attach files</p></TooltipContent>
                                </Tooltip>
                            </>
                        )}
                    </div>
                )}

                {/* AI Panel — below editor, Monday.com style */}
                {showAiPanel && activeAction && (
                    <div className="border-t">
                        {/* Panel header */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={rejectAi}>
                                <ArrowLeft className="h-3.5 w-3.5" />
                            </Button>
                            {(() => { const Icon = ACTION_ICONS[activeAction]; return <Icon className="h-4 w-4 text-muted-foreground" />; })()}
                            <span className="text-sm font-medium flex-1">{ACTION_LABELS[activeAction]}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={rejectAi}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* AI content area */}
                        <div className="px-4 py-3 min-h-[80px] max-h-[200px] overflow-y-auto bg-muted/10">
                            {aiError ? (
                                <p className="text-sm text-destructive">{aiError}</p>
                            ) : aiLoading && !aiPreview ? (
                                <p className="text-sm text-muted-foreground">
                                    AI is writing
                                    <span className="inline-flex ml-1">
                                        <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                                        <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                                    </span>
                                </p>
                            ) : (
                                <div className="ai-preview prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: aiPreview || '' }} />
                            )}
                        </div>

                        {/* Panel footer */}
                        <div className="flex items-center gap-1 px-3 py-2 border-t bg-muted/30">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={retryAi} disabled={aiLoading}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Regenerate</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyAi} disabled={aiLoading || !aiPreview}>
                                        <ClipboardCopy className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top"><p>Copy to clipboard</p></TooltipContent>
                            </Tooltip>
                            <div className="flex-1" />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={acceptAi}
                                disabled={aiLoading || !aiPreview}
                            >
                                <Check className="h-3.5 w-3.5" />
                                Apply changes
                            </Button>
                        </div>
                    </div>
                )}
        </div>
        </TooltipProvider>
    );
}
