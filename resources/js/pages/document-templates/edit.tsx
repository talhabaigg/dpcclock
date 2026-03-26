import TiptapEditor from '@/components/document-templates/tiptap-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface DocumentTemplate {
    id: number;
    name: string;
    category: string | null;
    body_json: string;
    body_html: string;
    placeholders: { key: string; label: string }[] | null;
    is_active: boolean;
}

const CATEGORIES = ['employment', 'safety', 'subcontractor', 'general'];

interface PlaceholderItem {
    key: string;
    label: string;
}

export default function EditDocumentTemplate({ template }: { template: DocumentTemplate }) {
    const [placeholders, setPlaceholders] = useState<PlaceholderItem[]>(template.placeholders ?? []);

    const { data, setData, put, processing, errors } = useForm({
        name: template.name,
        category: template.category ?? '',
        body_json: template.body_json,
        body_html: template.body_html,
        placeholders: template.placeholders ?? ([] as PlaceholderItem[]),
        is_active: template.is_active,
    });

    const addPlaceholder = () => {
        const updated = [...placeholders, { key: '', label: '' }];
        setPlaceholders(updated);
        setData('placeholders', updated);
    };

    const updatePlaceholder = (index: number, field: 'key' | 'label', value: string) => {
        const updated = [...placeholders];
        updated[index][field] = field === 'key' ? value.toLowerCase().replace(/[^a-z0-9_]/g, '_') : value;
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
        put(route('document-templates.update', template.id));
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Document Templates', href: route('document-templates.index') },
        { title: template.name, href: '#' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Edit: ${template.name}`} />
            <form onSubmit={handleSubmit} className="mx-auto space-y-6 p-6" style={{ maxWidth: '1400px' }}>
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-semibold">Edit Template</h1>
                    <div className="flex gap-2">
                        <Button variant="outline" type="button" asChild>
                            <Link href={route('document-templates.index')}>Cancel</Link>
                        </Button>
                        <Button type="submit" disabled={processing}>
                            Save Changes
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-4">
                    {/* Settings sidebar */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Template Name</Label>
                                    <Input id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} />
                                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
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
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="is_active">Active</Label>
                                    <Switch id="is_active" checked={data.is_active} onCheckedChange={(v) => setData('is_active', v)} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    Custom Placeholders
                                    <Button type="button" variant="ghost" size="sm" onClick={addPlaceholder}>
                                        <Plus className="mr-1 h-3 w-3" />
                                        Add
                                    </Button>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-xs text-muted-foreground">
                                    Define custom fields that will be filled in when sending the document.
                                </p>
                                {placeholders.map((p, i) => (
                                    <div key={i} className="flex items-start gap-2">
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
                                        <Button type="button" variant="ghost" size="icon" className="mt-0.5 shrink-0" onClick={() => removePlaceholder(i)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Editor */}
                    <div className="lg:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle>Document Content</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <TiptapEditor content={data.body_json} onChange={handleEditorChange} placeholders={placeholders} />
                                {errors.body_html && <p className="mt-2 text-sm text-destructive">{errors.body_html}</p>}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </AppLayout>
    );
}
