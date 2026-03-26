'use client';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MoreHorizontal, PanelLeftClose, PanelLeftOpen, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
                'group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors',
                isActive ? 'bg-muted font-medium' : 'hover:bg-muted/60',
            )}
        >
            <button
                type="button"
                onClick={onSelect}
                className="min-w-0 max-w-56 flex-1 cursor-pointer truncate text-left"
            >
                {conversation.title}
            </button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted ml-1 shrink-0 cursor-pointer rounded p-0.5 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
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

    const groups = groupByDate(conversations);

    const panelContent = (
        <>
            {/* Header */}
            <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                    <Sparkles className="size-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold">Conversations</span>
                <div className="ml-auto flex items-center gap-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-7" onClick={onNewConversation}>
                                <Plus className="size-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>New conversation</TooltipContent>
                    </Tooltip>
                    {/* Close button: X on mobile, collapse icon on md+ */}
                    <Button variant="ghost" size="icon" className="size-7 md:hidden" onClick={onClose}>
                        <X className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hidden size-7 md:inline-flex" onClick={onToggle}>
                        <PanelLeftClose className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Conversation list */}
            <ScrollArea className="min-h-0 flex-1 px-2">
                {conversations.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-8 text-center text-sm">No conversations yet</div>
                ) : (
                    <div className="space-y-4 py-2 pb-4">
                        {groups.map((group) => (
                            <div key={group.label}>
                                <div className="text-muted-foreground px-2 py-1 text-xs font-medium">{group.label}</div>
                                <div className="space-y-0.5">
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
        </>
    );

    return (
        <>
            {/* Mobile: overlay sidebar */}
            <div className="md:hidden">
                {open && <div className="absolute inset-0 z-40 bg-black/20" onClick={onClose} />}
                <div
                    className={cn(
                        'bg-background border-border absolute left-0 top-0 z-50 flex h-full w-72 flex-col border-r shadow-xl transition-transform duration-200',
                        open ? 'translate-x-0' : '-translate-x-full',
                    )}
                >
                    {panelContent}
                </div>
            </div>

            {/* md+: static side panel that pushes content */}
            <div
                className={cn(
                    'bg-background border-border hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex',
                    open ? 'w-72' : 'w-0',
                )}
            >
                {open && panelContent}
            </div>
        </>
    );
}

/**
 * Toggle button to open the panel when collapsed (used externally).
 */
export function ConversationPanelToggle({ onClick }: { onClick: () => void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground size-8" onClick={onClick}>
                    <PanelLeftOpen className="size-4" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Open conversations</TooltipContent>
        </Tooltip>
    );
}

export default ConversationSidebar;
