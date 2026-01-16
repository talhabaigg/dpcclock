import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from '@inertiajs/react';
import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

type Employee = {
    id: number;
    name: string;
    // eh_employee_id is on pivot
    pivot: { eh_employee_id: number | string };
};

type TimesheetEvent = {
    id: number;
    title: string;
    start: string;
    end: string;
};

interface GenerateTimesheetsDialogProps {
    employees: Employee[];
    kioskId: number;
    event: TimesheetEvent;
}

const GenerateTimesheetsDialog = ({ employees, kioskId, event }: GenerateTimesheetsDialogProps) => {
    const [open, setOpen] = useState(false);

    // Store EH IDs here
    const [selectedEhIds, setSelectedEhIds] = useState<number[]>([]);

    // Helper to safely extract numeric EH ID
    const getEhId = (emp: Employee) => Number((emp.pivot as any)?.eh_employee_id);

    // All EH IDs (unique, numeric, no NaN)
    const allEhIds = useMemo(() => Array.from(new Set(employees.map(getEhId).filter((n) => Number.isFinite(n) && n > 0))), [employees]);

    const isAllSelected = selectedEhIds.length === allEhIds.length && allEhIds.length > 0;
    const isNoneSelected = selectedEhIds.length === 0;
    const isIndeterminate = !isNoneSelected && !isAllSelected;

    // Master checkbox indeterminate handling
    const masterRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (masterRef.current) masterRef.current.indeterminate = isIndeterminate;
    }, [isIndeterminate]);

    const toggleAll = () => setSelectedEhIds((prev) => (prev.length === allEhIds.length ? [] : allEhIds));
    const clearAll = () => setSelectedEhIds([]);
    const toggleOne = (ehId: number) => setSelectedEhIds((prev) => (prev.includes(ehId) ? prev.filter((x) => x !== ehId) : [...prev, ehId]));

    const form = useForm<{ employeeIds: number[]; kioskId: number }>({
        employeeIds: [],
        kioskId,
    });

    const handleCreateTimeForSelectedEvent = () => {
        const ids = Array.from(new Set(selectedEhIds)).map(Number);
        if (ids.length === 0) {
            alert('Please select at least one employee.');
            return;
        }

        form.transform((d) => ({
            ...d,
            employeeIds: selectedEhIds,
        }));
        const url = route('events.generateTimesheets', { eventId: event.id, kioskId });

        form.post(url, {
            preserveScroll: true,
            onSuccess: () => {
                form.setData('employeeIds', []);
                setSelectedEhIds([]);
            },
        });
    };

    return (
        <div>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                        <Sparkles />
                        Generate Timesheets
                    </Button>
                </DialogTrigger>

                <DialogContent className="max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Generating timesheets for {event?.title}</DialogTitle>

                        <DialogDescription>
                            <div>
                                {event.start} to {event.end}
                            </div>
                            Select employees to include.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-3 flex items-center justify-between">
                        <span className="text-muted-foreground text-sm">{selectedEhIds.length} selected</span>
                        <Button onClick={handleCreateTimeForSelectedEvent} disabled={form.processing || selectedEhIds.length === 0}>
                            <Sparkles />
                            {form.processing ? 'Generating…' : 'Generate'}
                        </Button>
                    </div>
                    {/* Master controls */}
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-md">
                        <Label className="hover:bg-accent/50 flex w-full flex-row items-center justify-between gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="toggle-2"
                                    checked={isAllSelected}
                                    onClick={toggleAll}
                                    className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                                />
                                <div className="grid gap-1.5 font-normal">
                                    <p className="text-sm leading-none font-medium">
                                        {isAllSelected ? 'Unselect all' : isIndeterminate ? 'Select all (partial)' : 'Select all'}
                                    </p>
                                </div>
                            </div>
                        </Label>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant="outline" onClick={toggleAll}>
                                {isAllSelected ? 'Unselect all' : 'Select all'}
                            </Button>
                        </div>
                        <Button size="sm" variant="ghost" onClick={clearAll} disabled={isNoneSelected}>
                            Clear
                        </Button>
                        {/* <div className="flex items-center gap-2">
                            <input
                                ref={masterRef}
                                id="select-all"
                                type="checkbox"
                                className="h-4 w-4"
                                checked={isAllSelected}
                                onChange={onMasterChange}
                            />
                            <Label htmlFor="select-all">
                                {isAllSelected ? 'Unselect all' : isIndeterminate ? 'Select all (partial)' : 'Select all'}
                            </Label>
                        </div> */}
                    </div>

                    {/* List (checkbox state bound to pivot.eh_employee_id) */}
                    <div className="mt-2">
                        {employees.map((emp) => {
                            const ehId = getEhId(emp);
                            const checked = selectedEhIds.includes(ehId);
                            return (
                                <div key={emp.id} className="flex items-center gap-2 py-2">
                                    <Label className="hover:bg-accent/50 flex w-full items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-blue-600 has-[[aria-checked=true]]:bg-blue-50 dark:has-[[aria-checked=true]]:border-blue-900 dark:has-[[aria-checked=true]]:bg-blue-950">
                                        <Checkbox
                                            id="toggle-2"
                                            checked={checked}
                                            onCheckedChange={() => toggleOne(ehId)}
                                            className="data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:border-blue-700 dark:data-[state=checked]:bg-blue-700"
                                        />
                                        <div className="grid gap-1.5 font-normal">
                                            <p className="text-sm leading-none font-medium">{emp.name}</p>
                                            <p className="text-muted-foreground text-sm">EH #{ehId}</p>
                                        </div>
                                    </Label>
                                    {/* <input
                                        id={`emp-${emp.id}`}
                                        name={`emp-${emp.id}`}
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={checked}
                                        onChange={() => toggleOne(ehId)}
                                    />
                                    <Label htmlFor={`emp-${emp.id}`} className="text-sm font-medium">
                                        {emp.name} <span className="text-muted-foreground text-xs">(EH #{ehId})</span>
                                    </Label> */}
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer */}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GenerateTimesheetsDialog;
