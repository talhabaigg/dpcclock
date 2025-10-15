import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useInitials } from '@/hooks/use-initials';
interface Employee {
    id: number;
    name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
    clocked_in: boolean;
    clock_in_time?: string;
}
type Props = {
    emp: Employee;
    isSelected: boolean;
    onClick: () => void;
};

export default function EmployeeListButton({ emp, isSelected, onClick }: Props) {
    const getInitials = useInitials();
    return (
        <>
            <Button
                variant={isSelected ? 'secondary' : 'ghost'}
                className={`h-14 w-full justify-start text-left ${isSelected ? 'bg-blue-500 text-white hover:bg-blue-400' : 'hover:bg-blue-400'}`}
                onClick={onClick}
            >
                <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                    <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                        {getInitials(emp.name)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    {emp.name}
                    {emp.clocked_in && <span className="text-green-500">Clocked In at {emp.clock_in_time}</span>}
                </div>
            </Button>
        </>
    );
}
