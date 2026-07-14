import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Bell, EllipsisVertical, FileText, Plus, Workflow } from 'lucide-react';
import { type TriggerAction } from './types';

interface ModelType {
    value: string;
    label: string;
}

interface PageProps {
    actions: TriggerAction[];
    modelTypes: ModelType[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Trigger Actions', href: '/trigger-actions' }];

export default function TriggerActionsIndex({ actions, modelTypes }: PageProps) {
    function displayName(a: TriggerAction): string {
        return a.name ?? (a.action_type === 'send_notification' ? a.notification_title : a.form_template?.name) ?? `Action #${a.id}`;
    }

    function handleDelete(a: TriggerAction) {
        if (!confirm(`Delete "${displayName(a)}"?`)) return;
        router.delete(route('model-trigger-actions.destroy', a.id));
    }

    function modelLabel(value: string): string {
        return modelTypes.find((mt) => mt.value === value)?.label ?? value;
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Trigger Actions" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                <div className="mb-6 flex items-center justify-end">
                    <Button size="sm" asChild>
                        <Link href={route('model-trigger-actions.create')}>
                            <Plus className="mr-1.5 h-4 w-4" />
                            New action
                        </Link>
                    </Button>
                </div>

                {actions.length === 0 ? (
                    <Card className="gap-2 py-2">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
                                <Workflow className="text-muted-foreground h-7 w-7" />
                            </div>
                            <h3 className="text-base font-medium">No trigger actions configured</h3>
                            <p className="text-muted-foreground mt-1 max-w-md text-sm">
                                Pick a trigger on a model and an action — assign a form or send a notification — and it fires
                                automatically when the trigger hits.
                            </p>
                            <Button size="sm" className="mt-5" asChild>
                                <Link href={route('model-trigger-actions.create')}>
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    Create first action
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="gap-2 py-2">
                        <CardContent className="p-0">
                            <Table className="text-xs">
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="pl-4">Name</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead className="text-center">Active</TableHead>
                                        <TableHead className="w-12 pr-4 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {actions.map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="pl-4 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {a.action_type === 'send_notification' ? (
                                                        <Bell className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                                    ) : (
                                                        <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                                    )}
                                                    <span className="truncate">{displayName(a)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{modelLabel(a.model_type)}</TableCell>
                                            <TableCell className="text-center">
                                                {a.is_active ? (
                                                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 shadow-none hover:bg-emerald-500/10">
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="shadow-none">
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="pr-4 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
                                                            <EllipsisVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="min-w-max">
                                                        <DropdownMenuItem
                                                            className="whitespace-nowrap"
                                                            onClick={() => router.visit(route('model-trigger-actions.edit', a.id))}
                                                        >
                                                            Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive whitespace-nowrap"
                                                            onClick={() => handleDelete(a)}
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}
            </div>
        </AppLayout>
    );
}
