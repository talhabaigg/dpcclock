import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { UserInfo } from '@/components/user-info';
import { useForm } from '@inertiajs/react';
import { useState } from 'react';

interface Employee {
    id: number;
    name: string;
}
interface Kiosk {
    id: number;
    name: string;
}

const AddManagerKioskDialog = ({ kiosk, users, existingManagerIds }: { kiosk: Kiosk; users: Employee[]; existingManagerIds: number[] }) => {
    const initialSelected = existingManagerIds ?? [];

    const [selectedIds, setSelectedIds] = useState<number[]>(initialSelected);

    const form = useForm<{ managerIds: number[]; kioskId: number }>({
        managerIds: initialSelected,
        kioskId: kiosk.id,
    });

    const updateSelection = (updater: (prev: number[]) => number[]) => {
        setSelectedIds((prev) => {
            const next = updater(prev);
            form.setData('managerIds', next);
            return next;
        });
    };

    const toggleUser = (userId: number, checked: boolean | 'indeterminate') => {
        if (checked === true) {
            updateSelection((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
        } else {
            updateSelection((prev) => prev.filter((id) => id !== userId));
        }
    };

    const submit = () => {
        if (selectedIds.length === 0) return;
        form.post(route('kiosks.manager.store', kiosk.id));
    };

    return (
        <div>
            <Dialog>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                        + Add Manager
                    </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add manager to Kiosk</DialogTitle>
                        <DialogDescription>Select managers to attach.</DialogDescription>
                    </DialogHeader>

                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">{selectedIds.length} selected</span>
                        <Button onClick={submit} disabled={form.processing || selectedIds.length === 0}>
                            Add selected
                        </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                        {users.map((user) => {
                            const isSelected = selectedIds.includes(user.id);

                            return (
                                <Label
                                    key={user.id}
                                    className="hover:bg-accent/50 flex w-full items-center rounded-lg border p-3 has-[[data-state=checked]]:border-blue-600 has-[[data-state=checked]]:bg-blue-50 dark:has-[[data-state=checked]]:border-blue-900 dark:has-[[data-state=checked]]:bg-blue-950"
                                >
                                    <div className="flex flex-row items-center gap-2">
                                        <UserInfo
                                            user={{
                                                ...user,
                                                email: '',
                                                email_verified_at: '',
                                                created_at: '',
                                                updated_at: '',
                                                phone: '',
                                            }}
                                        />
                                    </div>

                                    <Checkbox className="ml-auto" checked={isSelected} onCheckedChange={(checked) => toggleUser(user.id, checked)} />
                                </Label>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddManagerKioskDialog;
