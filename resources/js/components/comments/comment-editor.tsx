import { cn } from '@/lib/utils';
import { Placeholder } from '@tiptap/extension-placeholder';
import { type JSONContent, useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { forwardRef, type KeyboardEvent as ReactKeyboardEvent, useEffect, useImperativeHandle } from 'react';
import { createMentionExtension } from './mention-extension';

export interface CommentEditorHandle {
    clear: () => void;
    focus: () => void;
    getJSON: () => JSONContent;
    isEmpty: () => boolean;
}

interface Props {
    value?: JSONContent | null;
    onChange?: (doc: JSONContent) => void;
    onSubmit?: () => void;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
}

export const CommentEditor = forwardRef<CommentEditorHandle, Props>(function CommentEditor(
    { value, onChange, onSubmit, placeholder, className, autoFocus },
    ref,
) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
                blockquote: false,
                horizontalRule: false,
            }),
            Placeholder.configure({ placeholder: placeholder ?? 'Type a message. Use @ to mention someone.' }),
            createMentionExtension(),
        ],
        content: value ?? undefined,
        autofocus: autoFocus,
        onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
        editorProps: {
            attributes: {
                class: 'min-h-[40px] w-full px-3 py-2 text-sm focus:outline-none',
            },
        },
    });

    useImperativeHandle(
        ref,
        () => ({
            clear: () => editor?.commands.clearContent(true),
            focus: () => editor?.commands.focus(),
            getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
            isEmpty: () => editor?.isEmpty ?? true,
        }),
        [editor],
    );

    useEffect(() => {
        if (!editor || value === undefined) return;
        const current = editor.getJSON();
        if (JSON.stringify(current) !== JSON.stringify(value ?? { type: 'doc', content: [] })) {
            editor.commands.setContent(value ?? { type: 'doc', content: [] });
        }
    }, [editor, value]);

    const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit?.();
        }
    };

    if (!editor) return null;

    return (
        <div
            className={cn(
                'border-input bg-background focus-within:ring-ring/40 rounded-md border focus-within:ring-2',
                className,
            )}
            onKeyDown={handleKeyDown}
        >
            <EditorContent editor={editor} />
        </div>
    );
});
