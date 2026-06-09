import { DualListAssign } from '@/components/dual-list-assign';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface User {
    id: number;
    name: string;
}

interface Kiosk {
    id: number;
    name: string;
}

interface AddManagerKioskDialogProps {
    kiosk: Kiosk;
    users: User[];
    existingManagerIds: number[];
}

const AddManagerKioskDialog = ({ kiosk, users, existingManagerIds }: AddManagerKioskDialogProps) => {
    const [open, setOpen] = useState(false);
    const [assignedIds, setAssignedIds] = useState<number[]>(existingManagerIds ?? []);

    useEffect(() => {
        if (open) {
            setAssignedIds(existingManagerIds ?? []);
        }
    }, [open, existingManagerIds]);

    const form = useForm<{ managerIds: number[] }>({ managerIds: [] });

    const initialSet = new Set(existingManagerIds ?? []);
    const currentSet = new Set(assignedIds);
    const isDirty = initialSet.size !== currentSet.size || [...currentSet].some((id) => !initialSet.has(id));

    const handleSave = () => {
        form.transform((d) => ({ ...d, managerIds: assignedIds }));
        form.post(route('kiosks.syncManagers', { kiosk: kiosk.id }), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
            },
        });
    };

    const items = users.map((u) => ({ id: u.id, label: u.name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Users /> Manage Managers
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] min-w-[90%] overflow-y-auto sm:max-w-[90%]">
                <DialogHeader>
                    <DialogTitle>Manage kiosk managers</DialogTitle>
                    <DialogDescription>Click a user to move them between lists, then Save.</DialogDescription>
                </DialogHeader>

                <DualListAssign
                    items={items}
                    assignedIds={assignedIds}
                    onChange={setAssignedIds}
                    availableLabel="All users"
                    assignedLabel="On this kiosk"
                    searchPlaceholder="Search users..."
                    emptyAvailableText="All users assigned"
                    emptyAssignedText="No managers on this kiosk"
                    disabled={form.processing}
                />

                <DialogFooter className="border-t pt-3">
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={form.processing}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={form.processing || !isDirty}>
                        {form.processing ? 'Saving...' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddManagerKioskDialog;
