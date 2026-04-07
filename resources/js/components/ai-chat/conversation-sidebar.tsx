'use client';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MessageSquare, MoreHorizontal, PanelLeftClose, PanelLeftOpen, Pencil, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { chatService } from './chat-service';
import type { ConversationSummary } from './types';

interface ConversationSidebarProps {
    open: boolean;
    onClose: () => void;
    onToggle: () => void;
    activeConversationId: string | null;
    onSelectConversation: (id: string) => void;
    onNewConversation: () => void;
}

function groupByDate(conversations: ConversationSummary[]) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const week = new Date(today.getTime() - 7 * 86400000);
    const month = new Date(today.getTime() - 30 * 86400000);

    const groups: { label: string; items: ConversationSummary[] }[] = [
        { label: 'Today', items: [] },
        { label: 'Yesterday', items: [] },
        { label: 'Previous 7 Days', items: [] },
        { label: 'Previous 30 Days', items: [] },
        { label: 'Older', items: [] },
    ];

    for (const conv of conversations) {
        const date = new Date(conv.last_message_at);
        if (date >= today) groups[0].items.push(conv);
        else if (date >= yesterday) groups[1].items.push(conv);
        else if (date >= week) groups[2].items.push(conv);
        else if (date >= month) groups[3].items.push(conv);
        else groups[4].items.push(conv);
    }

    return groups.filter((g) => g.items.length > 0);
}

function ConversationItem({
    conversation,
    isActive,
    onSelect,
    onDelete,
}: {
    conversation: ConversationSummary;
    isActive: boolean;
    onSelect: () => void;
    onDelete: () => void;
}) {
    return (
        <div
            className={cn(
                'group relative flex w-full items-center rounded-lg text-[13px] transition-colors',
                isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
        >
            <button
                type="button"
                onClick={onSelect}
                className="min-w-0 flex-1 cursor-pointer truncate px-3 py-2.5 text-left"
            >
                {conversation.title}
            </button>

            {/* Fade mask + actions on hover */}
            <div
                className={cn(
                    'absolute right-0 top-0 flex h-full items-center gap-0.5 pr-1.5 pl-6 opacity-0 transition-opacity',
                    'group-hover:opacity-100 data-[state=open]:opacity-100',
                    isActive
                        ? 'bg-gradient-to-l from-muted via-muted to-transparent'
                        : 'bg-gradient-to-l from-background via-background to-transparent group-hover:from-muted/50 group-hover:via-muted/50',
                )}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-foreground cursor-pointer rounded-md p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <MoreHorizontal className="size-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="bottom" className="w-36">
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive gap-2 text-[13px]"
                            onClick={onDelete}
                        >
                            <Trash2 className="size-3.5" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

export function ConversationSidebar({
    open,
    onClose,
    onToggle,
    activeConversationId,
    onSelectConversation,
    onNewConversation,
}: ConversationSidebarProps) {
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const fetchConversations = useCallback(async () => {
        try {
            const data = await chatService.getConversations();
            setConversations(data);
        } catch {
            // Silently fail
        }
    }, []);

    useEffect(() => {
        if (open) fetchConversations();
    }, [open, fetchConversations, activeConversationId]);

    const handleDelete = useCallback(
        async (id: string) => {
            try {
                await chatService.deleteConversation(id);
                setConversations((prev) => prev.filter((c) => c.conversation_id !== id));
                if (activeConversationId === id) {
                    onNewConversation();
                }
            } catch {
                // Silently fail
            }
        },
        [activeConversationId, onNewConversation],
    );

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter((c) => c.title.toLowerCase().includes(q));
    }, [conversations, searchQuery]);

    const groups = groupByDate(filtered);

    const panelContent = (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-1">
                    {/* Close / collapse */}
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground size-8 md:hidden" onClick={onClose}>
                        <X className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hidden size-8 md:inline-flex" onClick={onToggle}>
                        <PanelLeftClose className="size-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground size-8"
                                onClick={() => setIsSearching(!isSearching)}
                            >
                                <Search className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Search conversations</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground size-8"
                                onClick={onNewConversation}
                            >
                                <Pencil className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>New chat</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Search bar */}
            {isSearching && (
                <div className="shrink-0 px-3 pb-2">
                    <div className="bg-muted/50 border-border/60 focus-within:border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors">
                        <Search className="text-muted-foreground size-3.5 shrink-0" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chats..."
                            className="placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                            autoFocus
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    setIsSearching(false);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Conversation list */}
            <ScrollArea className="min-h-0 flex-1">
                {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                        <div className="bg-muted mb-3 flex size-10 items-center justify-center rounded-full">
                            <MessageSquare className="text-muted-foreground size-5" />
                        </div>
                        <p className="text-muted-foreground text-sm">No conversations yet</p>
                        <p className="text-muted-foreground/60 mt-1 text-xs">Start a new chat to begin</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-muted-foreground px-4 py-8 text-center text-sm">No results found</div>
                ) : (
                    <div className="px-2 pb-4">
                        {groups.map((group) => (
                            <div key={group.label} className="mt-3 first:mt-1">
                                <div className="text-muted-foreground/70 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider">
                                    {group.label}
                                </div>
                                <div className="space-y-px">
                                    {group.items.map((conv) => (
                                        <ConversationItem
                                            key={conv.conversation_id}
                                            conversation={conv}
                                            isActive={activeConversationId === conv.conversation_id}
                                            onSelect={() => onSelectConversation(conv.conversation_id)}
                                            onDelete={() => handleDelete(conv.conversation_id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );

    return (
        <>
            {/* Mobile: overlay sidebar */}
            <div className="md:hidden">
                {open && <div className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />}
                <div
                    className={cn(
                        'bg-background absolute left-0 top-0 z-50 flex h-full w-72 flex-col shadow-2xl transition-transform duration-200',
                        open ? 'translate-x-0' : '-translate-x-full',
                    )}
                >
                    {panelContent}
                </div>
            </div>

            {/* md+: static side panel */}
            <div
                className={cn(
                    'bg-muted/30 hidden shrink-0 flex-col transition-[width] duration-200 md:flex',
                    open ? 'w-64' : 'w-0',
                )}
            >
                {open && panelContent}
            </div>
        </>
    );
}

/**
 * Toggle button to open the panel when collapsed.
 */
export function ConversationPanelToggle({ onClick }: { onClick: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground size-8" onClick={onClick}>
                    <PanelLeftOpen className="size-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Show conversations</TooltipContent>
        </Tooltip>
    );
}

export default ConversationSidebar;
