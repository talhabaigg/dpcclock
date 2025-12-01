import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { UserInfo } from '@/components/user-info';
import { useForm } from '@inertiajs/react';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';

const AddEmployeesToKiosk = ({ existingEmployeeIds, allEmployees, kioskId }) => {
    const [selectedEhIds, setSelectedEhIds] = useState<number[]>(existingEmployeeIds ?? []);

    const getEHId = (empId: number) => {
        const emp = allEmployees.find((e) => e.id === empId);
        return emp ? emp.id : null;
    };
    const [open, setOpen] = useState(false);

    const form = useForm<{ employeeIds: number[]; kioskId: number }>({
        employeeIds: [],
        kioskId,
    });
    const handleAddSelected = () => {
        const ids = Array.from(new Set(selectedEhIds)).map(Number);
        if (ids.length === 0) {
            alert('Please select at least one employee.');
            return;
        }

        form.transform((d) => ({
            ...d,
            employeeIds: selectedEhIds,
        }));
        const url = route('kiosks.addEmployees', { kiosk: kioskId });

        form.post(url, {
            preserveScroll: true,
            onSuccess: () => {
                form.setData('employeeIds', []);
                setSelectedEhIds([]);
                setOpen(false);
            },
        });
    };
    return (
        <div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                        <PlusCircle /> Add Employee
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add employee to Kiosk </DialogTitle>

                        <DialogDescription>Select employees to attach.</DialogDescription>
                    </DialogHeader>
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">{selectedEhIds.length} selected</span>
                        <Button onClick={handleAddSelected} disabled={form.processing || selectedEhIds.length === 0}>
                            Add selected
                        </Button>
                    </div>
                    {allEmployees.map((emp) => {
                        const ehId = getEHId(emp.id);
                        const checked = selectedEhIds.includes(ehId);

                        return (
                            <div key={emp.id} className="flex items-center gap-2 py-2">
                                <Label className="hover:bg-accent/50 flex w-full items-center justify-between gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                                    <div className="grid gap-1.5 font-normal">
                                        <div className="flex items-center space-x-2">
                                            <UserInfo user={{ ...emp, email_verified_at: '', created_at: '', updated_at: '', phone: '' }}></UserInfo>
                                        </div>

                                        {/* <p className="text-sm leading-none font-medium">{emp.name}</p> */}
                                        <p className="text-muted-foreground ml-10 text-[10px] font-thin">Employee Id - {emp.eh_employee_id}</p>
                                    </div>
                                    <Checkbox
                                        id="toggle-2"
                                        checked={checked}
                                        disabled={existingEmployeeIds.includes(ehId)}
                                        onCheckedChange={(isChecked) => {
                                            if (isChecked) {
                                                setSelectedEhIds((prev) => [...prev, ehId]);
                                            } else {
                                                setSelectedEhIds((prev) => prev.filter((id) => id !== ehId));
                                            }
                                        }}
                                        className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                                    />
                                </Label>
                            </div>
                        );
                    })}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AddEmployeesToKiosk;
