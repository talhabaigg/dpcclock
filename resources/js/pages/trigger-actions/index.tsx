import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { triggerLabel, type TriggerAction } from './types';

function getInitials(name: string): string {
    return name
        .split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

interface ModelType {
    value: string;
    label: string;
}

interface PageProps {
    actions: TriggerAction[];
    modelTypes: ModelType[];
    subjectSourcesByModel: Record<string, Record<string, string>>;
    permissions: { id: number; name: string }[];
    users: { id: number; name: string }[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Trigger Actions', href: '/trigger-actions' }];

const CHANNEL_LABELS: Record<string, string> = {
    database: 'In-app',
    mail: 'Email',
    webpush: 'Push',
};

export default function TriggerActionsIndex({ actions, modelTypes, subjectSourcesByModel, permissions, users }: PageProps) {
    function handleDelete(a: TriggerAction) {
        const label = a.name ?? (a.action_type === 'assign_form' ? a.form_template?.name : a.notification_title);
        if (!confirm(`Delete the "${label}" action for ${triggerLabel(a.trigger_key)}?`)) return;
        router.delete(route('model-trigger-actions.destroy', a.id));
    }

    function modelLabel(value: string): string {
        return modelTypes.find((mt) => mt.value === value)?.label ?? value;
    }

    function renderRecipient(a: TriggerAction) {
        if (a.assignee_strategy === 'permission') {
            const perm = permissions.find((p) => p.name === a.assignee_value);
            return (
                <span className="text-muted-foreground">
                    Permission: {perm ? perm.name : `${a.assignee_value} (not found)`}
                </span>
            );
        }
        const user = users.find((u) => String(u.id) === String(a.assignee_value));
        const label = user ? user.name : `User #${a.assignee_value} (not found)`;
        return (
            <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-muted text-primary text-[10px] font-medium">
                        {getInitials(label)}
                    </AvatarFallback>
                </Avatar>
                <span className={user ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
            </div>
        );
    }

    function subjectSourceLabel(key: string | null): string | null {
        if (!key) return null;
        // Look across all models so the listing table can label rows whose
        // model isn't currently selected in the form.
        for (const sources of Object.values(subjectSourcesByModel)) {
            if (sources[key]) return sources[key];
        }
        return key;
    }

    function renderBehavior(a: TriggerAction) {
        if (a.action_type === 'send_notification') {
            return (
                <span className="text-muted-foreground">
                    {(a.notification_channels ?? []).map((c) => CHANNEL_LABELS[c] ?? c).join(' · ')}
                </span>
            );
        }
        return (
            <div className="text-muted-foreground flex flex-col gap-0.5">
                <span>{a.subject_source ? subjectSourceLabel(a.subject_source) : 'Single form'}</span>
                <span className="text-[10px] tracking-wide uppercase">
                    {a.dispatch_mode === 'auto' ? 'Auto' : 'On demand'}
                    {a.subject_source && a.min_submissions > 1 && <> · min {a.min_submissions}</>}
                </span>
            </div>
        );
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
                                        <TableHead>Trigger</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Behavior</TableHead>
                                        <TableHead>Recipient</TableHead>
                                        <TableHead className="text-center">Required</TableHead>
                                        <TableHead className="text-center">Active</TableHead>
                                        <TableHead className="w-12 pr-4 text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {actions.map((a) => (
                                        <TableRow key={a.id}>
                                            <TableCell className="max-w-[200px] truncate pl-4 font-medium">
                                                {a.name ??
                                                    (a.action_type === 'send_notification' ? a.notification_title : a.form_template?.name)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{modelLabel(a.model_type)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal">
                                                    {triggerLabel(a.trigger_key)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    {a.action_type === 'send_notification' ? (
                                                        <Bell className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                                    ) : (
                                                        <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                                    )}
                                                    <span>
                                                        {a.action_type === 'send_notification'
                                                            ? a.notification_title
                                                            : a.form_template?.name}
                                                    </span>
                                                    {a.action_type === 'assign_form' && a.form_template && !a.form_template.is_sendable && (
                                                        <Badge variant="secondary" className="shadow-none">
                                                            In-app only
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{renderBehavior(a)}</TableCell>
                                            <TableCell className="max-w-[100px] truncate">{renderRecipient(a)}</TableCell>
                                            <TableCell className="text-center">
                                                {a.action_type === 'assign_form' && a.is_required ? (
                                                    <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-700 shadow-none hover:bg-amber-500/10">
                                                        Required
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">Optional</span>
                                                )}
                                            </TableCell>
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
