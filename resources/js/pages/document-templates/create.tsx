import TiptapEditor from '@/components/document-templates/tiptap-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Plus, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Document Templates', href: route('document-templates.index') },
    { title: 'Create', href: '#' },
];

const CATEGORIES = ['employment', 'safety', 'subcontractor', 'general'];

const PLACEHOLDER_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Long Text' },
    { value: 'date', label: 'Date' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'radio', label: 'Radio' },
    { value: 'checkbox', label: 'Checkbox' },
];

const TYPES_WITH_OPTIONS = ['dropdown', 'radio'];

interface PlaceholderItem {
    key: string;
    label: string;
    type: string;
    required: boolean;
    options: string[];
}

export default function CreateDocumentTemplate() {
    const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>([]);

    const { data, setData, post, processing, errors } = useForm({
        name: '',
        category: '',
        visibility: 'all',
        body_json: '',
        body_html: '',
        placeholders: [] as PlaceholderItem[],
    });

    const addPlaceholder = () => {
        const updated = [...placeholders, { key: '', label: '', type: 'text', required: false, options: [] }];
        setPlaceholders(updated);
        setData('placeholders', updated);
    };

    const updatePlaceholder = (index: number, field: keyof PlaceholderItem, value: string | boolean | string[]) => {
        const updated = [...placeholders];
        if (field === 'key') {
            updated[index][field] = (value as string).toLowerCase().replace(/[^a-z0-9_]/g, '_');
        } else if (field === 'type') {
            updated[index].type = value as string;
            if (!TYPES_WITH_OPTIONS.includes(value as string)) {
                updated[index].options = [];
            }
        } else {
            (updated[index] as any)[field] = value;
        }
        setPlaceholders(updated);
        setData('placeholders', updated);
    };

    const removePlaceholder = (index: number) => {
        const updated = placeholders.filter((_, i) => i !== index);
        setPlaceholders(updated);
        setData('placeholders', updated);
    };

    const handleEditorChange = (json: string, html: string) => {
        setData((prev) => ({ ...prev, body_json: json, body_html: html }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('document-templates.store'));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Document Template" />
            <form onSubmit={handleSubmit} className="flex h-full flex-col">
                {/* Compact header bar */}
                <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-2.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" type="button" asChild>
                        <Link href={route('document-templates.index')}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>

                    {/* Inline editable template name */}
                    <div className="min-w-0 flex-1">
                        <Input
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder="Untitled Template"
                            className="h-9 border-transparent bg-transparent text-lg font-semibold shadow-none placeholder:text-muted-foreground/50 focus:border-input focus:bg-background"
                        />
                        {errors.name && <p className="px-3 text-xs text-destructive">{errors.name}</p>}
                    </div>

                    {/* Right side controls */}
                    <div className="flex items-center gap-2">
                        <Select value={data.category} onValueChange={(v) => setData('category', v)}>
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map((cat) => (
                                    <SelectItem key={cat} value={cat}>
                                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" type="button" className="h-8 gap-1.5">
                                    <Settings className="h-3.5 w-3.5" />
                                    Settings
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="overflow-y-auto p-6 sm:max-w-md">
                                <SheetHeader>
                                    <SheetTitle>Template Settings</SheetTitle>
                                    <SheetDescription>Configure template details and custom placeholders.</SheetDescription>
                                </SheetHeader>
                                <div className="space-y-6 py-6">
                                    {/* Template details */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-medium">Details</h3>
                                        <div className="space-y-2">
                                            <Label htmlFor="sheet-name">Template Name</Label>
                                            <Input
                                                id="sheet-name"
                                                value={data.name}
                                                onChange={(e) => setData('name', e.target.value)}
                                                placeholder="e.g. Standard Employment Contract"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="sheet-category">Category</Label>
                                            <Select value={data.category} onValueChange={(v) => setData('category', v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CATEGORIES.map((cat) => (
                                                        <SelectItem key={cat} value={cat}>
                                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="sheet-visibility">Visibility</Label>
                                            <Select value={data.visibility} onValueChange={(v) => setData('visibility', v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select visibility" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All employees</SelectItem>
                                                    <SelectItem value="office_only">Office only</SelectItem>
                                                    <SelectItem value="site_only">Site only</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                Controls which employee type this template appears for when sending documents.
                                            </p>
                                        </div>
                                    </div>

                                    <hr />

                                    {/* Custom placeholders */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium">Custom Placeholders</h3>
                                            <Button type="button" variant="ghost" size="sm" onClick={addPlaceholder}>
                                                <Plus className="mr-1 h-3 w-3" />
                                                Add
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Define custom fields that will be filled in when sending the document. Default fields (Recipient Name,
                                            Email, Date Signed) are always available.
                                        </p>
                                        {placeholders.map((p, i) => (
                                            <div key={i} className="space-y-2 rounded-md border p-2">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-1 space-y-1">
                                                        <Input
                                                            placeholder="field_key"
                                                            value={p.key}
                                                            onChange={(e) => updatePlaceholder(i, 'key', e.target.value)}
                                                            className="font-mono text-xs"
                                                        />
                                                        <Input
                                                            placeholder="Display Label"
                                                            value={p.label}
                                                            onChange={(e) => updatePlaceholder(i, 'label', e.target.value)}
                                                            className="text-xs"
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="mt-0.5 shrink-0"
                                                        onClick={() => removePlaceholder(i)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Select value={p.type || 'text'} onValueChange={(v) => updatePlaceholder(i, 'type', v)}>
                                                        <SelectTrigger className="h-7 flex-1 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {PLACEHOLDER_TYPES.map((t) => (
                                                                <SelectItem key={t.value} value={t.value}>
                                                                    {t.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs">
                                                        <Checkbox
                                                            checked={p.required || false}
                                                            onCheckedChange={(v) => updatePlaceholder(i, 'required', !!v)}
                                                        />
                                                        Required
                                                    </label>
                                                </div>
                                                {TYPES_WITH_OPTIONS.includes(p.type) && (
                                                    <div className="space-y-1">
                                                        <Label className="text-[11px] text-muted-foreground">Options (one per line)</Label>
                                                        <Textarea
                                                            value={(p.options ?? []).join('\n')}
                                                            onChange={(e) => updatePlaceholder(i, 'options', e.target.value.split('\n'))}
                                                            placeholder={'Option 1\nOption 2\nOption 3'}
                                                            rows={3}
                                                            className="text-xs"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>

                        <div className="ml-1 h-5 w-px bg-border" />

                        <Button variant="outline" size="sm" type="button" className="h-8" asChild>
                            <Link href={route('document-templates.index')}>Cancel</Link>
                        </Button>
                        <Button type="submit" size="sm" className="h-8" disabled={processing}>
                            Save Template
                        </Button>
                    </div>
                </div>

                {/* Full-width editor */}
                <div className="min-h-0 flex-1 p-4">
                    <TiptapEditor content={data.body_json} onChange={handleEditorChange} placeholders={placeholders} />
                    {errors.body_html && <p className="mt-2 text-sm text-destructive">{errors.body_html}</p>}
                </div>
            </form>
        </AppLayout>
    );
}
