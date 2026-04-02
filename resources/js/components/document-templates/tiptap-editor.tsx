import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { OrderedList } from '@tiptap/extension-ordered-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold,
    ChevronDown,
    Columns3,
    FileUp,
    Heading1,
    Heading2,
    Heading3,
    Indent,
    Italic,
    List,
    ListOrdered,
    Minus,
    Outdent,
    PenLine,
    Plus,
    Redo,
    Rows3,
    Table as TableIcon,
    Trash2,
    Underline as UnderlineIcon,
    Undo,
    Variable,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import mammoth from 'mammoth';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Placeholder {
    key: string;
    label: string;
}

interface TiptapEditorProps {
    content: string;
    onChange: (json: string, html: string) => void;
    placeholders?: Placeholder[];
}

type PlaceholderField = Placeholder | { divider: true };

interface PlaceholderGroup {
    label: string;
    fields: PlaceholderField[];
}

const PLACEHOLDER_GROUPS: PlaceholderGroup[] = [
    {
        label: 'Applicant',
        fields: [
            { key: 'applicant_first_name', label: 'First Name' },
            { key: 'applicant_surname', label: 'Surname' },
            { key: 'applicant_full_name', label: 'Full Name' },
            { key: 'applicant_email', label: 'Email' },
            { key: 'applicant_phone', label: 'Phone' },
            { key: 'applicant_suburb', label: 'Suburb' },
            { key: 'applicant_date_of_birth', label: 'Date of Birth' },
            { key: 'applicant_referred_by', label: 'Referred By' },
            { divider: true },
            { key: 'applicant_occupation', label: 'Occupation' },
            { key: 'applicant_apprentice_year', label: 'Apprentice Year' },
            { key: 'applicant_trade_qualified', label: 'Trade Qualified' },
            { key: 'applicant_preferred_project_site', label: 'Preferred Project Site' },
            { divider: true },
            { key: 'applicant_status', label: 'Application Status' },
        ],
    },
    {
        label: 'Sender (You)',
        fields: [
            { key: 'sender_name', label: 'Sender Name' },
            { key: 'sender_email', label: 'Sender Email' },
            { key: 'sender_phone', label: 'Sender Phone' },
            { key: 'sender_role', label: 'Sender Role' },
        ],
    },
    {
        label: 'General',
        fields: [
            { key: 'date_signed', label: 'Date Signed' },
        ],
    },
];

const SIGNATURE_PLACEHOLDERS: Record<string, string> = {
    '{{signature_box}}': 'Recipient Signature',
    '{{sender_signature}}': 'Sender Signature',
};

const SignatureBoxDecoration = Extension.create({
    name: 'signatureBoxDecoration',
    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('signatureBoxDecoration'),
                props: {
                    decorations(state) {
                        const decorations: Decoration[] = [];
                        state.doc.descendants((node, pos) => {
                            if (!node.isText || !node.text) return;
                            for (const [placeholder, label] of Object.entries(SIGNATURE_PLACEHOLDERS)) {
                                const idx = node.text.indexOf(placeholder);
                                if (idx !== -1) {
                                    decorations.push(
                                        Decoration.inline(pos + idx, pos + idx + placeholder.length, {
                                            class: 'signature-box-preview',
                                            'data-label': label,
                                        }),
                                    );
                                }
                            }
                        });
                        return DecorationSet.create(state.doc, decorations);
                    },
                },
            }),
        ];
    },
});

const INDENT_STEP = 24; // px per indent level
const MAX_INDENT = 6;

const IndentExtension = Extension.create({
    name: 'indent',
    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading'],
                attributes: {
                    indent: {
                        default: 0,
                        parseHTML: (element) => parseInt(element.getAttribute('data-indent') || '0', 10),
                        renderHTML: (attributes) => {
                            if (!attributes.indent) return {};
                            return {
                                'data-indent': attributes.indent,
                                style: `margin-left: ${attributes.indent * INDENT_STEP}px`,
                            };
                        },
                    },
                },
            },
        ];
    },
    addCommands() {
        return {
            increaseIndent: () => ({ tr, state, dispatch }) => {
                const { from, to } = state.selection;
                let changed = false;
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                        const current = node.attrs.indent || 0;
                        if (current < MAX_INDENT) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: current + 1 });
                            changed = true;
                        }
                    }
                });
                if (changed && dispatch) dispatch(tr);
                return changed;
            },
            decreaseIndent: () => ({ tr, state, dispatch }) => {
                const { from, to } = state.selection;
                let changed = false;
                state.doc.nodesBetween(from, to, (node, pos) => {
                    if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                        const current = node.attrs.indent || 0;
                        if (current > 0) {
                            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: current - 1 });
                            changed = true;
                        }
                    }
                });
                if (changed && dispatch) dispatch(tr);
                return changed;
            },
        };
    },
    addKeyboardShortcuts() {
        return {
            Tab: ({ editor }) => {
                if (editor.isActive('listItem')) {
                    return editor.chain().sinkListItem('listItem').run();
                }
                return (editor.commands as any).increaseIndent();
            },
            'Shift-Tab': ({ editor }) => {
                if (editor.isActive('listItem')) {
                    return editor.chain().liftListItem('listItem').run();
                }
                return (editor.commands as any).decreaseIndent();
            },
        };
    },
});

const CustomOrderedList = OrderedList.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            listStyle: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('data-list-style') || null,
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (!attributes.listStyle) return {};
                    return { 'data-list-style': attributes.listStyle };
                },
            },
        };
    },
});

const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    parseHTML() {
        return [{ tag: 'div[data-page-break]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'page-break' })];
    },
    addCommands() {
        return {
            setPageBreak:
                () =>
                ({ chain }) =>
                    chain().insertContent({ type: this.name }).run(),
        };
    },
});

export default function TiptapEditor({ content, onChange, placeholders = [] }: TiptapEditorProps) {
    // Merge any custom placeholders passed from the create/edit form
    const allGroups = placeholders.length > 0
        ? [...PLACEHOLDER_GROUPS, { label: 'Custom', fields: placeholders.filter((p) => !PLACEHOLDER_GROUPS.some((g) => g.fields.some((f) => 'key' in f && f.key === p.key))) as PlaceholderField[] }].filter((g) => g.fields.length > 0)
        : PLACEHOLDER_GROUPS;

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ orderedList: false }),
            CustomOrderedList,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true, lastColumnResizable: false }),
            TableRow,
            TableHeader,
            TableCell,
            SignatureBoxDecoration,
            IndentExtension,
            PageBreak,
        ],
        content: content ? JSON.parse(content) : undefined,
        onUpdate: ({ editor }) => {
            onChange(JSON.stringify(editor.getJSON()), editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'max-w-none px-7 py-6 focus:outline-none digital-editor',
            },
        },
    });

    useEffect(() => {
        if (editor && content && !editor.isFocused) {
            try {
                const json = JSON.parse(content);
                if (JSON.stringify(editor.getJSON()) !== content) {
                    editor.commands.setContent(json);
                }
            } catch {
                // content might be empty or invalid on first load
            }
        }
    }, [content, editor]);

    // Track merge/split availability on every selection change
    useEffect(() => {
        if (!editor) return;
        const updateMergeState = () => {
            setCanMerge(editor.can().mergeCells());
            setCanSplit(editor.can().splitCell());
        };
        editor.on('selectionUpdate', updateMergeState);
        editor.on('transaction', updateMergeState);
        return () => {
            editor.off('selectionUpdate', updateMergeState);
            editor.off('transaction', updateMergeState);
        };
    }, [editor]);

    const insertPlaceholder = useCallback(
        (key: string) => {
            editor?.chain().focus().insertContent(`{{${key}}}`).run();
        },
        [editor],
    );

    const insertSignatureBox = useCallback(() => {
        editor
            ?.chain()
            .focus()
            .insertContent({
                type: 'paragraph',
                attrs: { textAlign: 'left' },
                content: [
                    {
                        type: 'text',
                        text: '{{signature_box}}',
                    },
                ],
            })
            .run();
    }, [editor]);

    const insertSenderSignature = useCallback(() => {
        editor
            ?.chain()
            .focus()
            .insertContent({
                type: 'paragraph',
                attrs: { textAlign: 'left' },
                content: [
                    {
                        type: 'text',
                        text: '{{sender_signature}}',
                    },
                ],
            })
            .run();
    }, [editor]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importing, setImporting] = useState(false);

    const handleWordImport = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file || !editor) return;

            setImporting(true);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                editor.commands.setContent(result.value);
                // Trigger onChange so form state updates
                onChange(JSON.stringify(editor.getJSON()), editor.getHTML());
            } catch {
                alert('Failed to import document. Please ensure it is a valid .docx file.');
            } finally {
                setImporting(false);
                // Reset input so the same file can be re-selected
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        },
        [editor, onChange],
    );

    const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const [zoom, setZoom] = useState(1);

    const zoomIn = useCallback(() => {
        setZoom((prev) => {
            const next = ZOOM_LEVELS.find((z) => z > prev);
            return next ?? prev;
        });
    }, []);

    const zoomOut = useCallback(() => {
        setZoom((prev) => {
            const next = [...ZOOM_LEVELS].reverse().find((z) => z < prev);
            return next ?? prev;
        });
    }, []);

    const [tableRows, setTableRows] = useState(3);
    const [tableCols, setTableCols] = useState(3);
    const [canMerge, setCanMerge] = useState(false);
    const [canSplit, setCanSplit] = useState(false);

    const insertTable = useCallback(() => {
        editor?.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
    }, [editor, tableRows, tableCols]);

    if (!editor) return null;

    return (
        <div className="rounded-md border">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 border-b p-1">
                {/* Undo/Redo */}
                <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
                    <Undo className="h-4 w-4" />
                </Toggle>
                <Toggle size="sm" pressed={false} onPressedChange={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
                    <Redo className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Headings */}
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 1 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                    <Heading1 className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 2 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading2 className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 3 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    <Heading3 className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Formatting */}
                <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
                    <Bold className="h-4 w-4" />
                </Toggle>
                <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic className="h-4 w-4" />
                </Toggle>
                <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
                    <UnderlineIcon className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Lists */}
                <Toggle
                    size="sm"
                    pressed={editor.isActive('bulletList')}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List className="h-4 w-4" />
                </Toggle>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Toggle size="sm" pressed={editor.isActive('orderedList')}>
                            <ListOrdered className="h-4 w-4" />
                            <ChevronDown className="ml-0.5 h-3 w-3" />
                        </Toggle>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[140px]">
                        {([null, 'legal', 'alpha'] as const).map((style) => {
                            const labels = { null: 'Numbered', legal: 'Legal', alpha: 'Letter' } as Record<string, string>;
                            const previews = { null: '1. 2.', legal: '1.1.', alpha: 'a. b.' } as Record<string, string>;
                            const key = String(style);
                            return (
                                <DropdownMenuItem
                                    key={key}
                                    onClick={() => {
                                        if (editor.isActive('orderedList')) {
                                            const { $from } = editor.state.selection;
                                            for (let d = $from.depth; d > 0; d--) {
                                                const node = $from.node(d);
                                                if (node.type.name === 'orderedList') {
                                                    const pos = $from.before(d);
                                                    editor.chain().focus().command(({ tr }) => {
                                                        tr.setNodeMarkup(pos, undefined, { ...node.attrs, listStyle: style });
                                                        return true;
                                                    }).run();
                                                    return;
                                                }
                                            }
                                        }
                                        editor.chain().focus().toggleOrderedList().command(({ tr, state }) => {
                                            const { $from } = state.selection;
                                            for (let d = $from.depth; d > 0; d--) {
                                                const node = $from.node(d);
                                                if (node.type.name === 'orderedList') {
                                                    tr.setNodeMarkup($from.before(d), undefined, { ...node.attrs, listStyle: style });
                                                    return true;
                                                }
                                            }
                                            return true;
                                        }).run();
                                    }}
                                >
                                    <span className="mr-2 text-xs text-muted-foreground w-8">{previews[key]}</span>
                                    {labels[key]}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
                <Toggle
                    size="sm"
                    pressed={false}
                    onPressedChange={() => {
                        if (editor.isActive('listItem')) {
                            editor.chain().focus().sinkListItem('listItem').run();
                        } else {
                            (editor.commands as any).increaseIndent();
                        }
                    }}
                >
                    <Indent className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={false}
                    onPressedChange={() => {
                        if (editor.isActive('listItem')) {
                            editor.chain().focus().liftListItem('listItem').run();
                        } else {
                            (editor.commands as any).decreaseIndent();
                        }
                    }}
                >
                    <Outdent className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Alignment */}
                <Toggle
                    size="sm"
                    pressed={editor.isActive({ textAlign: 'left' })}
                    onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}
                >
                    <AlignLeft className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive({ textAlign: 'center' })}
                    onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}
                >
                    <AlignCenter className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive({ textAlign: 'right' })}
                    onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}
                >
                    <AlignRight className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Table */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                            <TableIcon className="h-4 w-4" />
                            Table
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        {!editor.isActive('table') ? (
                            <>
                                <div className="px-2 py-1.5">
                                    <p className="mb-2 text-xs font-medium text-muted-foreground">Insert Table</p>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            <Rows3 className="h-3 w-3 text-muted-foreground" />
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={tableRows}
                                                onChange={(e) => setTableRows(Math.max(1, Math.min(20, Number(e.target.value))))}
                                                className="w-14 rounded border px-1.5 py-0.5 text-xs"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <span className="text-xs text-muted-foreground">x</span>
                                        <div className="flex items-center gap-1">
                                            <Columns3 className="h-3 w-3 text-muted-foreground" />
                                            <input
                                                type="number"
                                                min={1}
                                                max={20}
                                                value={tableCols}
                                                onChange={(e) => setTableCols(Math.max(1, Math.min(20, Number(e.target.value))))}
                                                className="w-14 rounded border px-1.5 py-0.5 text-xs"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DropdownMenuItem onClick={insertTable}>
                                    <Plus className="mr-2 h-3 w-3" />
                                    Insert {tableRows} x {tableCols} table
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <>
                                <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                                    <Plus className="mr-2 h-3 w-3" />
                                    Add row above
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                                    <Plus className="mr-2 h-3 w-3" />
                                    Add row below
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Delete row
                                </DropdownMenuItem>
                                <Separator className="my-1" />
                                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                                    <Plus className="mr-2 h-3 w-3" />
                                    Add column before
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                                    <Plus className="mr-2 h-3 w-3" />
                                    Add column after
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Delete column
                                </DropdownMenuItem>
                                <Separator className="my-1" />
                                <DropdownMenuItem
                                    onClick={() => editor.chain().focus().mergeCells().run()}
                                    disabled={!canMerge}
                                >
                                    Merge cells
                                    {!canMerge && (
                                        <span className="ml-auto text-[10px] text-muted-foreground">Select cells first</span>
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => editor.chain().focus().splitCell().run()}
                                    disabled={!canSplit}
                                >
                                    Split cell
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
                                    Toggle header row
                                </DropdownMenuItem>
                                <p className="px-2 py-1 text-[10px] text-muted-foreground">
                                    Tip: Click a cell, then Shift+click another to select a range for merging.
                                </p>
                                <Separator className="my-1" />
                                <DropdownMenuItem className="text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}>
                                    <Trash2 className="mr-2 h-3 w-3" />
                                    Delete table
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Placeholders */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                            <Variable className="h-4 w-4" />
                            Insert Field
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                        {allGroups.map((group) => (
                            <DropdownMenuSub key={group.label}>
                                <DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    {group.fields.map((p, idx) =>
                                        'divider' in p ? (
                                            <DropdownMenuSeparator key={`div-${idx}`} />
                                        ) : (
                                            <DropdownMenuItem key={p.key} onClick={() => insertPlaceholder(p.key)} className="font-mono text-xs">
                                                {`{{${p.key}}}`}
                                            </DropdownMenuItem>
                                        ),
                                    )}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Import Word Document */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    type="button"
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <FileUp className="h-4 w-4" />
                    {importing ? 'Importing...' : 'Import Word'}
                </Button>
                <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleWordImport} />

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Signature Boxes */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
                            <PenLine className="h-4 w-4" />
                            Signatures
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={insertSignatureBox}>
                            <PenLine className="mr-2 h-3 w-3" />
                            Recipient Signature
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={insertSenderSignature}>
                            <PenLine className="mr-2 h-3 w-3" />
                            Sender Signature
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="mx-1 h-6" />

                {/* Page Break */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    type="button"
                    onClick={() => (editor.commands as any).setPageBreak()}
                >
                    <Minus className="h-4 w-4" />
                    Page Break
                </Button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Zoom controls */}
                <div className="flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        type="button"
                        onClick={zoomOut}
                        disabled={zoom <= ZOOM_LEVELS[0]}
                    >
                        <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <button
                        type="button"
                        onClick={() => setZoom(1)}
                        className="min-w-[3rem] rounded px-1.5 py-0.5 text-center text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        title="Reset zoom"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        type="button"
                        onClick={zoomIn}
                        disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
                    >
                        <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* Editor Content — digital agreement preview */}
            <div className="bg-muted/40 overflow-auto p-6" style={{ maxHeight: '70vh' }}>
                <div
                    className="mx-auto rounded-xl border border-border/60 shadow-sm overflow-hidden"
                    style={{
                        maxWidth: '720px',
                        width: '100%',
                        background: 'white',
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                    }}
                >
                    <EditorContent editor={editor} />
                </div>
            </div>

            {/* Styles matching digital signing page for accurate WYSIWYG preview */}
            <style>{`
                .ProseMirror.digital-editor {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    line-height: 1.7;
                    color: #374151;
                    min-height: 300px;
                    background: white;
                }
                .ProseMirror h1 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 24px 0 8px;
                    padding-bottom: 6px;
                    border-bottom: 2px solid #e2e8f0;
                    line-height: 1.3;
                }
                .ProseMirror h1:first-child {
                    margin-top: 0;
                }
                .ProseMirror h2 {
                    font-size: 16px;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 20px 0 6px;
                    line-height: 1.3;
                }
                .ProseMirror h3 {
                    font-size: 14px;
                    font-weight: 600;
                    color: #334155;
                    margin: 16px 0 4px;
                    line-height: 1.4;
                }
                .ProseMirror p {
                    margin: 4px 0 8px;
                }
                .ProseMirror ul {
                    padding-left: 24px;
                    margin: 6px 0 12px;
                    list-style-type: disc;
                }
                .ProseMirror ol {
                    padding-left: 24px;
                    margin: 6px 0 12px;
                    list-style-type: decimal;
                }
                /* Legal numbering: 1. / 1.1. / 1.2. */
                .ProseMirror ol[data-list-style="legal"] {
                    padding-left: 0;
                    list-style-type: none;
                    counter-reset: legal;
                }
                .ProseMirror ol[data-list-style="legal"] > li {
                    counter-increment: legal;
                    position: relative;
                    padding-left: 36px;
                }
                .ProseMirror ol[data-list-style="legal"] > li::before {
                    content: counters(legal, ".") ".";
                    font-weight: 500;
                    position: absolute;
                    left: 0;
                }
                .ProseMirror ol[data-list-style="legal"] ol:not([data-list-style]) {
                    padding-left: 0;
                    margin: 4px 0;
                    list-style-type: none;
                    counter-reset: legal;
                }
                .ProseMirror ol[data-list-style="legal"] ol:not([data-list-style]) > li {
                    counter-increment: legal;
                    position: relative;
                    padding-left: 36px;
                }
                .ProseMirror ol[data-list-style="legal"] ol:not([data-list-style]) > li::before {
                    content: counters(legal, ".") ".";
                    font-weight: 500;
                    position: absolute;
                    left: 0;
                }
                /* Letter numbering: a. b. c. */
                .ProseMirror ol[data-list-style="alpha"] {
                    list-style-type: lower-alpha;
                }
                .ProseMirror li {
                    margin: 2px 0;
                }
                .ProseMirror table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    margin: 16px 0;
                    font-size: 13px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    overflow: hidden;
                }
                .ProseMirror th {
                    background: #f1f5f9;
                    font-weight: 600;
                    text-align: left;
                    padding: 1px 6px;
                    border-bottom: 1px solid #e2e8f0;
                    border-right: 1px solid #e2e8f0;
                    color: #334155;
                }
                .ProseMirror th:last-child {
                    border-right: none;
                }
                .ProseMirror td {
                    padding: 1px 6px;
                    border-bottom: 1px solid #e2e8f0;
                    border-right: 1px solid #e2e8f0;
                    color: #374151;
                    position: relative;
                }
                .ProseMirror td:last-child {
                    border-right: none;
                }
                .ProseMirror tr:last-child td {
                    border-bottom: none;
                }

                .ProseMirror th p,
                .ProseMirror td p {
                    margin: 0;
                }
                .ProseMirror .selectedCell {
                    background-color: #dbeafe !important;
                    border-color: #3b82f6;
                }
                .ProseMirror .column-resize-handle {
                    background-color: #3b82f6;
                    width: 4px;
                    position: absolute;
                    right: -2px;
                    top: 0;
                    bottom: 0;
                    cursor: col-resize;
                    z-index: 10;
                }
                .ProseMirror.resize-cursor {
                    cursor: col-resize;
                }
                /* Grip affordance — show resize hint on cell border hover */
                .ProseMirror td:hover::after,
                .ProseMirror th:hover::after {
                    content: '';
                    position: absolute;
                    right: -3px;
                    top: 0;
                    bottom: 0;
                    width: 6px;
                    cursor: col-resize;
                }
                .ProseMirror strong {
                    font-weight: 600;
                    color: #1e293b;
                }
                .ProseMirror blockquote {
                    border-left: 3px solid #2563eb;
                    padding: 8px 16px;
                    margin: 12px 0;
                    background: #eff6ff;
                    border-radius: 0 8px 8px 0;
                    color: #1e40af;
                }
                /* Signature box placeholder preview — matches signing page */
                .ProseMirror .page-break {
                    position: relative;
                    border: none;
                    border-top: 2px dashed #94a3b8;
                    margin: 24px 0;
                    padding: 0;
                    height: 0;
                    cursor: default;
                }
                .ProseMirror .page-break::after {
                    content: 'Page Break';
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: white;
                    padding: 0 12px;
                    font-size: 11px;
                    color: #94a3b8;
                    font-style: italic;
                    letter-spacing: 0.5px;
                }
                .ProseMirror .signature-box-preview {
                    display: inline-block;
                    width: 100%;
                    max-width: 100%;
                    box-sizing: border-box;
                    border: 2px dashed #cbd5e1;
                    border-radius: 8px;
                    padding: 24px;
                    margin: 12px 0;
                    text-align: center;
                    font-size: 0;
                    line-height: 0;
                    color: transparent;
                    background: #f8fafc;
                }
                .ProseMirror .signature-box-preview::after {
                    content: attr(data-label) ' will appear here';
                    display: block;
                    font-size: 13px;
                    line-height: 1.4;
                    color: #94a3b8;
                    font-style: italic;
                }
            `}</style>
        </div>
    );
}
