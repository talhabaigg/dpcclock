import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SearchEmployeeProps {
    onEmployeeChange: (employeeId: string) => void;
    initialEmployeeId: string; // Added prop to receive the initial employeeId
}

export function SearchEmployee({ onEmployeeChange, initialEmployeeId }: SearchEmployeeProps) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(initialEmployeeId); // Initialize with initialEmployeeId
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const response = await fetch('/employees/list');
            const data = await response.json();
            setEmployees(
                data.map((emp: any) => ({
                    value: emp.id.toString(),
                    label: emp.name,
                })),
            );
        } catch (error) {
            console.error('Failed to fetch employees', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch employees when the component mounts
        fetchEmployees();
    }, []);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            fetchEmployees();
        }
    };

    const currentIndex = employees.findIndex((emp) => emp.value === value);

    const goToPrevious = () => {
        if (employees.length === 0) return;
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : employees.length - 1;
        setValue(employees[prevIndex].value);
        onEmployeeChange(employees[prevIndex].value); // Emit employee change
    };

    const goToNext = () => {
        if (employees.length === 0) return;
        const nextIndex = currentIndex < employees.length - 1 ? currentIndex + 1 : 0;
        setValue(employees[nextIndex].value);
        onEmployeeChange(employees[nextIndex].value); // Emit employee change
    };

    return (
        <div className="flex items-center justify-start">
            <Button onClick={goToPrevious} variant="outline" className="rounded-r-none">
                <ChevronLeft />
            </Button>
            <div className="flex flex-col items-center space-y-2">
                <Popover open={open} onOpenChange={handleOpenChange}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={open} className="w-[250px] justify-between rounded-none">
                            {value ? employees.find((emp) => emp.value === value)?.label : 'Select an Employee'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0">
                        <Command>
                            <CommandInput placeholder="Search employee..." />
                            <CommandList className="max-h-60 overflow-auto">
                                {loading ? (
                                    <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading...
                                    </div>
                                ) : employees.length === 0 ? (
                                    <CommandEmpty>No employee found.</CommandEmpty>
                                ) : (
                                    <CommandGroup>
                                      {employees.map((emp) => (
                                        <CommandItem
                                            key={emp.value}
                                            value={emp.label.toLowerCase()} // ✅ This lets filtering match the text shown
                                            onSelect={() => {
                                                setValue(emp.value);
                                                setOpen(false);
                                                onEmployeeChange(emp.value);
                                            }}
                                        >
                                            <Check className={cn('mr-2 h-4 w-4', value === emp.value ? 'opacity-100' : 'opacity-0')} />
                                            {emp.label}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
            </div>
            <Button onClick={goToNext} variant="outline" className="rounded-l-none">
                <ChevronRight />
            </Button>
        </div>
    );
}
