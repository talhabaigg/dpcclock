import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Pencil, Plus, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WorkerScreening, columns } from './columns';
import { DataTable } from './data-table';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Worker Screening',
        href: '/worker-screening',
    },
];

interface Props {
    screenings: WorkerScreening[];
}

export default function WorkerScreeningIndex({ screenings }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<WorkerScreening | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '',
        surname: '',
        phone: '',
        email: '',
        date_of_birth: '',
        reason: '',
    });

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (Object.keys(errors).length > 0) {
            Object.values(errors).forEach((msg) => toast.error(msg));
        }
    }, [errors]);

    const openCreateDialog = () => {
        setSelectedEntry(null);
        setFormData({ first_name: '', surname: '', phone: '', email: '', date_of_birth: '', reason: '' });
        setIsDialogOpen(true);
    };

    const openEditDialog = (entry: WorkerScreening) => {
        if (entry.status === 'removed') return;
        setSelectedEntry(entry);
        setFormData({
            first_name: entry.first_name,
            surname: entry.surname,
            phone: entry.phone || '',
            email: entry.email || '',
            date_of_birth: entry.date_of_birth || '',
            reason: entry.reason,
        });
        setIsDialogOpen(true);
    };

    const openRemoveDialog = (entry: WorkerScreening) => {
        setSelectedEntry(entry);
        setIsRemoveDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (selectedEntry) {
            router.put(`/worker-screening/${selectedEntry.id}`, formData, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        } else {
            router.post('/worker-screening', formData, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        }
    };

    const handleRemove = () => {
        if (!selectedEntry) return;
        setIsSubmitting(true);

        router.post(`/worker-screening/${selectedEntry.id}/remove`, {}, {
            onSuccess: () => {
                setIsRemoveDialogOpen(false);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    const columnsWithActions = [
        ...columns,
        {
            id: 'actions',
            header: '',
            cell: ({ row }: { row: { original: WorkerScreening } }) => {
                if (row.original.status === 'removed') return null;
                return (
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(row.original);
                            }}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                openRemoveDialog(row.original);
                            }}
                        >
                            <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                    </div>
                );
            },
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Worker Screening" />
            <div className="mt-2 mr-2 flex justify-end gap-2">
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Entry
                </Button>
            </div>
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-2">
                <DataTable columns={columnsWithActions} data={screenings} onRowClick={openEditDialog} />
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{selectedEntry ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
                        <DialogDescription>
                            {selectedEntry ? 'Update the screening entry details.' : 'Enter the details for the new screening entry.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="first_name">First Name *</Label>
                                    <Input
                                        id="first_name"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="surname">Surname *</Label>
                                    <Input
                                        id="surname"
                                        value={formData.surname}
                                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="e.g. 0412 345 678"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="date_of_birth">Date of Birth</Label>
                                <Input
                                    id="date_of_birth"
                                    type="date"
                                    value={formData.date_of_birth}
                                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reason">Reason / Notes *</Label>
                                <Textarea
                                    id="reason"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="Internal notes about why this person was flagged"
                                    rows={3}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : selectedEntry ? 'Update' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Remove Confirmation Dialog */}
            <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Remove Entry</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove the screening entry for "{selectedEntry?.first_name} {selectedEntry?.surname}"? This will deactivate the entry but keep the audit trail.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsRemoveDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleRemove} disabled={isSubmitting}>
                            {isSubmitting ? 'Removing...' : 'Remove'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
