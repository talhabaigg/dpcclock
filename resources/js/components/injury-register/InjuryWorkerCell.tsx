import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import type { InjuryEmployee } from '@/types/injury';

interface InjuryWorkerCellProps {
    employee: InjuryEmployee | null | undefined;
    fallbackName: string | null | undefined;
}

export default function InjuryWorkerCell({ employee, fallbackName }: InjuryWorkerCellProps) {
    const getInitials = useInitials();
    const displayName = employee?.preferred_name ?? employee?.name ?? fallbackName ?? '';

    if (!displayName) return <span className="text-muted-foreground">—</span>;

    return (
        <div className="flex items-center gap-2">
            <Avatar size="sm">
                <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <div>
                <div className="text-xs font-medium leading-tight">{displayName}</div>
                {employee?.employment_type && (
                    <div className="text-muted-foreground text-xs leading-tight">{employee.employment_type}</div>
                )}
            </div>
        </div>
    );
}
