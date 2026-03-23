import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { CheckSquare, Edit, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface Template {
    id: number;
    name: string;
    model_type: string | null;
    auto_attach: boolean;
    is_active: boolean;
    items_count: number;
}

interface PageProps {
    templates: Template[];
}

const MODEL_LABELS: Record<string, string> = {
    'App\\Models\\EmploymentApplication': 'Employment Application',
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Checklist Templates', href: '/checklist-templates' },
];

export default function ChecklistTemplatesIndex({ templates }: PageProps) {
    const [deleting, setDeleting] = useState<number | null>(null);

    function handleDelete(id: number) {
        if (!confirm('Delete this template? Existing checklists created from it will not be affected.')) return;
        setDeleting(id);
        router.delete(route('checklist-templates.destroy', id), {
            onFinish: () => setDeleting(null),
        });
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Checklist Templates" />

            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Checklist Templates</h1>
                    <Link href="/checklist-templates/create">
                        <Button size="sm" className="gap-1.5">
                            <Plus className="h-4 w-4" />
                            New Template
                        </Button>
                    </Link>
                </div>

                {templates.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <CheckSquare className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
                            <p className="text-muted-foreground text-sm">No templates yet. Create one to get started.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {templates.map((template) => (
                            <Card key={template.id} className="rounded-xl">
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-sm font-semibold">{template.name}</CardTitle>
                                        <div className="flex items-center gap-1">
                                            {!template.is_active && (
                                                <Badge variant="outline" className="text-[10px] text-slate-500">Inactive</Badge>
                                            )}
                                            {template.auto_attach && (
                                                <Badge variant="secondary" className="text-[10px]">Auto-attach</Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-muted-foreground mb-3 space-y-1 text-xs">
                                        <p>{template.items_count} item{template.items_count !== 1 ? 's' : ''}</p>
                                        {template.model_type && (
                                            <p>Applies to: {MODEL_LABELS[template.model_type] ?? template.model_type}</p>
                                        )}
                                        {!template.model_type && <p>Applies to: Any model</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <Link href={`/checklist-templates/${template.id}/edit`}>
                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs">
                                                <Edit className="h-3 w-3" />
                                                Edit
                                            </Button>
                                        </Link>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive h-7 gap-1 text-xs"
                                            onClick={() => handleDelete(template.id)}
                                            disabled={deleting === template.id}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Delete
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
