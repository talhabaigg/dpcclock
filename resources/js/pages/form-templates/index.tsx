import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';

interface FormTemplate {
    id: number;
    name: string;
    description: string | null;
    category: string | null;
    is_active: boolean;
    fields_count: number;
    created_at: string;
}

interface PageProps {
    templates: FormTemplate[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Form Templates', href: '/form-templates' }];

export default function FormTemplatesIndex({ templates }: PageProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Form Templates" />

            <div className="mx-auto max-w-4xl p-4">
                <div className="mb-4 flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Form Templates</h1>
                    <Link href={route('form-templates.create')}>
                        <Button size="sm">
                            <Plus className="mr-1.5 h-4 w-4" />
                            New Form
                        </Button>
                    </Link>
                </div>

                {templates.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center text-muted-foreground">
                            <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
                            <p>No form templates yet. Create your first one.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {templates.map((t) => (
                            <Card key={t.id} className="transition-colors hover:bg-muted/30">
                                <CardContent className="flex items-center justify-between p-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="truncate font-medium">{t.name}</p>
                                            {!t.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                                        </div>
                                        {t.description && <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.description}</p>}
                                        <p className="mt-1 text-xs text-muted-foreground">{t.fields_count} field{t.fields_count !== 1 ? 's' : ''}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <Link href={route('form-templates.edit', t.id)}>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            onClick={() => {
                                                if (confirm('Delete this form template?')) {
                                                    router.delete(route('form-templates.destroy', t.id));
                                                }
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4" />
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
