import { DualListAssign } from '@/components/dual-list-assign';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from '@inertiajs/react';
import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Employee {
    id: number;
    name: string;
    eh_employee_id?: string | number;
}

interface AddEmployeesToKioskProps {
    existingEmployeeIds: number[];
    allEmployees: Employee[];
    kioskId: number;
}

const AddEmployeesToKiosk = ({ existingEmployeeIds, allEmployees, kioskId }: AddEmployeesToKioskProps) => {
    const [open, setOpen] = useState(false);
    const [assignedIds, setAssignedIds] = useState<number[]>(existingEmployeeIds ?? []);

    useEffect(() => {
        if (open) {
            setAssignedIds(existingEmployeeIds ?? []);
        }
    }, [open, existingEmployeeIds]);

    const form = useForm<{ employeeIds: number[] }>({ employeeIds: [] });

    const initialSet = new Set(existingEmployeeIds ?? []);
    const currentSet = new Set(assignedIds);
    const isDirty = initialSet.size !== currentSet.size || [...currentSet].some((id) => !initialSet.has(id));

    const handleSave = () => {
        form.transform((d) => ({ ...d, employeeIds: assignedIds }));
        form.post(route('kiosks.syncEmployees', { kiosk: kioskId }), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
            },
        });
    };

    const items = allEmployees.map((emp) => ({ id: emp.id, label: emp.name }));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    <Users /> Manage Employees
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] min-w-[90%] overflow-y-auto sm:max-w-[90%]">
                <DialogHeader>
                    <DialogTitle>Manage kiosk employees</DialogTitle>
                    <DialogDescription>Click an employee to move them between lists, then Save.</DialogDescription>
                </DialogHeader>

                <DualListAssign
                    items={items}
                    assignedIds={assignedIds}
                    onChange={setAssignedIds}
                    availableLabel="All employees"
                    assignedLabel="On this kiosk"
                    searchPlaceholder="Search employees..."
                    emptyAvailableText="All employees assigned"
                    emptyAssignedText="No employees on this kiosk"
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

export default AddEmployeesToKiosk;
