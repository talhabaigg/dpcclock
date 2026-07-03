import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { type JSONContent } from '@tiptap/react';
import { Check, Copy, Mail, Phone } from 'lucide-react';
import { Fragment, useState } from 'react';

export interface MentionedUser {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    position?: string | null;
    is_active?: boolean;
}

interface Props {
    /** Tiptap/ProseMirror JSON doc */
    doc?: JSONContent | null;
    /** Plain text fallback for comments saved before mentions shipped */
    fallback?: string | null;
    /** Users mentioned in this doc — used to populate the hover card */
    mentionedUsers?: MentionedUser[];
    className?: string;
}

function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function CommentBody({ doc, fallback, mentionedUsers, className }: Props) {
    if (!doc || !doc.content?.length) {
        if (!fallback) return null;
        return <p className={className ?? 'mt-1 text-sm whitespace-pre-wrap'}>{fallback}</p>;
    }

    const userMap = new Map<number, MentionedUser>();
    for (const u of mentionedUsers ?? []) userMap.set(u.id, u);

    return <div className={className ?? 'mt-1 text-sm'}>{renderNodes(doc.content ?? [], userMap)}</div>;
}

function renderNodes(nodes: JSONContent[], users: Map<number, MentionedUser>): React.ReactNode {
    return nodes.map((node, i) => <Fragment key={i}>{renderNode(node, users)}</Fragment>);
}

function renderNode(node: JSONContent, users: Map<number, MentionedUser>): React.ReactNode {
    switch (node.type) {
        case 'paragraph':
            return <p className="my-0.5 whitespace-pre-wrap">{renderNodes(node.content ?? [], users)}</p>;
        case 'text':
            return renderText(node);
        case 'mention':
            return renderMention(node, users);
        case 'hardBreak':
            return <br />;
        case 'bulletList':
            return <ul className="my-1 list-disc pl-5">{renderNodes(node.content ?? [], users)}</ul>;
        case 'orderedList':
            return <ol className="my-1 list-decimal pl-5">{renderNodes(node.content ?? [], users)}</ol>;
        case 'listItem':
            return <li>{renderNodes(node.content ?? [], users)}</li>;
        default:
            return node.content ? renderNodes(node.content, users) : null;
    }
}

function renderMention(node: JSONContent, users: Map<number, MentionedUser>): React.ReactNode {
    const id = Number(node.attrs?.id);
    const label = node.attrs?.label ?? node.attrs?.id;
    const user = users.get(id);

    const pill = (
        <span className="bg-primary/10 text-primary hover:bg-primary/20 mx-0.5 cursor-pointer rounded px-1 py-0.5 text-xs font-medium transition-colors">
            @{label}
        </span>
    );

    if (!user) return pill;

    return (
        <HoverCard openDelay={150} closeDelay={100}>
            <HoverCardTrigger asChild>{pill}</HoverCardTrigger>
            <HoverCardContent className="w-60 p-0" sideOffset={6}>
                <MentionUserCard user={user} />
            </HoverCardContent>
        </HoverCard>
    );
}

function MentionUserCard({ user }: { user: MentionedUser }) {
    const active = user.is_active !== false;

    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-3 p-3">
                <span className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {initialsOf(user.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm leading-tight font-semibold">{user.name}</span>
                    {user.position && (
                        <span className="text-muted-foreground mt-0.5 truncate text-xs leading-tight">{user.position}</span>
                    )}
                    {!active && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                                Disabled
                            </Badge>
                        </div>
                    )}
                </div>
            </div>
            {(user.email || user.phone) && (
                <div className="border-t">
                    {user.email && <ContactRow icon={<Mail className="size-3.5" />} value={user.email} href={`mailto:${user.email}`} />}
                    {user.phone && <ContactRow icon={<Phone className="size-3.5" />} value={user.phone} href={`tel:${user.phone}`} />}
                </div>
            )}
        </div>
    );
}

function ContactRow({ icon, value, href }: { icon: React.ReactNode; value: string; href?: string }) {
    const [copied, setCopied] = useState(false);

    const copy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs">
            <span className="text-muted-foreground shrink-0">{icon}</span>
            <a
                href={href}
                className="hover:text-foreground min-w-0 flex-1 truncate"
                onClick={(e) => e.stopPropagation()}
            >
                {value}
            </a>
            <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={copy}
                aria-label={copied ? 'Copied' : 'Copy'}
            >
                {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
            </Button>
        </div>
    );
}

function renderText(node: JSONContent): React.ReactNode {
    let content: React.ReactNode = node.text ?? '';
    for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') content = <strong>{content}</strong>;
        else if (mark.type === 'italic') content = <em>{content}</em>;
        else if (mark.type === 'strike') content = <s>{content}</s>;
        else if (mark.type === 'code') content = <code className="bg-muted rounded px-1 text-xs">{content}</code>;
    }
    return content;
}
