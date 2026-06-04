import { api } from '@/lib/api';
import Mention from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import { MentionList, type MentionItem, type MentionListHandle } from './mention-list';

const GAP = 4;
const EDGE_PADDING = 8;

function buildFloatingContainer(): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.zIndex = '60';
    container.style.top = '0';
    container.style.left = '0';
    document.body.appendChild(container);
    return container;
}

function positionAt(container: HTMLDivElement, rect: DOMRect | null) {
    if (!rect) return;

    const { innerWidth: vw, innerHeight: vh, scrollX, scrollY } = window;
    const { offsetWidth: pw, offsetHeight: ph } = container;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < ph + GAP && spaceAbove > spaceBelow;

    const top = flipUp ? scrollY + rect.top - ph - GAP : scrollY + rect.bottom + GAP;

    let left = scrollX + rect.left;
    const maxLeft = scrollX + vw - pw - EDGE_PADDING;
    if (left > maxLeft) left = Math.max(scrollX + EDGE_PADDING, maxLeft);

    container.style.top = `${top}px`;
    container.style.left = `${left}px`;
}

/**
 * Builds the Tiptap Mention extension preconfigured with our user-search
 * suggestion popover. Shared between CommentEditor and AiRichTextEditor so
 * both editors get identical @ behavior.
 */
export function createMentionExtension() {
    return Mention.configure({
        HTMLAttributes: { class: 'mention' },
        renderText({ node }) {
            return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
            char: '@',
            items: async ({ query }) => {
                try {
                    return await api.get<MentionItem[]>('/comments/users/search', {
                        params: { q: query },
                    });
                } catch {
                    return [];
                }
            },
            render: () => {
                let component: ReactRenderer<MentionListHandle> | null = null;
                let container: HTMLDivElement | null = null;

                const cleanup = () => {
                    component?.destroy();
                    container?.remove();
                    component = null;
                    container = null;
                };

                return {
                    onStart: (props) => {
                        component = new ReactRenderer(MentionList, {
                            props: { items: props.items, command: props.command },
                            editor: props.editor,
                        });
                        container = buildFloatingContainer();
                        container.appendChild(component.element);
                        const rect = props.clientRect?.() ?? null;
                        positionAt(container, rect);
                        requestAnimationFrame(() => {
                            if (container) positionAt(container, props.clientRect?.() ?? rect);
                        });
                    },
                    onUpdate: (props) => {
                        component?.updateProps({ items: props.items, command: props.command });
                        if (container) {
                            const rect = props.clientRect?.() ?? null;
                            positionAt(container, rect);
                            requestAnimationFrame(() => {
                                if (container) positionAt(container, props.clientRect?.() ?? rect);
                            });
                        }
                    },
                    onKeyDown: (props) => {
                        if (props.event.key === 'Escape') {
                            cleanup();
                            return true;
                        }
                        return component?.ref?.onKeyDown(props) ?? false;
                    },
                    onExit: cleanup,
                };
            },
        },
    });
}
