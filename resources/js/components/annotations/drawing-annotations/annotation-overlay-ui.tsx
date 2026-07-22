import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { linkTargetLabel, TEXT_SIZES, type LinkTarget } from './types';
import type { AnnotationLayerApi } from './use-annotation-layer';

/**
 * DOM chrome for the annotation layer, rendered inside the viewer's relative
 * container: the floating text editor (drag-a-box → type → save), the
 * selection action chip, and the active-tool hint banner.
 */
export function AnnotationOverlayUi({ api }: { api: AnnotationLayerApi }) {
    return (
        <>
            {api.ui.hint && (
                <div className="bg-background/90 text-muted-foreground pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md border px-3 py-1.5 text-xs shadow-sm backdrop-blur">
                    {api.ui.hint}
                </div>
            )}

            {api.ui.linkHover && (
                <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
                    style={{ left: api.ui.linkHover.x, top: api.ui.linkHover.y - 16 }}
                >
                    <div className="max-w-64 truncate rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white shadow-md">
                        {api.ui.linkHover.label}
                    </div>
                    <div className="mx-auto h-0 w-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-neutral-900" />
                </div>
            )}

            {api.ui.chip && api.canEdit && !api.ui.textDraft && (
                <div
                    className="absolute z-20 -translate-y-full"
                    style={{ left: Math.max(api.ui.chip.x - 8, 8), top: Math.max(api.ui.chip.y - 6, 8) }}
                >
                    <div className="bg-background flex items-center gap-1 rounded-md border p-0.5 shadow-md">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive h-7 gap-1 px-1.5"
                            title={api.ui.chip.count > 1 ? `Delete ${api.ui.chip.count} annotations` : 'Delete annotation'}
                            onClick={api.deleteSelected}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {api.ui.chip.count > 1 && <span className="text-xs font-semibold">{api.ui.chip.count}</span>}
                        </Button>
                    </div>
                </div>
            )}

            {api.ui.textDraft && <TextEditor api={api} />}
            {api.ui.linkDraft && <LinkPicker api={api} />}
        </>
    );
}

function LinkPicker({ api }: { api: AnnotationLayerApi }) {
    const draft = api.ui.linkDraft!;
    const [query, setQuery] = useState('');
    // Chosen target, previewed before saving. Pre-filled when re-targeting.
    const [selected, setSelected] = useState<LinkTarget | null>(draft.currentTarget);
    // Whether the search list is showing (vs the selected-plan preview).
    const [searching, setSearching] = useState(draft.currentTarget == null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (searching) inputRef.current?.focus();
    }, [searching]);

    const targets = api.linkTargets;
    const q = query.trim().toLowerCase();
    const filtered = targets?.filter((t) => !q || linkTargetLabel(t).toLowerCase().includes(q)) ?? [];

    return (
        <div
            className="bg-background absolute z-30 flex w-80 flex-col gap-2.5 rounded-lg border p-3 shadow-xl"
            style={{
                left: Math.max(Math.min(draft.screen.x, window.innerWidth - 340), 8),
                top: Math.max(draft.screen.y, 8),
            }}
        >
            <div className="flex items-center justify-between">
                <span className="text-base font-semibold">Link to plan</span>
                <button type="button" onClick={api.cancelLinkDraft} className="text-muted-foreground hover:text-foreground" title="Close">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {selected && !searching ? (
                /* Selected-plan preview: thumbnail + dark sheet banner with edit pencil */
                <div className="overflow-hidden rounded-md border">
                    <div className="bg-muted flex h-44 items-center justify-center overflow-hidden">
                        <img
                            src={`/api/drawings/${selected.id}/thumbnail`}
                            alt={linkTargetLabel(selected)}
                            className="h-full w-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between bg-neutral-900 px-3 py-2 text-white">
                        <span className="truncate text-sm font-medium">{selected.sheet_number || linkTargetLabel(selected)}</span>
                        <button type="button" title="Change plan" onClick={() => setSearching(true)} className="opacity-80 hover:opacity-100">
                            <Pencil className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search plans…"
                        className="h-9 text-sm"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                e.stopPropagation();
                                api.cancelLinkDraft();
                            }
                        }}
                    />
                    <div className="max-h-52 overflow-y-auto rounded-md border">
                        {targets == null ? (
                            <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-xs">
                                <Spinner className="h-3.5 w-3.5" /> Loading plans…
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-muted-foreground py-4 text-center text-xs">No matching plans</div>
                        ) : (
                            filtered.map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                        setSelected(t);
                                        setSearching(false);
                                    }}
                                    className="hover:bg-accent flex w-full flex-col border-b px-2.5 py-1.5 text-left last:border-b-0"
                                >
                                    <span className="truncate text-sm">{linkTargetLabel(t)}</span>
                                    {t.revision_number && <span className="text-muted-foreground text-[11px]">Rev {t.revision_number}</span>}
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}

            <div className="flex justify-end gap-1.5">
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5 text-xs" onClick={api.cancelLinkDraft}>
                    Cancel
                </Button>
                <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={!selected}
                    onClick={() => selected && api.commitLinkDraft(selected)}
                >
                    Save link
                </Button>
            </div>
        </div>
    );
}

function TextEditor({ api }: { api: AnnotationLayerApi }) {
    const draft = api.ui.textDraft!;
    const [text, setText] = useState(draft.initialText);
    const [size, setSize] = useState(draft.initialSize);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
    }, []);

    const save = () => api.commitTextDraft(text, size);

    return (
        <div
            className="bg-background absolute z-30 flex w-64 flex-col gap-2 rounded-md border p-2 shadow-lg"
            style={{
                left: Math.max(Math.min(draft.screen.x, window.innerWidth - 280), 8),
                top: Math.max(draft.screen.y, 8),
            }}
        >
            <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type annotation text…"
                rows={3}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                        e.stopPropagation();
                        api.cancelTextDraft();
                    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        save();
                    }
                }}
            />
            <div className="flex items-center justify-between gap-2">
                <div className="flex gap-0.5">
                    {TEXT_SIZES.map((s) => (
                        <button
                            key={s.label}
                            type="button"
                            title={`${s.label} (${s.value}pt)`}
                            onClick={() => setSize(s.value)}
                            className={cn(
                                'h-7 w-7 rounded-sm text-xs font-medium',
                                size === s.value ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={api.cancelTextDraft}>
                        Cancel
                    </Button>
                    <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={save} disabled={!text.trim()}>
                        Save
                    </Button>
                </div>
            </div>
        </div>
    );
}
