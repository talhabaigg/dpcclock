import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import { Extension } from '@tiptap/core';
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
    Italic,
    List,
    ListOrdered,
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

export default function TiptapEditor({ content, onChange, placeholders = [] }: TiptapEditorProps) {
    // Merge any custom placeholders passed from the create/edit form
    const allGroups = placeholders.length > 0
        ? [...PLACEHOLDER_GROUPS, { label: 'Custom', fields: placeholders.filter((p) => !PLACEHOLDER_GROUPS.some((g) => g.fields.some((f) => 'key' in f && f.key === p.key))) as PlaceholderField[] }].filter((g) => g.fields.length > 0)
        : PLACEHOLDER_GROUPS;

    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Table.configure({ resizable: true }),
            TableRow,
            TableHeader,
            TableCell,
            SignatureBoxDecoration,
        ],
        content: content ? JSON.parse(content) : undefined,
        onUpdate: ({ editor }) => {
            onChange(JSON.stringify(editor.getJSON()), editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'max-w-none min-h-[842px] px-[60px] py-[40px] focus:outline-none a4-editor',
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
                <Toggle
                    size="sm"
                    pressed={editor.isActive('orderedList')}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered className="h-4 w-4" />
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

            {/* Editor Content — A4-page preview */}
            <div className="bg-muted/40 overflow-auto p-6" style={{ maxHeight: '70vh' }}>
                <div
                    className="mx-auto shadow-md"
                    style={{
                        width: '210mm',
                        maxWidth: '100%',
                        background: 'white',
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top center',
                    }}
                >
                    <EditorContent editor={editor} />
                </div>
            </div>

            {/* Styles matching PDF output for accurate WYSIWYG preview */}
            <style>{`
                .ProseMirror.a4-editor {
                    font-family: sans-serif;
                    font-size: 11px;
                    line-height: 1.4;
                    color: #333;
                    min-height: 842px;
                    background: white;
                }
                .ProseMirror h1 {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 8px 0 4px;
                    line-height: 1.2;
                }
                .ProseMirror h2 {
                    font-size: 14px;
                    font-weight: 600;
                    margin: 6px 0 3px;
                    line-height: 1.25;
                }
                .ProseMirror h3 {
                    font-size: 12px;
                    font-weight: 600;
                    margin: 4px 0 2px;
                    line-height: 1.3;
                }
                .ProseMirror p {
                    margin: 2px 0;
                }
                .ProseMirror ul,
                .ProseMirror ol {
                    padding-left: 20px;
                }
                .ProseMirror table {
                    border-collapse: collapse;
                    width: 100%;
                    table-layout: fixed;
                }
                .ProseMirror th,
                .ProseMirror td {
                    border: 1px solid #999;
                    padding: 2px 4px;
                    font-size: 10px;
                    line-height: 1.3;
                    word-wrap: break-word;
                    overflow: hidden;
                    min-width: 40px;
                }
                .ProseMirror th {
                    background-color: #e5e7eb;
                    font-weight: 600;
                }
                .ProseMirror .selectedCell {
                    background-color: #dbeafe;
                    border-color: #3b82f6;
                }
                .ProseMirror .column-resize-handle {
                    background-color: #3b82f6;
                    width: 2px;
                    pointer-events: none;
                    position: absolute;
                    right: -1px;
                    top: 0;
                    bottom: 0;
                }
                /* Signature box placeholder preview */
                .ProseMirror .signature-box-preview {
                    display: inline-block;
                    width: 300px;
                    border: 1px solid #ccc;
                    margin: 20px 0;
                    padding: 10px;
                    font-size: 0;
                    line-height: 0;
                    color: transparent;
                    position: relative;
                    vertical-align: top;
                }
                .ProseMirror .signature-box-preview::before {
                    content: '';
                    display: block;
                    width: 280px;
                    height: 60px;
                    background: repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 8px,
                        #f1f5f9 8px,
                        #f1f5f9 9px
                    );
                    border: 1px dashed #94a3b8;
                    border-radius: 4px;
                    margin-bottom: 8px;
                }
                .ProseMirror .signature-box-preview::after {
                    content: attr(data-label) ' will appear here';
                    display: block;
                    font-size: 12px;
                    line-height: 1.4;
                    color: #555;
                    font-weight: 600;
                    font-style: italic;
                }
            `}</style>
        </div>
    );
}
