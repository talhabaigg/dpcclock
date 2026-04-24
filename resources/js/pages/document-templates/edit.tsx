import PlaceholderEditor, { type PlaceholderItem } from '@/components/document-templates/placeholder-editor';
import TiptapEditor from '@/components/document-templates/tiptap-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Settings } from 'lucide-react';
import { useState } from 'react';

interface DocumentTemplate {
    id: number;
    name: string;
    category: string | null;
    body_json: string;
    body_html: string;
    placeholders: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] | null;
    is_active: boolean;
    visibility: string;
}

const CATEGORIES: Record<string, string> = {
    employment_contract: 'Employment Contract',
    policies: 'Policies',
};

export default function EditDocumentTemplate({ template }: { template: DocumentTemplate }) {
    const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>(
        (template.placeholders ?? []).map((p) => ({ key: p.key, label: p.label, type: p.type || 'text', required: p.required || false, options: p.options ?? [] })),
    );
    const [placeholderSheetOpen, setPlaceholderSheetOpen] = useState(false);

    const { data, setData, put, processing, errors } = useForm({
        name: template.name,
        category: template.category ?? '',
        body_json: template.body_json,
        body_html: template.body_html,
        placeholders: (template.placeholders ?? []).map((p) => ({
            key: p.key,
            label: p.label,
            type: p.type || 'text',
            required: p.required || false,
            options: p.options ?? [],
        })) as PlaceholderItem[],
        is_active: template.is_active,
        visibility: template.visibility ?? 'all',
    });

    const handlePlaceholdersChange = (updated: PlaceholderItem[]) => {
        setPlaceholders(updated);
        setData('placeholders', updated);
    };

    const handleEditorChange = (json: string, html: string) => {
        setData((prev) => ({ ...prev, body_json: json, body_html: html }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(route('document-templates.update', template.id));
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Document Templates', href: route('document-templates.index') },
        { title: template.name, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit: ${template.name}`} />
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
                                {Object.entries(CATEGORIES).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
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
                                    <SheetDescription>Configure template details and status.</SheetDescription>
                                </SheetHeader>
                                <div className="space-y-4 py-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="sheet-name">Template Name</Label>
                                        <Input
                                            id="sheet-name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="sheet-category">Category</Label>
                                        <Select value={data.category} onValueChange={(v) => setData('category', v)}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(CATEGORIES).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
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
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="is_active">Active</Label>
                                        <Switch
                                            id="is_active"
                                            checked={data.is_active}
                                            onCheckedChange={(v) => setData('is_active', v)}
                                        />
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>

                        <div className="ml-1 h-5 w-px bg-border" />

                        <Button variant="outline" size="sm" type="button" className="h-8" asChild>
                            <Link href={route('document-templates.index')}>Cancel</Link>
                        </Button>
                        <Button type="submit" size="sm" className="h-8" disabled={processing}>
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Full-width editor */}
                <div className="min-h-0 flex-1 p-4">
                    <TiptapEditor
                        content={data.body_json}
                        onChange={handleEditorChange}
                        placeholders={placeholders}
                        onManagePlaceholders={() => setPlaceholderSheetOpen(true)}
                    />
                    {errors.body_html && <p className="mt-2 text-sm text-destructive">{errors.body_html}</p>}
                </div>

                {/* Placeholders dialog (triggered from toolbar) */}
                <Dialog open={placeholderSheetOpen} onOpenChange={setPlaceholderSheetOpen}>
                    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Custom Placeholders</DialogTitle>
                            <DialogDescription>Define custom fields that will be filled in when sending this document.</DialogDescription>
                        </DialogHeader>
                        <PlaceholderEditor placeholders={placeholders} onChange={handlePlaceholdersChange} />
                    </DialogContent>
                </Dialog>
            </form>
        </AppLayout>
    );
}
