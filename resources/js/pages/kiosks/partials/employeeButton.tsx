import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { ChevronRight, Clock } from 'lucide-react';

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
        <button
            onClick={onClick}
            className={cn(
                'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all',
                'hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                !isSelected && emp.clocked_in && 'bg-emerald-500/5',
            )}
        >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
                <Avatar
                    className={cn(
                        'h-10 w-10 border-2 transition-transform group-hover:scale-105',
                        isSelected ? 'border-primary-foreground/30' : 'border-transparent',
                        emp.clocked_in && !isSelected && 'border-emerald-500/50',
                    )}
                >
                    <AvatarFallback
                        className={cn(
                            'text-sm font-medium',
                            isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary',
                        )}
                    >
                        {getInitials(emp.name)}
                    </AvatarFallback>
                </Avatar>
                {emp.clocked_in && !isSelected && (
                    <span className="border-background absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 bg-emerald-500" />
                )}
            </div>

            {/* Name & Status */}
            <div className="min-w-0 flex-1">
                <p className={cn('truncate font-medium', isSelected ? 'text-primary-foreground' : 'text-foreground')}>{emp.name}</p>
                {emp.clocked_in && (
                    <p
                        className={cn(
                            'flex items-center gap-1 text-xs',
                            isSelected ? 'text-primary-foreground/80' : 'text-emerald-600 dark:text-emerald-400',
                        )}
                    >
                        <Clock className="h-3 w-3" />
                        In at {emp.clock_in_time}
                    </p>
                )}
            </div>

            {/* Chevron */}
            <ChevronRight
                className={cn(
                    'h-4 w-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5',
                    isSelected ? 'text-primary-foreground/60' : 'text-muted-foreground opacity-0 group-hover:opacity-100',
                )}
            />
        </button>
    );
}
