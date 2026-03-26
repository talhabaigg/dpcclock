import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface DocumentTemplate {
    id: number;
    name: string;
    category: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Document Templates', href: route('document-templates.index') }];

export default function DocumentTemplatesIndex({ templates }: { templates: DocumentTemplate[] }) {
    const handleDelete = (id: number) => {
        router.delete(route('document-templates.destroy', id));
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Templates" />
            <div className="mx-auto max-w-6xl space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Document Templates</h1>
                        <p className="text-sm text-muted-foreground">Create and manage templates for documents that need signatures.</p>
                    </div>
                    <Button asChild>
                        <Link href={route('document-templates.create')}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Template
                        </Link>
                    </Button>
                </div>

                {templates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
                        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                        <h3 className="text-lg font-medium">No templates yet</h3>
                        <p className="mb-4 text-sm text-muted-foreground">Create your first document template to get started.</p>
                        <Button asChild>
                            <Link href={route('document-templates.create')}>
                                <Plus className="mr-2 h-4 w-4" />
                                New Template
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead className="w-[100px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {templates.map((template) => (
                                    <TableRow key={template.id}>
                                        <TableCell className="font-medium">{template.name}</TableCell>
                                        <TableCell>
                                            {template.category ? (
                                                <Badge variant="secondary">{template.category}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={template.is_active ? 'default' : 'secondary'}>
                                                {template.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(template.updated_at).toLocaleDateString('en-AU')}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link href={route('document-templates.edit', template.id)}>
                                                        <Pencil className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete template?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This will permanently delete "{template.name}". This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(template.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
