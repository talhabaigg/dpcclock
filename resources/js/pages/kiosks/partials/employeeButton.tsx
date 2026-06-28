import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { ChevronRight, Clock, LogOut } from 'lucide-react';

interface Employee {
    id: number;
    name: string;
    preferred_name?: string | null;
    display_name: string;
    email: string;
    pin: string;
    eh_employee_id: string;
    clocked_in: boolean;
    clock_in_time?: string;
    signed_out_time?: string | null;
}

type Props = {
    emp: Employee;
    isSelected: boolean;
    onClick: () => void;
};

export default function EmployeeListButton({ emp, isSelected, onClick }: Props) {
    const getInitials = useInitials();

    return (
        <button
            onClick={onClick}
            className={cn(
                'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all',
                'hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                // Selected: soft primary tint + left accent bar — distinct from the grey hover.
                isSelected && 'bg-primary/10 hover:bg-primary/15',
                isSelected &&
                    'before:bg-primary before:absolute before:top-1/2 before:left-0 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full',
                !isSelected && emp.clocked_in && 'bg-primary/5',
            )}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <Avatar
                    className={cn(
                        'h-10 w-10 border-2 transition-transform group-hover:scale-105',
                        isSelected ? 'border-primary/40' : 'border-transparent',
                        emp.clocked_in && !isSelected && 'border-primary/40',
                    )}
                >
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">{getInitials(emp.display_name)}</AvatarFallback>
                </Avatar>
                {emp.clocked_in && (
                    <span className="border-background bg-primary absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2" />
                )}
            </div>

            {/* Name & Status */}
            <div className="min-w-0 flex-1">
                <p className={cn('text-foreground truncate', isSelected ? 'font-semibold' : 'font-medium')}>{emp.display_name}</p>
                {emp.clocked_in && (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        In at {emp.clock_in_time}
                    </p>
                )}
                {!emp.clocked_in && emp.signed_out_time && (
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <LogOut className="h-3 w-3" />
                        Signed out at {emp.signed_out_time}
                    </p>
                )}
            </div>

            {/* Chevron */}
            <ChevronRight
                className={cn(
                    'h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5',
                    isSelected ? 'text-primary opacity-100' : 'text-muted-foreground opacity-0 group-hover:opacity-100',
                )}
            />
        </button>
    );
}
